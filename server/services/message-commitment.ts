import { db } from "../config/db.config.js";
import { committedMessages } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { MessageCreditService } from "./message-credits.js";
import { logInfo, logError } from "../utils/logger.util.js";
import type { IStorage } from "../db/storage.js";
import type { CommittedMessage, InsertCommittedMessage } from "@shared/schema";

export interface CommitMessageParams {
  businessId: number;
  phoneNumber: string;
  messageContent: string;
  messageType: string;
  contactId?: number;
  campaignId?: number;
  metadata?: any;
  from?: string;
  messagingServiceSid?: string;
  mediaUrl?: string;
}

export interface CommitmentResult {
  success: boolean;
  committedMessages?: CommittedMessage[];
  error?: string;
  totalCreditsDeducted: number;
  remainingCredits: number;
}

/**
 * MessageCommitmentService
 * Handles immediate credit deduction and message commitment for fair processing
 * This is the new entry point that replaces immediate sending
 */
export class MessageCommitmentService {
  /**
   * Commit messages for processing - DEDUCT CREDITS IMMEDIATELY
   * This is the core function that ensures credits are deducted before any processing begins
   */
  static async commitMessages(
    bizStorage: IStorage,
    messages: CommitMessageParams[]
  ): Promise<CommitmentResult> {
    if (messages.length === 0) {
      return {
        success: true,
        committedMessages: [],
        totalCreditsDeducted: 0,
        remainingCredits: (await bizStorage.getCredits())?.balance || 0,
      };
    }

    try {
      logInfo("Starting message commitment process", {
        businessId: messages[0].businessId,
        messageCount: messages.length,
        messageTypes: [...new Set(messages.map((m) => m.messageType))],
      });

      return await db.transaction(async (tx) => {
        // 1. Calculate total credit cost
        const totalCost = messages.reduce((sum, msg) => {
          return (
            sum +
            MessageCreditService.calculateCreditCost(
              msg.messageContent,
              !!msg.mediaUrl
            )
          );
        }, 0);

        logInfo("Calculated total credit cost", {
          businessId: messages[0].businessId,
          totalCost,
          messageCount: messages.length,
          averageCostPerMessage: totalCost / messages.length,
        });

        // 2. Check and deduct credits FIRST (atomic operation)
        const currentCredits = await bizStorage.getCredits();
        const currentBalance = currentCredits?.balance || 0;

        if (currentBalance < totalCost) {
          const error = `Insufficient credits. Need ${totalCost}, have ${currentBalance}`;
          logError("Credit commitment failed", {
            businessId: messages[0].businessId,
            totalCost,
            currentBalance,
            shortfall: totalCost - currentBalance,
          });
          throw new Error(error);
        }

        // 3. Deduct credits immediately - this is the KEY change
        const updatedCredits = await bizStorage.adjustCredits(
          -totalCost,
          "message_commitment",
          `Committed ${messages.length} messages for fair processing`,
          {
            messageCount: messages.length,
            totalCost,
            messageTypes: messages.map((m) => m.messageType),
            timestamp: new Date().toISOString(),
          }
        );

        logInfo("Credits deducted successfully", {
          businessId: messages[0].businessId,
          totalDeducted: totalCost,
          previousBalance: currentBalance,
          remainingBalance: updatedCredits.balance,
        });

        // 4. Create committed message records
        const commitData: InsertCommittedMessage[] = messages.map((msg) => ({
          businessId: msg.businessId,
          phoneNumber: msg.phoneNumber,
          messageContent: msg.messageContent,
          messageType: msg.messageType,
          contactId: msg.contactId || null,
          campaignId: msg.campaignId || null,
          creditsDeducted: MessageCreditService.calculateCreditCost(
            msg.messageContent,
            !!msg.mediaUrl
          ),
          status: "pending",
          processingPriority: 0, // Default priority
          processingAttempts: 0,
          metadata: JSON.stringify({
            from: msg.from,
            messagingServiceSid: msg.messagingServiceSid,
            mediaUrl: msg.mediaUrl,
            originalTimestamp: new Date().toISOString(),
            ...msg.metadata,
          }),
        }));

        const insertedMessages = await tx
          .insert(committedMessages)
          .values(commitData)
          .returning();

        logInfo("Messages committed successfully", {
          businessId: messages[0].businessId,
          committedCount: insertedMessages.length,
          totalCreditsDeducted: totalCost,
          remainingCredits: updatedCredits.balance,
          commitmentIds: insertedMessages.map((m) => m.id),
        });

        return {
          success: true,
          committedMessages: insertedMessages as CommittedMessage[],
          totalCreditsDeducted: totalCost,
          remainingCredits: updatedCredits.balance,
        };
      });
    } catch (error) {
      logError("Failed to commit messages", {
        businessId: messages[0]?.businessId,
        messageCount: messages.length,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        totalCreditsDeducted: 0,
        remainingCredits: (await bizStorage.getCredits())?.balance || 0,
      };
    }
  }

  /**
   * Get pending committed messages for fair processing
   */
  static async getPendingMessages(limit = 100): Promise<CommittedMessage[]> {
    try {
      const messages = await db
        .select()
        .from(committedMessages)
        .where(eq(committedMessages.status, "pending"))
        .orderBy(
          committedMessages.processingPriority,
          committedMessages.createdAt
        )
        .limit(limit);

      return messages as CommittedMessage[];
    } catch (error) {
      logError("Failed to get pending messages", { error, limit });
      throw error;
    }
  }

  /**
   * Get pending messages grouped by business for fair distribution
   */
  static async getPendingMessagesByBusiness(): Promise<
    Map<number, CommittedMessage[]>
  > {
    try {
      const messages = await this.getPendingMessages(500); // Process in larger batches
      const messagesByBusiness = new Map<number, CommittedMessage[]>();

      for (const message of messages) {
        if (!messagesByBusiness.has(message.businessId)) {
          messagesByBusiness.set(message.businessId, []);
        }
        messagesByBusiness.get(message.businessId)!.push(message);
      }

      logInfo("Retrieved pending messages by business", {
        totalMessages: messages.length,
        businessCount: messagesByBusiness.size,
        businessDistribution: Array.from(messagesByBusiness.entries()).map(
          ([businessId, msgs]) => ({
            businessId,
            messageCount: msgs.length,
          })
        ),
      });

      return messagesByBusiness;
    } catch (error) {
      logError("Failed to get pending messages by business", { error });
      throw error;
    }
  }

  /**
   * Mark committed message as sent
   */
  static async markAsSent(
    messageId: number,
    twilioMessageSid: string
  ): Promise<void> {
    try {
      await db
        .update(committedMessages)
        .set({
          status: "sent",
          twilioMessageSid,
          processedAt: new Date(),
        })
        .where(eq(committedMessages.id, messageId));

      logInfo("Committed message marked as sent", {
        messageId,
        twilioMessageSid,
      });
    } catch (error) {
      logError("Failed to mark committed message as sent", {
        messageId,
        twilioMessageSid,
        error,
      });
      throw error;
    }
  }

  /**
   * Mark committed message as failed
   */
  static async markAsFailed(
    messageId: number,
    errorMessage: string
  ): Promise<void> {
    try {
      await db
        .update(committedMessages)
        .set({
          status: "failed",
          errorMessage,
          processedAt: new Date(),
          processingAttempts: sql`${committedMessages.processingAttempts} + 1`,
        })
        .where(eq(committedMessages.id, messageId));

      logError("Committed message marked as failed", {
        messageId,
        errorMessage,
      });
    } catch (error) {
      logError("Failed to mark committed message as failed", {
        messageId,
        errorMessage,
        error,
      });
      throw error;
    }
  }

  /**
   * Mark committed message as suppressed (opt-out)
   */
  static async markAsSuppressed(
    messageId: number,
    reason: string
  ): Promise<void> {
    try {
      await db
        .update(committedMessages)
        .set({
          status: "suppressed",
          errorMessage: `Suppressed: ${reason}`,
          processedAt: new Date(),
        })
        .where(eq(committedMessages.id, messageId));

      logInfo("Committed message marked as suppressed", {
        messageId,
        reason,
      });
    } catch (error) {
      logError("Failed to mark committed message as suppressed", {
        messageId,
        reason,
        error,
      });
      throw error;
    }
  }

  /**
   * Get statistics for committed messages
   */
  static async getStats(): Promise<{
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    suppressed: number;
    total: number;
  }> {
    try {
      const [pending, processing, sent, failed, suppressed] = await Promise.all(
        [
          db
            .select({ count: sql<number>`count(*)` })
            .from(committedMessages)
            .where(eq(committedMessages.status, "pending")),
          db
            .select({ count: sql<number>`count(*)` })
            .from(committedMessages)
            .where(eq(committedMessages.status, "processing")),
          db
            .select({ count: sql<number>`count(*)` })
            .from(committedMessages)
            .where(eq(committedMessages.status, "sent")),
          db
            .select({ count: sql<number>`count(*)` })
            .from(committedMessages)
            .where(eq(committedMessages.status, "failed")),
          db
            .select({ count: sql<number>`count(*)` })
            .from(committedMessages)
            .where(eq(committedMessages.status, "suppressed")),
        ]
      );

      const stats = {
        pending: pending[0]?.count || 0,
        processing: processing[0]?.count || 0,
        sent: sent[0]?.count || 0,
        failed: failed[0]?.count || 0,
        suppressed: suppressed[0]?.count || 0,
        total: 0,
      };

      stats.total =
        stats.pending +
        stats.processing +
        stats.sent +
        stats.failed +
        stats.suppressed;

      return stats;
    } catch (error) {
      logError("Failed to get commitment stats", { error });
      throw error;
    }
  }

  /**
   * Get business-specific statistics
   */
  static async getBusinessStats(businessId: number): Promise<{
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    suppressed: number;
    total: number;
  }> {
    try {
      const [pending, processing, sent, failed, suppressed] = await Promise.all(
        [
          db
            .select({ count: sql<number>`count(*)` })
            .from(committedMessages)
            .where(
              sql`${committedMessages.businessId} = ${businessId} AND ${committedMessages.status} = 'pending'`
            ),
          db
            .select({ count: sql<number>`count(*)` })
            .from(committedMessages)
            .where(
              sql`${committedMessages.businessId} = ${businessId} AND ${committedMessages.status} = 'processing'`
            ),
          db
            .select({ count: sql<number>`count(*)` })
            .from(committedMessages)
            .where(
              sql`${committedMessages.businessId} = ${businessId} AND ${committedMessages.status} = 'sent'`
            ),
          db
            .select({ count: sql<number>`count(*)` })
            .from(committedMessages)
            .where(
              sql`${committedMessages.businessId} = ${businessId} AND ${committedMessages.status} = 'failed'`
            ),
          db
            .select({ count: sql<number>`count(*)` })
            .from(committedMessages)
            .where(
              sql`${committedMessages.businessId} = ${businessId} AND ${committedMessages.status} = 'suppressed'`
            ),
        ]
      );

      const stats = {
        pending: pending[0]?.count || 0,
        processing: processing[0]?.count || 0,
        sent: sent[0]?.count || 0,
        failed: failed[0]?.count || 0,
        suppressed: suppressed[0]?.count || 0,
        total: 0,
      };

      stats.total =
        stats.pending +
        stats.processing +
        stats.sent +
        stats.failed +
        stats.suppressed;

      return stats;
    } catch (error) {
      logError("Failed to get business commitment stats", {
        businessId,
        error,
      });
      throw error;
    }
  }

  /**
   * Clean up old processed messages (for maintenance)
   */
  static async cleanupOldMessages(olderThanDays = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await db.delete(committedMessages).where(sql`
          ${committedMessages.processedAt} <= ${cutoffDate} 
          AND ${committedMessages.status} IN ('sent', 'failed', 'suppressed')
        `);

      const deletedCount = result.rowCount || 0;

      logInfo("Cleaned up old committed messages", {
        deletedCount,
        olderThanDays,
        cutoffDate: cutoffDate.toISOString(),
      });

      return deletedCount;
    } catch (error) {
      logError("Failed to cleanup old committed messages", {
        olderThanDays,
        error,
      });
      throw error;
    }
  }
}
