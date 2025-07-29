import { db } from "../config/db.config.js";
import { messageQueue, businesses } from "@shared/schema";
import { eq, and, lte, lt } from "drizzle-orm";
import { MessageQueueService } from "./message-queue.js";
import { QuietHoursCompliance } from "./quiet-hours-compliance.js";
import { TwilioService } from "./twilio.js";
import { MessageCreditService } from "./message-credits.js";
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
 * Handles processing of queued messages during business hours
 */
export class QueueProcessor {
  /**
   * Process all ready messages in the queue
   * Called by background job every 15 minutes
   */
  static async processQueue(): Promise<QueueProcessingStats> {
    const startTime = Date.now();
    let totalProcessed = 0;
    let sentCount = 0;
    let rescheduledCount = 0;
    let failedCount = 0;
    const businessesProcessed = new Set<number>();

    try {
      logInfo("Starting queue processing cycle");

      // Get all messages ready to send (scheduled_for <= now AND status = pending)
      const readyMessages = await MessageQueueService.getMessagesReadyToSend();

      if (readyMessages.length === 0) {
        logInfo("No messages ready for processing");
        return {
          totalProcessed: 0,
          sentCount: 0,
          rescheduledCount: 0,
          failedCount: 0,
          suppressedCount: 0,
          businessCount: 0,
          processingTimeMs: Date.now() - startTime,
        };
      }

      logInfo(`Processing ${readyMessages.length} ready messages`);

      // Group messages by business to check timezone once per business
      const messagesByBusiness = new Map<number, typeof readyMessages>();
      for (const message of readyMessages) {
        const businessMessages =
          messagesByBusiness.get(message.businessId) || [];
        businessMessages.push(message);
        messagesByBusiness.set(message.businessId, businessMessages);
      }

      // Process each business's messages
      for (const [businessId, messages] of messagesByBusiness) {
        try {
          await this.processBusinessMessages(businessId, messages);
          businessesProcessed.add(businessId);

          // Count results for this business
          for (const message of messages) {
            totalProcessed++;
            // We'll update these counts based on actual results in processBusinessMessages
          }
        } catch (error) {
          logError("Failed to process messages for business", {
            businessId,
            messageCount: messages.length,
            error: error instanceof Error ? error.message : String(error),
          });

          // Mark all messages for this business as failed
          for (const message of messages) {
            totalProcessed++;
            failedCount++;
            try {
              await MessageQueueService.markAsFailed(
                message.id,
                error instanceof Error
                  ? error.message
                  : "Queue processing error"
              );
            } catch (markError) {
              logError("Failed to mark message as failed", {
                messageId: message.id,
                error:
                  markError instanceof Error
                    ? markError.message
                    : String(markError),
              });
            }
          }
        }
      }

      const processingTimeMs = Date.now() - startTime;

      // Get actual counts by checking what happened during this processing cycle
      // For now, we'll use a simple calculation - in production, this could be more sophisticated
      let suppressedCount = 0;

      // Calculate suppressed count from recent queue stats (approximate for current cycle)
      try {
        const currentStats = await MessageQueueService.getQueueStats();
        suppressedCount = currentStats.suppressed;
      } catch (error) {
        logError("Failed to get suppressed count", { error });
        suppressedCount = 0;
      }

      // Updated calculation: exclude suppressed from sent count
      sentCount = Math.max(
        0,
        totalProcessed - rescheduledCount - failedCount - suppressedCount
      );

      logInfo("Queue processing cycle completed", {
        totalProcessed,
        sentCount,
        rescheduledCount,
        failedCount,
        suppressedCount,
        businessCount: businessesProcessed.size,
        processingTimeMs,
      });

      return {
        totalProcessed,
        sentCount,
        rescheduledCount,
        failedCount,
        suppressedCount,
        businessCount: businessesProcessed.size,
        processingTimeMs,
      };
    } catch (error) {
      logError("Queue processing failed", {
        error: error instanceof Error ? error.message : String(error),
        processingTimeMs: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Process all messages for a specific business
   * @param businessId - Business ID
   * @param messages - Messages to process
   */
  private static async processBusinessMessages(
    businessId: number,
    messages: Awaited<
      ReturnType<typeof MessageQueueService.getMessagesReadyToSend>
    >
  ): Promise<void> {
    try {
      // Get business to check timezone
      const bizStorage = storage.forBusiness(businessId);
      const business = await bizStorage.getBusiness();

      logInfo("Processing messages for business", {
        businessId,
        businessName: business.name,
        messageCount: messages.length,
        timezone: business.timezone,
      });

      for (const message of messages) {
        try {
          // Check if it's currently business hours for this business
          const canSendNow = QuietHoursCompliance.canSendImmediately(
            business.timezone,
            message.messageType
          );

          if (!canSendNow) {
            // Still outside business hours - reschedule for next available time
            const nextSendTime = QuietHoursCompliance.getNextSendTime(
              business.timezone
            );
            await MessageQueueService.rescheduleMessage(
              message.id,
              nextSendTime
            );

            logInfo("Message rescheduled - still outside business hours", {
              messageId: message.id,
              businessId,
              currentTime: new Date().toISOString(),
              nextSendTime: nextSendTime.toISOString(),
              timezone: business.timezone,
            });
            continue;
          }

          // Business hours - attempt to send the message
          await this.sendQueuedMessage(bizStorage, message);
        } catch (error) {
          logError("Failed to process individual message", {
            messageId: message.id,
            businessId,
            error: error instanceof Error ? error.message : String(error),
            retryEnabled: ENABLE_MESSAGE_RETRIES,
            attempts: message.attempts,
          });

          // Feature flag: Check if retries are enabled and max attempts not exceeded
          if (message.attempts >= 3 || !ENABLE_MESSAGE_RETRIES) {
            // Mark as failed immediately (retries disabled) OR after max attempts
            const failureReason = !ENABLE_MESSAGE_RETRIES
              ? "Message failed - retries disabled"
              : error instanceof Error
              ? error.message
              : "Max retry attempts exceeded";

            await MessageQueueService.markAsFailed(message.id, failureReason);
          } else {
            // Original retry logic (when retries are enabled and attempts < 3)
            const retryTime = new Date(Date.now() + 15 * 60 * 1000);
            await MessageQueueService.rescheduleMessage(message.id, retryTime);
          }
        }
      }
    } catch (error) {
      logError("Failed to process business messages", {
        businessId,
        messageCount: messages.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Send an individual queued message
   * @param bizStorage - Business storage instance
   * @param queuedMessage - Queued message to send
   */
  private static async sendQueuedMessage(
    bizStorage: IStorage,
    queuedMessage: Awaited<
      ReturnType<typeof MessageQueueService.getMessagesReadyToSend>
    >[0]
  ): Promise<void> {
    try {
      // NEW: Pre-send suppression check for TCPA compliance
      if (queuedMessage.contactId) {
        const contact = await bizStorage.getContact(queuedMessage.contactId);

        if (!contact) {
          await MessageQueueService.markAsSuppressed(
            queuedMessage.id,
            "Contact deleted"
          );
          logInfo("Message suppressed - contact deleted", {
            messageId: queuedMessage.id,
            contactId: queuedMessage.contactId,
            businessId: queuedMessage.businessId,
          });
          return; // Skip sending, return success (not an error)
        }

        if (!contact.active) {
          await MessageQueueService.markAsSuppressed(
            queuedMessage.id,
            "Contact opted out (STOP)"
          );
          logInfo("Message suppressed - contact opted out", {
            messageId: queuedMessage.id,
            contactId: queuedMessage.contactId,
            phoneNumber: queuedMessage.phoneNumber,
            businessId: queuedMessage.businessId,
          });
          return; // Skip sending, return success (not an error)
        }
      }

      const business = await bizStorage.getBusiness();
      const messagingServiceSid = await bizStorage.getMessagingServiceSid();
      const numbers = await bizStorage.getPhoneNumbers();
      const defaultFrom = numbers.find((n: any) => n.isDefault)?.phoneNumber;

      // Parse metadata if present
      let metadata = {};
      if (queuedMessage.metadata) {
        try {
          metadata = JSON.parse(queuedMessage.metadata);
        } catch (parseError) {
          logError("Failed to parse message metadata", {
            messageId: queuedMessage.id,
            metadata: queuedMessage.metadata,
          });
        }
      }

      // Determine if this message should use credits
      const shouldUseCredits = this.shouldUseCredits(queuedMessage.messageType);

      let result;

      if (shouldUseCredits) {
        // Use credit deduction system
        const tempCreds = {
          businessId: business.id,
          accountSid: process.env.TWILIO_ACCOUNT_SID!,
          messagingServiceSid: messagingServiceSid || null,
          createdAt: new Date(),
          updatedAt: new Date(),
          id: 0,
        };

        result = await MessageCreditService.sendWithCreditDeduction(
          bizStorage,
          tempCreds,
          {
            to: queuedMessage.phoneNumber,
            message: queuedMessage.messageContent,
            from: defaultFrom,
            messagingServiceSid: messagingServiceSid ?? undefined,
            contactId: queuedMessage.contactId || undefined,
            messageType: queuedMessage.messageType,
            ...(metadata as any),
          }
        );

        if (!result.success) {
          throw new Error(
            result.error || "Failed to send message with credits"
          );
        }

        // Create message record
        await bizStorage.createMessage({
          phoneNumber: queuedMessage.phoneNumber,
          contactId: queuedMessage.contactId,
          content: queuedMessage.messageContent,
          status: "sent",
          messageType: queuedMessage.messageType,
          billingStatus: result.billingStatus,
          messageSid: result.messageSid,
        });
      } else {
        // Send directly without credits (operational messages)
        const tempCreds = {
          businessId: business.id,
          accountSid: process.env.TWILIO_ACCOUNT_SID!,
          messagingServiceSid: messagingServiceSid || null,
          createdAt: new Date(),
          updatedAt: new Date(),
          id: 0,
        };

        result = await TwilioService.sendSMS(tempCreds, {
          to: queuedMessage.phoneNumber,
          message: queuedMessage.messageContent,
          from: defaultFrom,
          messagingServiceSid: messagingServiceSid ?? undefined,
          contactId: queuedMessage.contactId || undefined,
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to send message directly");
        }
      }

      // Mark message as sent in queue
      await MessageQueueService.markAsSent(queuedMessage.id, result.messageSid);

      logInfo("Queued message sent successfully", {
        messageId: queuedMessage.id,
        businessId: queuedMessage.businessId,
        messageType: queuedMessage.messageType,
        messageSid: result.messageSid,
        usedCredits: shouldUseCredits,
      });
    } catch (error) {
      logError("Failed to send queued message", {
        messageId: queuedMessage.id,
        businessId: queuedMessage.businessId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Determine if message type should use credit system
   * @param messageType - Type of message
   * @returns true if should use credits
   */
  private static shouldUseCredits(messageType: string): boolean {
    // Messages that should use credits (deducted from business)
    const creditMessages = ["welcome", "individual", "test", "campaign"];

    // Messages that are operational/compliance (free)
    const freeMessages = [
      "stop_response",
      "help_response",
      "sms_command_response",
      "system_notification",
    ];

    if (creditMessages.includes(messageType)) {
      return true;
    }

    if (freeMessages.includes(messageType)) {
      return false;
    }

    // Default to using credits for unknown message types
    return true;
  }

  /**
   * Process scheduled campaigns that are ready to be sent
   * Called by background job to check for campaigns scheduled to run
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
      logInfo("Starting scheduled campaigns processing cycle");

      // Get campaigns that are scheduled and ready to send
      const readyCampaigns = await db
        .select()
        .from(campaigns)
        .where(
          and(
            eq(campaigns.status, "scheduled"),
            eq(campaigns.schedulingType, "scheduled"),
            lte(campaigns.scheduledSendTime, new Date())
          )
        );

      if (readyCampaigns.length === 0) {
        logInfo("No scheduled campaigns ready for processing");
        return {
          totalProcessed: 0,
          sentCount: 0,
          failedCount: 0,
          campaignCount: 0,
          processingTimeMs: Date.now() - startTime,
        };
      }

      logInfo(`Processing ${readyCampaigns.length} scheduled campaigns`);

      for (const campaign of readyCampaigns) {
        try {
          totalProcessed++;
          campaignCount++;

          const bizStorage = storage.forBusiness(campaign.businessId);

          logInfo("Executing scheduled campaign", {
            campaignId: campaign.id,
            businessId: campaign.businessId,
            scheduledFor: campaign.scheduledSendTime,
            campaignName: campaign.name,
          });

          // Execute the campaign using existing logic
          const results = await executeCampaign(bizStorage, campaign.id);

          // Update campaign status to completed
          await bizStorage.updateCampaign(campaign.id, {
            status: "completed",
            sentCount: results.totalProcessed,
            deliveredCount: results.sentCount,
          });

          sentCount++;

          logInfo("Scheduled campaign executed successfully", {
            campaignId: campaign.id,
            businessId: campaign.businessId,
            sentCount: results.sentCount,
            queuedCount: results.queuedCount,
            failedCount: results.failedCount,
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
              status: "completed", // Still mark as completed to prevent retry loops
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
