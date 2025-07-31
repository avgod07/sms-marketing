import { MessageCommitmentService } from "./message-commitment.js";
import { UniversalMessageService } from "./universal-message.js";
import { QuietHoursCompliance } from "./quiet-hours-compliance.js";
import { MessageQueueService } from "./message-queue.js";
import { storage } from "../db/storage.js";
import { logInfo, logError } from "../utils/logger.util.js";
import type { CommitMessageParams } from "./message-commitment.js";
import type { CommittedMessage } from "@shared/schema";

export interface ProcessingStats {
  totalProcessed: number;
  sentCount: number;
  queuedCount: number;
  failedCount: number;
  suppressedCount: number;
  businessCount: number;
  processingTimeMs: number;
}

/**
 * FairRateLimitedProcessorV2
 * Database-backed fair message processing with immediate credit deduction
 * This completely replaces the old in-memory fair processor
 */
export class FairRateLimitedProcessorV2 {
  private static isProcessing = false;
  private static readonly ACCOUNT_MPS_LIMIT = parseInt(
    process.env.TWILIO_ACCOUNT_MPS_LIMIT || "25"
  );
  private static readonly MESSAGES_PER_BUSINESS_PER_CYCLE = parseInt(
    process.env.MESSAGES_PER_BUSINESS_PER_CYCLE || "3"
  );
  private static readonly CYCLE_INTERVAL_MS = 1000; // 1 second between cycles

