import { db } from "../config/db.config.js";
import { messageQueue } from "@shared/schema";
import { eq, and, lte, desc, sql } from "drizzle-orm";
import { logInfo, logError } from "../utils/logger.util.js";
import type { MessageQueue, InsertMessageQueue } from "@shared/schema";

/**
 * MessageQueueService
 * Handles queuing and processing of delayed messages for TCPA compliance
 */
export class MessageQueueService {
  /**
   * Queue a message for later delivery
   * @param params - Message queue parameters
   */
  static async queueMessage(params: {
    businessId: number;
    contactId?: number;
    phoneNumber: string;
    messageContent: string;
    messageType: string;
    scheduledFor: Date;
    metadata?: any;
  }): Promise<MessageQueue> {
    try {
      const [queuedMessage] = await db
        .insert(messageQueue)
        .values({
          businessId: params.businessId,
          contactId: params.contactId || null,
          phoneNumber: params.phoneNumber,
          messageContent: params.messageContent,
          messageType: params.messageType,
          scheduledFor: params.scheduledFor,
          metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        })
        .returning();

      logInfo("Message queued for later delivery", {
        messageId: queuedMessage.id,
        businessId: params.businessId,
        messageType: params.messageType,
        scheduledFor: params.scheduledFor.toISOString(),
      });

      return queuedMessage;
    } catch (error) {
      logError("Failed to queue message", { error, params });
      throw error;
    }
  }

  /**
   * Get messages ready to be sent
   * @param limit - Maximum number of messages to retrieve
   * @returns Array of messages ready for sending
   */
  static async getMessagesReadyToSend(limit = 100): Promise<MessageQueue[]> {
    try {
      const messages = await db
        .select()
        .from(messageQueue)
        .where(
          and(
            eq(messageQueue.status, "pending"),
            lte(messageQueue.scheduledFor, new Date())
          )
        )
        .orderBy(messageQueue.scheduledFor)
        .limit(limit);

      return messages;
    } catch (error) {
      logError("Failed to fetch messages ready to send", error);
      throw error;
    }
  }

  /**
   * Mark a message as successfully sent
   * @param messageId - ID of the message
   * @param messageSid - Optional Twilio message SID for tracking
   */
  static async markAsSent(
    messageId: number,
    messageSid?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status: "sent",
        sentAt: new Date(),
      };

      // Add messageSid to metadata if provided
      if (messageSid) {
        updateData.metadata = JSON.stringify({ messageSid });
      }

      await db
        .update(messageQueue)
        .set(updateData)
        .where(eq(messageQueue.id, messageId));

      logInfo("Message marked as sent", { messageId, messageSid });
    } catch (error) {
      logError("Failed to mark message as sent", {
        error,
        messageId,
        messageSid,
      });
      throw error;
    }
  }

  /**
   * Mark a message as failed with error details
   * @param messageId - ID of the message
   * @param errorMessage - Error description
   */
  static async markAsFailed(
    messageId: number,
    errorMessage: string
  ): Promise<void> {
    try {
      await db
        .update(messageQueue)
        .set({
          status: "failed",
          errorMessage,
          attempts: sql`${messageQueue.attempts} + 1`,
        })
        .where(eq(messageQueue.id, messageId));

      logError("Message marked as failed", {
        messageId,
        errorMessage,
      });
    } catch (error) {
      logError("Failed to mark message as failed", { error, messageId });
      throw error;
    }
  }

  /**
   * Reschedule a message for later delivery
   * @param messageId - ID of the message
   * @param newScheduledTime - New scheduled delivery time
   */
  static async rescheduleMessage(
    messageId: number,
    newScheduledTime: Date
  ): Promise<void> {
    try {
      await db
        .update(messageQueue)
        .set({
          scheduledFor: newScheduledTime,
          attempts: sql`${messageQueue.attempts} + 1`,
        })
        .where(eq(messageQueue.id, messageId));

      logInfo("Message rescheduled", {
        messageId,
        newScheduledTime: newScheduledTime.toISOString(),
      });
    } catch (error) {
      logError("Failed to reschedule message", { error, messageId });
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  static async getQueueStats() {
    try {
      const [pending, processing, sent, failed] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(messageQueue)
          .where(eq(messageQueue.status, "pending")),
        db
          .select({ count: sql<number>`count(*)` })
          .from(messageQueue)
          .where(eq(messageQueue.status, "processing")),
        db
          .select({ count: sql<number>`count(*)` })
          .from(messageQueue)
          .where(eq(messageQueue.status, "sent")),
        db
          .select({ count: sql<number>`count(*)` })
          .from(messageQueue)
          .where(eq(messageQueue.status, "failed")),
      ]);

      return {
        pending: pending[0]?.count || 0,
        processing: processing[0]?.count || 0,
        sent: sent[0]?.count || 0,
        failed: failed[0]?.count || 0,
        total:
          (pending[0]?.count || 0) +
          (processing[0]?.count || 0) +
          (sent[0]?.count || 0) +
          (failed[0]?.count || 0),
      };
    } catch (error) {
      logError("Failed to get queue stats", { error });
      throw error;
    }
  }

  /**
   * Get pending messages (paginated)
   */
  static async getPendingMessages(page: number = 1, limit: number = 50) {
    try {
      const offset = (page - 1) * limit;

      const messages = await db
        .select()
        .from(messageQueue)
        .where(eq(messageQueue.status, "pending"))
        .orderBy(desc(messageQueue.scheduledFor))
        .limit(limit)
        .offset(offset);

      logInfo("Retrieved pending messages", {
        count: messages.length,
        page,
        limit,
      });

      return messages;
    } catch (error) {
      logError("Failed to get pending messages", { error, page, limit });
      throw error;
    }
  }

  /**
   * Get failed messages (paginated)
   */
  static async getFailedMessages(page: number = 1, limit: number = 50) {
    try {
      const offset = (page - 1) * limit;

      const messages = await db
        .select()
        .from(messageQueue)
        .where(eq(messageQueue.status, "failed"))
        .orderBy(desc(messageQueue.createdAt))
        .limit(limit)
        .offset(offset);

      logInfo("Retrieved failed messages", {
        count: messages.length,
        page,
        limit,
      });

      return messages;
    } catch (error) {
      logError("Failed to get failed messages", { error, page, limit });
      throw error;
    }
  }

  /**
   * Clean up old processed messages
   * @param olderThanDays - Remove messages older than this many days
   */
  static async cleanupOldMessages(olderThanDays = 7): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await db
        .delete(messageQueue)
        .where(
          and(
            lte(messageQueue.createdAt, cutoffDate),
            eq(messageQueue.status, "sent")
          )
        );

      const deletedCount = result.rowCount || 0;

      logInfo("Cleaned up old sent messages", {
        deletedCount,
        olderThanDays,
        cutoffDate: cutoffDate.toISOString(),
      });

      return deletedCount;
    } catch (error) {
      logError("Failed to cleanup old messages", { error, olderThanDays });
      throw error;
    }
  }

  /**
   * Get messages for a specific business (for admin/debugging)
   * @param businessId - Business ID
   * @param limit - Maximum messages to return
   */
  static async getBusinessMessages(
    businessId: number,
    limit = 50
  ): Promise<MessageQueue[]> {
    try {
      const messages = await db
        .select()
        .from(messageQueue)
        .where(eq(messageQueue.businessId, businessId))
        .orderBy(desc(messageQueue.createdAt))
        .limit(limit);

      return messages;
    } catch (error) {
      logError("Failed to get business messages", { error, businessId });
      throw error;
    }
  }
}
