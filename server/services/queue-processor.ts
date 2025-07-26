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

export interface QueueProcessingStats {
  totalProcessed: number;
  sentCount: number;
  rescheduledCount: number;
  failedCount: number;
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

      // Get actual counts by re-checking what happened
      // (This is approximate since we're processing in parallel)
      sentCount = Math.max(0, totalProcessed - rescheduledCount - failedCount);

      logInfo("Queue processing cycle completed", {
        totalProcessed,
        sentCount,
        rescheduledCount,
        failedCount,
        businessCount: businessesProcessed.size,
        processingTimeMs,
      });

      return {
        totalProcessed,
        sentCount,
        rescheduledCount,
        failedCount,
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
          });

          // Mark message as failed after max attempts
          if (message.attempts >= 3) {
            await MessageQueueService.markAsFailed(
              message.id,
              error instanceof Error
                ? error.message
                : "Max retry attempts exceeded"
            );
          } else {
            // Reschedule for retry (15 minutes later)
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
}
