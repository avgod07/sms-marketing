import { db } from "../config/db.config.js";
import { messageQueue, businesses } from "@shared/schema";
import { eq, and, lte, lt } from "drizzle-orm";
import { MessageQueueService } from "./message-queue.js";
import { QuietHoursCompliance } from "./quiet-hours-compliance.js";
import { FairRateLimitedProcessorV2 } from "./fair-rate-limited-processor-v2.js";
import { storage } from "../db/storage.js";
import type { IStorage } from "../db/storage.js";
import { logInfo, logError } from "../utils/logger.util.js";
import { executeCampaign } from "./campaign.js";
import { campaigns } from "@shared/schema";

// Feature flag to control message retry behavior
// Set to false to disable retries and mark messages as failed immediately
const ENABLE_MESSAGE_RETRIES = process.env.ENABLE_MESSAGE_RETRIES === "true";

export interface QueueProcessingStats {
  totalProcessed: number;
  sentCount: number;
  rescheduledCount: number;
  failedCount: number;
  suppressedCount: number; // NEW: Track suppressed separately from failed
  businessCount: number;
  processingTimeMs: number;
}

/**
 * QueueProcessor Service
 * Handles processing of queued messages during business hours using the new fair processor
 */
export class QueueProcessor {
  /**
   * Process all ready messages in the queue
   * Called by background job every 1 minute (updated from 15 minutes)
   */
  static async processQueue(): Promise<QueueProcessingStats> {
    const startTime = Date.now();
    let totalProcessed = 0;
    let sentCount = 0;
    let rescheduledCount = 0;
    let failedCount = 0;
    let suppressedCount = 0;
    const businessesProcessed = new Set<number>();

    try {
      logInfo("Starting TCPA queue processing cycle");

      // Get all messages ready to send from TCPA queue
      const readyMessages = await MessageQueueService.getMessagesReadyToSend();

      if (readyMessages.length === 0) {
        logInfo("No TCPA messages ready for processing");
        return this.getEmptyStats(Date.now() - startTime);
      }

      logInfo(`Processing ${readyMessages.length} TCPA messages`, {
        messageCount: readyMessages.length,
      });

      // Group messages by business for fair processing
      const messagesByBusiness = new Map<number, typeof readyMessages>();
      for (const message of readyMessages) {
        const businessMessages =
          messagesByBusiness.get(message.businessId) || [];
        businessMessages.push(message);
        messagesByBusiness.set(message.businessId, businessMessages);
        businessesProcessed.add(message.businessId);
      }

      logInfo("Processing TCPA messages through fair processor V2", {
        businessCount: messagesByBusiness.size,
        totalMessages: readyMessages.length,
      });

      // Process through NEW fair processor V2
      const fairStats = await FairRateLimitedProcessorV2.processQueuedMessages(
        messagesByBusiness
      );

      // Mark original TCPA queue messages as processed since they're now in the fair processor
      for (const message of readyMessages) {
        await MessageQueueService.markAsSent(
          message.id,
          "transferred_to_fair_processor_v2"
        );
      }

      // Use stats from fair processor
      totalProcessed = fairStats.totalProcessed;
      sentCount = fairStats.sentCount;
      rescheduledCount = fairStats.queuedCount; // Messages now in fair processor
      failedCount = fairStats.failedCount;
      suppressedCount = fairStats.suppressedCount;

      logInfo("TCPA queue processing completed via fair processor V2", {
        totalProcessed,
        sentCount,
        rescheduledCount,
        failedCount,
        suppressedCount,
        businessCount: businessesProcessed.size,
        processingTimeMs: Date.now() - startTime,
      });

      return {
        totalProcessed,
        sentCount,
        rescheduledCount,
        failedCount,
        suppressedCount,
        businessCount: businessesProcessed.size,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logError("Critical error in TCPA queue processing", {
        error: error instanceof Error ? error.message : String(error),
        processingTimeMs: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Get empty stats structure
   */
  private static getEmptyStats(processingTimeMs: number): QueueProcessingStats {
    return {
      totalProcessed: 0,
      sentCount: 0,
      rescheduledCount: 0,
      failedCount: 0,
      suppressedCount: 0,
      businessCount: 0,
      processingTimeMs,
    };
  }

  /**
   * Process scheduled campaigns that are ready to be sent
   * Called by background job to check for campaigns scheduled to run (every 30 seconds)
   */
  static async processScheduledCampaigns(): Promise<{
    totalProcessed: number;
    sentCount: number;
    failedCount: number;
    campaignCount: number;
    processingTimeMs: number;
  }> {
    const startTime = Date.now();
    let totalProcessed = 0;
    let sentCount = 0;
    let failedCount = 0;
    let campaignCount = 0;

    try {
      logInfo("Starting scheduled campaigns processing");

      // Find campaigns that are scheduled and ready to run
      const scheduledCampaigns = await db
        .select()
        .from(campaigns)
        .where(
          and(
            eq(campaigns.status, "scheduled"),
            eq(campaigns.schedulingType, "scheduled"),
            lte(campaigns.scheduledSendTime, new Date())
          )
        )
        .limit(50); // Process up to 50 campaigns per cycle

      if (scheduledCampaigns.length === 0) {
        logInfo("No scheduled campaigns ready for processing");
        return {
          totalProcessed: 0,
          sentCount: 0,
          failedCount: 0,
          campaignCount: 0,
          processingTimeMs: Date.now() - startTime,
        };
      }

      logInfo(`Processing ${scheduledCampaigns.length} scheduled campaigns`);

      for (const campaign of scheduledCampaigns) {
        campaignCount++;
        totalProcessed++;

        try {
          const bizStorage = storage.forBusiness(campaign.businessId);

          logInfo("Executing scheduled campaign", {
            campaignId: campaign.id,
            businessId: campaign.businessId,
            scheduledSendTime: campaign.scheduledSendTime,
            campaignName: campaign.name,
          });

          // Execute campaign using the new system (with immediate credit deduction)
          const results = await executeCampaign(bizStorage, campaign.id);
          sentCount += results.totalProcessed; // Messages committed for processing

          logInfo("Scheduled campaign executed successfully", {
            campaignId: campaign.id,
            businessId: campaign.businessId,
            totalCommitted: results.totalProcessed,
            creditsDeducted: results.creditsDeducted,
            remainingCredits: results.remainingCredits,
            totalContacts: results.totalContacts,
          });
        } catch (error) {
          failedCount++;

          logError("Failed to execute scheduled campaign", {
            campaignId: campaign.id,
            businessId: campaign.businessId,
            error: error instanceof Error ? error.message : String(error),
            scheduledFor: campaign.scheduledSendTime,
          });

          // Mark campaign as failed but keep scheduling info for debugging
          try {
            const bizStorage = storage.forBusiness(campaign.businessId);
            await bizStorage.updateCampaign(campaign.id, {
              status: "failed", // Mark as failed
              processingStatus: "failed",
              scheduleNotes: `Failed: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            });
          } catch (updateError) {
            logError("Failed to update failed campaign status", {
              campaignId: campaign.id,
              updateError:
                updateError instanceof Error
                  ? updateError.message
                  : String(updateError),
            });
          }
        }
      }

      const processingTimeMs = Date.now() - startTime;

      logInfo("Scheduled campaigns processing cycle completed", {
        totalProcessed,
        sentCount,
        failedCount,
        campaignCount,
        processingTimeMs,
      });

      return {
        totalProcessed,
        sentCount,
        failedCount,
        campaignCount,
        processingTimeMs,
      };
    } catch (error) {
      logError("Critical error in scheduled campaigns processing", {
        error: error instanceof Error ? error.message : String(error),
        processingTimeMs: Date.now() - startTime,
      });

      return {
        totalProcessed,
        sentCount,
        failedCount,
        campaignCount,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }
}