  /**
   * Add messages to processing - CREDITS ALREADY DEDUCTED
   * This is the new entry point for campaigns and bulk messaging
   */
  static async addBusinessMessages(
    businessId: number,
    messages: CommitMessageParams[]
  ): Promise<ProcessingStats> {
    const startTime = Date.now();

    try {
      const bizStorage = storage.forBusiness(businessId);

      logInfo("Adding business messages to fair processor", {
        businessId,
        messageCount: messages.length,
        messageTypes: [...new Set(messages.map((m) => m.messageType))],
      });

      // Commit messages with immediate credit deduction
      const commitmentResult = await MessageCommitmentService.commitMessages(
        bizStorage,
        messages
      );

      if (!commitmentResult.success) {
        throw new Error(commitmentResult.error || "Failed to commit messages");
      }

      logInfo("Messages committed for fair processing", {
        businessId,
        messageCount: messages.length,
        creditsDeducted: commitmentResult.totalCreditsDeducted,
        remainingCredits: commitmentResult.remainingCredits,
        committedMessageIds: commitmentResult.committedMessages?.map(
          (m) => m.id
        ),
      });

      // Start processing if not already running (non-blocking)
      if (!this.isProcessing) {
        setImmediate(() => this.startProcessing());
      }

      return {
        totalProcessed: commitmentResult.committedMessages?.length || 0,
        sentCount: 0, // Will be processed asynchronously
        queuedCount: commitmentResult.committedMessages?.length || 0,
        failedCount: 0,
        suppressedCount: 0,
        businessCount: 1,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logError("Failed to add business messages", {
        businessId,
        messageCount: messages.length,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Process TCPA queue messages through fair distribution
   * This handles messages that were queued due to quiet hours
   */
  static async processQueuedMessages(
    messagesByBusiness: Map<number, Array<any>>
  ): Promise<ProcessingStats> {
    const startTime = Date.now();

    try {
      logInfo("Processing TCPA queued messages through fair processor", {
        businessCount: messagesByBusiness.size,
        totalMessages: Array.from(messagesByBusiness.values()).reduce(
          (sum, msgs) => sum + msgs.length,
          0
        ),
      });

      // Convert TCPA queue messages to committed messages format
      const allCommitments: Promise<ProcessingStats>[] = [];

      for (const [businessId, messages] of messagesByBusiness) {
        // Convert queue messages to commitment format
        const commitMessages: CommitMessageParams[] = messages.map((msg) => {
          let metadata: any = {};
          try {
            metadata = JSON.parse(msg.metadata || "{}");
          } catch (parseError) {
            logError("Failed to parse TCPA message metadata", {
              messageId: msg.id,
              metadata: msg.metadata,
            });
          }

          return {
            businessId,
            phoneNumber: msg.phoneNumber,
            messageContent: msg.messageContent,
            messageType: msg.messageType,
            contactId: msg.contactId,
            campaignId: metadata.campaignId || undefined,
            from: metadata.from || undefined,
            messagingServiceSid: metadata.messagingServiceSid || undefined,
            mediaUrl: metadata.mediaUrl || undefined,
            metadata: {
              originalTcpaMessageId: msg.id,
              tcpaScheduledFor: msg.scheduledFor,
              ...metadata,
            },
          };
        });

        // Process through fair system with credit deduction
        allCommitments.push(
          this.addBusinessMessages(businessId, commitMessages)
        );
      }

      const results = await Promise.allSettled(allCommitments);

      // Aggregate results
      let totalProcessed = 0;
      let queuedCount = 0;
      let failedCount = 0;
      const businessesProcessed = new Set<number>();

      results.forEach((result, index) => {
        const businessId = Array.from(messagesByBusiness.keys())[index];
        businessesProcessed.add(businessId);

        if (result.status === "fulfilled") {
          totalProcessed += result.value.totalProcessed;
          queuedCount += result.value.queuedCount;
        } else {
          failedCount++;
          logError("Failed to process business messages in TCPA fair queue", {
            businessId,
            error: result.reason,
          });
        }
      });

      logInfo("TCPA messages processed through fair processor", {
        totalProcessed,
        queuedCount,
        failedCount,
        businessCount: businessesProcessed.size,
        processingTimeMs: Date.now() - startTime,
      });

      return {
        totalProcessed,
        sentCount: 0, // Will be processed asynchronously
        queuedCount,
        failedCount,
        suppressedCount: 0,
        businessCount: businessesProcessed.size,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logError("Critical error processing TCPA messages", {
        error: error instanceof Error ? error.message : String(error),
        processingTimeMs: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Start fair processing of committed messages
   * This runs in the background and processes messages fairly across businesses
   */
  private static async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      logInfo("Fair processing already running, skipping start");
      return;
    }

    this.isProcessing = true;
    logInfo("Starting fair processing of committed messages");

    try {
      let cycleCount = 0;
      while (await this.hasPendingMessages()) {
        cycleCount++;
        const messagesByBusiness =
          await MessageCommitmentService.getPendingMessagesByBusiness();

        if (messagesByBusiness.size === 0) {
          logInfo("No pending messages found, ending processing cycle");
          break;
        }

        logInfo(`Starting fair processing cycle ${cycleCount}`, {
          businessCount: messagesByBusiness.size,
          totalMessages: Array.from(messagesByBusiness.values()).reduce(
            (sum, msgs) => sum + msgs.length,
            0
          ),
        });

        await this.processFairCycle(messagesByBusiness);

        // Rate limiting between cycles
        await this.sleep(this.CYCLE_INTERVAL_MS);
      }

      logInfo("Fair processing completed", { totalCycles: cycleCount });
    } catch (error) {
      logError("Critical error in fair processing", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    } finally {
      this.isProcessing = false;
      logInfo("Fair processing cycle ended");
    }
  }

  /**
   * Process one fair cycle across all businesses
   * Takes messages from each business in round-robin fashion
   */
  private static async processFairCycle(
    messagesByBusiness: Map<number, CommittedMessage[]>
  ): Promise<void> {
    const cycleBatch: Array<{ businessId: number; message: CommittedMessage }> =
      [];

    // Round-robin: Take messages from each business
    for (const [businessId, messages] of messagesByBusiness) {
      if (messages.length === 0) continue;

      const businessBatch = messages.splice(
        0,
        this.MESSAGES_PER_BUSINESS_PER_CYCLE
      );
      for (const message of businessBatch) {
        cycleBatch.push({ businessId, message });

        // Respect account-level limit
        if (cycleBatch.length >= this.ACCOUNT_MPS_LIMIT) break;
      }
      if (cycleBatch.length >= this.ACCOUNT_MPS_LIMIT) break;
    }

    if (cycleBatch.length === 0) {
      logInfo("No messages in cycle batch, skipping");
      return;
    }

    logInfo("Processing fair cycle batch", {
      batchSize: cycleBatch.length,
      businessCount: new Set(cycleBatch.map((item) => item.businessId)).size,
      accountMpsLimit: this.ACCOUNT_MPS_LIMIT,
    });

    // Process batch in parallel with Promise.allSettled for resilience
    const results = await Promise.allSettled(
      cycleBatch.map(({ businessId, message }) =>
        this.processCommittedMessage(businessId, message)
      )
    );

    // Handle results and update message statuses
    results.forEach((result, index) => {
      const { businessId, message } = cycleBatch[index];

      if (result.status === "rejected") {
        logError("Failed to process committed message in cycle", {
          businessId,
          messageId: message.id,
          phoneNumber: message.phoneNumber,
          messageType: message.messageType,
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });

        // Mark as failed in database
        MessageCommitmentService.markAsFailed(
          message.id,
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason)
        ).catch((markError) => {
          logError("Failed to mark message as failed", {
            messageId: message.id,
            markError,
          });
        });
      }
    });

    logInfo("Fair cycle batch completed", {
      batchSize: cycleBatch.length,
      successCount: results.filter((r) => r.status === "fulfilled").length,
      failureCount: results.filter((r) => r.status === "rejected").length,
    });
  }

  /**
   * Process individual committed message using PROVEN services
   * Credits are already deducted, so we focus on delivery
   */
  private static async processCommittedMessage(
    businessId: number,
    committedMessage: CommittedMessage
  ): Promise<void> {
    try {
      const bizStorage = storage.forBusiness(businessId);

      logInfo("Processing committed message", {
        businessId,
        messageId: committedMessage.id,
        messageType: committedMessage.messageType,
        phoneNumber: committedMessage.phoneNumber,
        creditsDeducted: committedMessage.creditsDeducted,
      });

      // Check if contact is still active (TCPA compliance)
      if (committedMessage.contactId) {
        const contact = await bizStorage.getContact(committedMessage.contactId);

        if (!contact) {
          await MessageCommitmentService.markAsSuppressed(
            committedMessage.id,
            "Contact deleted"
          );
          logInfo("Message suppressed - contact deleted", {
            messageId: committedMessage.id,
            contactId: committedMessage.contactId,
          });
          return;
        }

        if (!contact.active) {
          await MessageCommitmentService.markAsSuppressed(
            committedMessage.id,
            "Contact opted out (STOP)"
          );
          logInfo("Message suppressed - contact opted out", {
            messageId: committedMessage.id,
            contactId: committedMessage.contactId,
          });
          return;
        }
      }

      const business = await bizStorage.getBusiness();
      const metadata = JSON.parse(committedMessage.metadata || "{}");

      // Check TCPA quiet hours compliance
      const canSendNow = QuietHoursCompliance.canSendImmediately(
        business.timezone,
        committedMessage.messageType
      );

      if (!canSendNow) {
        // Queue for later delivery using existing TCPA queue
        const nextSendTime = QuietHoursCompliance.getNextSendTime(
          business.timezone
        );

        await MessageQueueService.queueMessage({
          businessId: committedMessage.businessId,
          contactId: committedMessage.contactId || undefined,
          phoneNumber: committedMessage.phoneNumber,
          messageContent: committedMessage.messageContent,
          messageType: committedMessage.messageType,
          scheduledFor: nextSendTime,
          metadata: committedMessage.metadata,
        });

        // Mark committed message as sent (credits already deducted)
        await MessageCommitmentService.markAsSent(
          committedMessage.id,
          "queued_for_tcpa_compliance"
        );

        logInfo("Committed message queued due to quiet hours", {
          businessId,
          messageId: committedMessage.id,
          nextSendTime: nextSendTime.toISOString(),
          timezone: business.timezone,
        });

        return;
      }

      // Send immediately using PROVEN UniversalMessageService
      // Credits already deducted, so use direct sending method
      const result = await UniversalMessageService.sendMessageWithoutCredits(
        bizStorage,
        {
          businessId: committedMessage.businessId,
          phoneNumber: committedMessage.phoneNumber,
          messageContent: committedMessage.messageContent,
          messageType: committedMessage.messageType,
          contactId: committedMessage.contactId || undefined,
          campaignId: committedMessage.campaignId || undefined,
          from: metadata.from,
          messagingServiceSid: metadata.messagingServiceSid,
          mediaUrl: metadata.mediaUrl,
        }
      );

      // Mark as sent in committed messages
      await MessageCommitmentService.markAsSent(
        committedMessage.id,
        result.messageId || "sent_successfully"
      );

      logInfo("Committed message sent successfully", {
        businessId,
        messageId: committedMessage.id,
        twilioMessageSid: result.messageId,
        messageType: committedMessage.messageType,
        creditsDeducted: committedMessage.creditsDeducted,
      });
    } catch (error) {
      logError("Failed to process committed message", {
        businessId,
        messageId: committedMessage.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      await MessageCommitmentService.markAsFailed(
        committedMessage.id,
        error instanceof Error ? error.message : "Processing failed"
      );
    }
  }

  /**
   * Check if there are pending messages to process
   */
  private static async hasPendingMessages(): Promise<boolean> {
    try {
      const messages = await MessageCommitmentService.getPendingMessages(1);
      return messages.length > 0;
    } catch (error) {
      logError("Failed to check for pending messages", { error });
      return false;
    }
  }

  /**
   * Sleep utility for rate limiting
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current processing statistics from database
   */
  static async getStats(): Promise<{
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    suppressed: number;
    total: number;
    isProcessing: boolean;
    accountMpsLimit: number;
    messagesPerBusinessPerCycle: number;
  }> {
    try {
      const stats = await MessageCommitmentService.getStats();

      return {
        ...stats,
        isProcessing: this.isProcessing,
        accountMpsLimit: this.ACCOUNT_MPS_LIMIT,
        messagesPerBusinessPerCycle: this.MESSAGES_PER_BUSINESS_PER_CYCLE,
      };
    } catch (error) {
      logError("Failed to get fair processor stats", { error });
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
      return await MessageCommitmentService.getBusinessStats(businessId);
    } catch (error) {
      logError("Failed to get business fair processor stats", {
        businessId,
        error,
      });
      throw error;
    }
  }

  /**
   * Force start processing (for debugging/admin)
   */
  static async forceStartProcessing(): Promise<void> {
    if (this.isProcessing) {
      logInfo("Processing already running, cannot force start");
      return;
    }

    logInfo("Force starting fair processing");
    setImmediate(() => this.startProcessing());
  }

  /**
   * Get current queue status for monitoring
   */
  static async getQueueStatus(): Promise<{
    isProcessing: boolean;
    pendingMessages: number;
    businessCount: number;
    accountMpsLimit: number;
    messagesPerBusinessPerCycle: number;
  }> {
    try {
      const messagesByBusiness =
        await MessageCommitmentService.getPendingMessagesByBusiness();
      const pendingMessages = Array.from(messagesByBusiness.values()).reduce(
        (sum, msgs) => sum + msgs.length,
        0
      );

      return {
        isProcessing: this.isProcessing,
        pendingMessages,
        businessCount: messagesByBusiness.size,
        accountMpsLimit: this.ACCOUNT_MPS_LIMIT,
        messagesPerBusinessPerCycle: this.MESSAGES_PER_BUSINESS_PER_CYCLE,
      };
    } catch (error) {
      logError("Failed to get queue status", { error });
      throw error;
    }
  }
}
