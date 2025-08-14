import { db } from "../config/db.config.js";
import { campaigns, messages } from "@shared/schema";
import { count, sql } from "drizzle-orm";
import { logInfo, logError } from "../utils/logger.util.js";
import type { IStorage } from "../db/storage.js";

/**
 * CampaignCompletionService
 *
 * Handles campaign completion detection for both status transitions and direct message creation.
 * This service addresses the issue where Fair Processor V2 creates messages directly with "sent"
 * status, bypassing the traditional completion detection logic that only triggers on status transitions.
 *
 * Key Features:
 * - Works with all message creation patterns (direct creation and status transitions)
 * - Accurately calculates sentCount and deliveredCount from actual database state
 * - Determines campaign completion when all messages reach terminal states
 * - Handles failure rate calculation (≥80% failed = campaign failed)
 * - Production-safe with comprehensive logging and error handling
 */
export class CampaignCompletionService {
  /**
   * Check and update campaign completion status
   *
   * This method:
   * 1. Counts all messages for the campaign
   * 2. Counts messages in terminal states (sent, delivered, failed)
   * 3. Updates campaign sentCount and deliveredCount with accurate counts
   * 4. Determines if campaign is complete and updates status accordingly
   *
   * @param bizStorage - Business storage instance
   * @param campaignId - ID of the campaign to check
   * @param businessId - Business ID for security/isolation
   */
  static async checkCampaignCompletion(
    bizStorage: IStorage,
    campaignId: number,
    businessId: number
  ): Promise<void> {
    try {
      logInfo("Checking campaign completion", {
        campaignId,
        businessId,
      });

      // Get total messages for this campaign
      const [total] = await db
        .select({ count: count() })
        .from(messages)
        .where(
          sql`${messages.campaignId} = ${campaignId} AND ${messages.businessId} = ${businessId}`
        );

      // Get messages in terminal states (sent, delivered, failed)
      const [terminal] = await db
        .select({ count: count() })
        .from(messages)
        .where(
          sql`${messages.campaignId} = ${campaignId} AND ${messages.businessId} = ${businessId} AND ${messages.status} IN ('sent','delivered','failed')`
        );

      // Get accurate sent count (sent + delivered)
      const [sentCount] = await db
        .select({ count: count() })
        .from(messages)
        .where(
          sql`${messages.campaignId} = ${campaignId} AND ${messages.businessId} = ${businessId} AND ${messages.status} IN ('sent','delivered')`
        );

      // Get accurate delivered count
      const [deliveredCount] = await db
        .select({ count: count() })
        .from(messages)
        .where(
          sql`${messages.campaignId} = ${campaignId} AND ${messages.businessId} = ${businessId} AND ${messages.status} = 'delivered'`
        );

      // Get failed count for failure rate calculation
      const [failedCount] = await db
        .select({ count: count() })
        .from(messages)
        .where(
          sql`${messages.campaignId} = ${campaignId} AND ${messages.businessId} = ${businessId} AND ${messages.status} = 'failed'`
        );

      logInfo("Campaign completion counts", {
        campaignId,
        businessId,
        totalMessages: total.count,
        terminalMessages: terminal.count,
        sentMessages: sentCount.count,
        deliveredMessages: deliveredCount.count,
        failedMessages: failedCount.count,
      });

      // Always update campaign counts to reflect accurate state
      await db
        .update(campaigns)
        .set({
          sentCount: sentCount.count,
          deliveredCount: deliveredCount.count,
          updatedAt: new Date(),
        })
        .where(
          sql`${campaigns.id} = ${campaignId} AND ${campaigns.businessId} = ${businessId}`
        );

      logInfo("Updated campaign counts", {
        campaignId,
        businessId,
        sentCount: sentCount.count,
        deliveredCount: deliveredCount.count,
      });

      // Check for campaign completion
      if (total.count > 0 && terminal.count === total.count) {
        // All messages have reached terminal states - campaign is complete
        const failureRate = failedCount.count / total.count;
        const newStatus = failureRate >= 0.8 ? "failed" : "completed";

        await db
          .update(campaigns)
          .set({
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(
            sql`${campaigns.id} = ${campaignId} AND ${campaigns.businessId} = ${businessId}`
          );

        logInfo("Campaign status updated to completion", {
          campaignId,
          businessId,
          newStatus,
          totalMessages: total.count,
          sentMessages: sentCount.count,
          deliveredMessages: deliveredCount.count,
          failedMessages: failedCount.count,
          failureRate: Math.round(failureRate * 100) + "%",
        });
      } else {
        logInfo("Campaign not yet complete", {
          campaignId,
          businessId,
          totalMessages: total.count,
          terminalMessages: terminal.count,
          pendingMessages: total.count - terminal.count,
        });
      }
    } catch (error) {
      logError("Failed to check campaign completion", {
        error: error instanceof Error ? error.message : String(error),
        campaignId,
        businessId,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Don't throw - this should not break the main message flow
      // Campaign completion is important but not critical enough to fail message operations
    }
  }

  /**
   * Batch check multiple campaigns for completion
   * Useful for processing multiple campaigns efficiently
   *
   * @param bizStorage - Business storage instance
   * @param campaignIds - Array of campaign IDs to check
   * @param businessId - Business ID for security/isolation
   */
  static async checkMultipleCampaignCompletion(
    bizStorage: IStorage,
    campaignIds: number[],
    businessId: number
  ): Promise<void> {
    if (campaignIds.length === 0) return;

    logInfo("Checking multiple campaign completions", {
      campaignIds,
      businessId,
      count: campaignIds.length,
    });

    // Process campaigns in parallel for better performance
    const promises = campaignIds.map((campaignId) =>
      this.checkCampaignCompletion(bizStorage, campaignId, businessId)
    );

    await Promise.allSettled(promises);
  }
}
