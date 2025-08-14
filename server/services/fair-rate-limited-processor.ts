import { MessageQueueService } from "./message-queue.js";
import { QuietHoursCompliance } from "./quiet-hours-compliance.js";
import { TwilioService } from "./twilio.js";
import { MessageCreditService } from "./message-credits.js";
import { storage } from "../db/storage.js";
import type { IStorage } from "../db/storage.js";
import { logInfo, logError } from "../utils/logger.util.js";

export interface QueuedMessage {
  businessId: number;
  phoneNumber: string;
  messageContent: string;
  messageType: string;
  contactId?: number;
  campaignId?: number;
  from?: string;
  messagingServiceSid?: string;
  mediaUrl?: string;
  metadata?: any;
}

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
 * FairRateLimitedProcessor
 * Handles fair distribution of messages across businesses while respecting Twilio rate limits
 */
export class FairRateLimitedProcessor {
  // In-memory processing queue organized by business
  private static processingQueue: Map<number, QueuedMessage[]> = new Map();
  private static isProcessing = false;

  // Rate limiting configuration
  private static readonly ACCOUNT_MPS_LIMIT = parseInt(
    process.env.TWILIO_ACCOUNT_MPS_LIMIT || "25"
  );
  private static readonly MESSAGES_PER_BUSINESS_PER_CYCLE = parseInt(
    process.env.MESSAGES_PER_BUSINESS_PER_CYCLE || "3"
  );
  private static readonly CYCLE_INTERVAL_MS = 1000; // 1 second between cycles

  // Processing statistics
  private static stats: ProcessingStats = {
    totalProcessed: 0,
    sentCount: 0,
    queuedCount: 0,
    failedCount: 0,
    suppressedCount: 0,
    businessCount: 0,
    processingTimeMs: 0,
  };

  /**
   * Add messages from a business to the fair processing queue
   * @param businessId - Business ID
   * @param messages - Array of messages to process
   */
  static async addBusinessMessages(
    businessId: number,
    messages: QueuedMessage[]
  ): Promise<ProcessingStats> {
    if (messages.length === 0) {
      return this.getEmptyStats();
    }

    logInfo("Adding messages to fair processing queue", {
      businessId,
      messageCount: messages.length,
      currentQueueSize: this.getTotalQueueSize(),
    });

    // Initialize business queue if doesn't exist
    if (!this.processingQueue.has(businessId)) {
      this.processingQueue.set(businessId, []);
    }

    // Add messages to business queue
    const businessQueue = this.processingQueue.get(businessId)!;
    businessQueue.push(...messages);

    // Start processing if not already running
    if (!this.isProcessing && this.hasMessagesToProcess()) {
      return await this.startFairProcessing();
    }

    return this.getEmptyStats();
  }

  /**
   * Process messages from the TCPA queue using fair distribution
   * @param messagesByBusiness - Messages grouped by business from queue processor
   */
  static async processQueuedMessages(
    messagesByBusiness: Map<number, Array<any>>
  ): Promise<ProcessingStats> {
    const startTime = Date.now();
    let totalProcessed = 0;
    let sentCount = 0;
    let queuedCount = 0;
    let failedCount = 0;
    let suppressedCount = 0;
    const businessesProcessed = new Set<number>();

    try {
      if (messagesByBusiness.size === 0) {
        return this.getEmptyStats();
      }

      logInfo("Processing queued messages with fair distribution", {
        businessCount: messagesByBusiness.size,
        totalMessages: Array.from(messagesByBusiness.values()).reduce(
          (sum, msgs) => sum + msgs.length,
          0
        ),
      });

      // Convert queued messages to our format and process fairly
      while (this.hasQueuedMessagesToProcess(messagesByBusiness)) {
        const cycleBatch: Array<{ businessId: number; message: any }> = [];

        // Round-robin: Take messages from each business
        for (const [businessId, messages] of messagesByBusiness) {
          if (messages.length === 0) continue;

          const businessBatch = messages.splice(
            0,
            this.MESSAGES_PER_BUSINESS_PER_CYCLE
          );
          for (const message of businessBatch) {
            cycleBatch.push({ businessId, message });
            businessesProcessed.add(businessId);

            // Respect account-level limit
            if (cycleBatch.length >= this.ACCOUNT_MPS_LIMIT) break;
          }
          if (cycleBatch.length >= this.ACCOUNT_MPS_LIMIT) break;
        }

        if (cycleBatch.length === 0) break;

        // Process this cycle's batch
        const cycleResults = await Promise.allSettled(
          cycleBatch.map(({ businessId, message }) =>
            this.sendQueuedMessage(businessId, message)
          )
        );

        // Aggregate results
        for (let i = 0; i < cycleResults.length; i++) {
          totalProcessed++;
          const result = cycleResults[i];

          if (result.status === "fulfilled") {
            const messageResult = result.value;
            if (messageResult.status === "sent") {
              sentCount++;
            } else if (messageResult.status === "queued") {
              queuedCount++;
            } else if (messageResult.status === "suppressed") {
              suppressedCount++;
            }
          } else {
            failedCount++;
            logError("Failed to send message in cycle", {
              error: result.reason,
              cycleIndex: i,
            });
          }
        }

        // Wait before next cycle (respect rate limiting)
        if (this.hasQueuedMessagesToProcess(messagesByBusiness)) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.CYCLE_INTERVAL_MS)
          );
        }
      }

      const processingTimeMs = Date.now() - startTime;

      logInfo("Queued messages processing completed", {
        totalProcessed,
        sentCount,
        queuedCount,
        failedCount,
        suppressedCount,
        businessCount: businessesProcessed.size,
        processingTimeMs,
      });

      return {
        totalProcessed,
        sentCount,
        queuedCount,
        failedCount,
        suppressedCount,
        businessCount: businessesProcessed.size,
        processingTimeMs,
      };
    } catch (error) {
      logError("Critical error in queued message processing", {
        error: error instanceof Error ? error.message : String(error),
        processingTimeMs: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Start fair processing of queued messages
   */
  private static async startFairProcessing(): Promise<ProcessingStats> {
    if (this.isProcessing) {
      return this.getEmptyStats();
    }

    this.isProcessing = true;
    const startTime = Date.now();
    let totalProcessed = 0;
    let sentCount = 0;
    let queuedCount = 0;
    let failedCount = 0;
    let suppressedCount = 0;
    const businessesProcessed = new Set<number>();

    try {
      logInfo("Starting fair processing cycle", {
        businessCount: this.processingQueue.size,
        totalMessages: this.getTotalQueueSize(),
      });

      while (this.hasMessagesToProcess()) {
        const cycleBatch: Array<{
          businessId: number;
          message: QueuedMessage;
        }> = [];

        // Round-robin: Take messages from each business
        for (const [businessId, messages] of this.processingQueue) {
          if (messages.length === 0) continue;

          const businessBatch = messages.splice(
            0,
            this.MESSAGES_PER_BUSINESS_PER_CYCLE
          );
          for (const message of businessBatch) {
            cycleBatch.push({ businessId, message });
            businessesProcessed.add(businessId);

            // Respect account-level limit
            if (cycleBatch.length >= this.ACCOUNT_MPS_LIMIT) break;
          }
          if (cycleBatch.length >= this.ACCOUNT_MPS_LIMIT) break;
        }

        if (cycleBatch.length === 0) break;

        // Process this cycle's batch in parallel
        const cycleResults = await Promise.allSettled(
          cycleBatch.map(({ businessId, message }) =>
            this.sendMessage(businessId, message)
          )
        );

        // Aggregate results
        for (let i = 0; i < cycleResults.length; i++) {
          totalProcessed++;
          const result = cycleResults[i];

          if (result.status === "fulfilled") {
            const messageResult = result.value;
            if (messageResult.status === "sent") {
              sentCount++;
            } else if (messageResult.status === "queued") {
              queuedCount++;
            } else if (messageResult.status === "suppressed") {
              suppressedCount++;
            }
          } else {
            failedCount++;
            logError("Failed to send message in cycle", {
              error: result.reason,
              cycleIndex: i,
            });
          }
        }

        // Clean up empty business queues
        for (const [businessId, messages] of this.processingQueue) {
          if (messages.length === 0) {
            this.processingQueue.delete(businessId);
          }
        }

        // Wait before next cycle (respect rate limiting)
        if (this.hasMessagesToProcess()) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.CYCLE_INTERVAL_MS)
          );
        }
      }

      const processingTimeMs = Date.now() - startTime;

      this.stats = {
        totalProcessed,
        sentCount,
        queuedCount,
        failedCount,
        suppressedCount,
        businessCount: businessesProcessed.size,
        processingTimeMs,
      };

      logInfo("Fair processing cycle completed", this.stats);

      return this.stats;
    } catch (error) {
      logError("Critical error in fair processing", {
        error: error instanceof Error ? error.message : String(error),
        processingTimeMs: Date.now() - startTime,
      });
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send an individual message with TCPA compliance checks
   */
  private static async sendMessage(
    businessId: number,
    message: QueuedMessage
  ): Promise<{ status: string; messageSid?: string }> {
    try {
      const bizStorage = storage.forBusiness(businessId);
      const business = await bizStorage.getBusiness();

      // Check TCPA quiet hours compliance
      const canSendNow = QuietHoursCompliance.canSendImmediately(
        business.timezone,
        message.messageType
      );

      if (!canSendNow) {
        // Queue for later delivery
        const nextSendTime = QuietHoursCompliance.getNextSendTime(
          business.timezone
        );
        await MessageQueueService.queueMessage({
          businessId: message.businessId,
          contactId: message.contactId,
          phoneNumber: message.phoneNumber,
          messageContent: message.messageContent,
          messageType: message.messageType,
          scheduledFor: nextSendTime,
          metadata: message.metadata,
        });

        logInfo("Message queued due to quiet hours", {
          businessId,
          messageType: message.messageType,
          nextSendTime: nextSendTime.toISOString(),
          timezone: business.timezone,
        });

        return { status: "queued" };
      }

      // Send immediately with credit deduction
      const result = await this.sendWithCredits(bizStorage, message);

      if (!result.success) {
        throw new Error(result.error || "Failed to send message");
      }

      return { status: "sent", messageSid: result.messageSid };
    } catch (error) {
      logError("Failed to send message in fair processor", {
        businessId,
        phoneNumber: message.phoneNumber,
        messageType: message.messageType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Send a queued message (from TCPA queue processor)
   */
  private static async sendQueuedMessage(
    businessId: number,
    queuedMessage: any
  ): Promise<{ status: string; messageSid?: string }> {
    try {
      const bizStorage = storage.forBusiness(businessId);

      // Check if contact is still active (TCPA compliance)
      if (queuedMessage.contactId) {
        const contact = await bizStorage.getContact(queuedMessage.contactId);

        if (!contact) {
          await MessageQueueService.markAsSuppressed(
            queuedMessage.id,
            "Contact deleted"
          );
          return { status: "suppressed" };
        }

        if (!contact.active) {
          await MessageQueueService.markAsSuppressed(
            queuedMessage.id,
            "Contact opted out (STOP)"
          );
          return { status: "suppressed" };
        }
      }

      // Send the message
      const business = await bizStorage.getBusiness();
      const messagingServiceSid = await bizStorage.getMessagingServiceSid();
      const numbers = await bizStorage.getPhoneNumbers();
      const defaultFrom = numbers.find((n: any) => n.isDefault)?.phoneNumber;

      // Parse metadata
      let metadata = {};
      if (queuedMessage.metadata) {
        try {
          metadata = JSON.parse(queuedMessage.metadata);
        } catch (parseError) {
          logError("Failed to parse queued message metadata", {
            messageId: queuedMessage.id,
            metadata: queuedMessage.metadata,
          });
        }
      }

      // Send with credit deduction
      const shouldUseCredits = this.shouldUseCredits(queuedMessage.messageType);
      let result;

      if (shouldUseCredits) {
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
            businessId: business.id,
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
          campaignId: (metadata as any)?.campaignId, // Include campaignId from metadata for completion detection
        });
      } else {
        const tempCreds = {
          businessId: business.id,
          accountSid: process.env.TWILIO_ACCOUNT_SID!,
          messagingServiceSid: messagingServiceSid || null,
          createdAt: new Date(),
          updatedAt: new Date(),
          id: 0,
        };

        result = await TwilioService.sendSMS(
          tempCreds,
          {
            to: queuedMessage.phoneNumber,
            message: queuedMessage.messageContent,
            from: defaultFrom,
            messagingServiceSid: messagingServiceSid ?? undefined,
            contactId: queuedMessage.contactId || undefined,
          },
          business.id
        );

        if (!result.success) {
          throw new Error(result.error || "Failed to send message directly");
        }
      }

      // Mark message as sent in queue
      await MessageQueueService.markAsSent(queuedMessage.id, result.messageSid);

      logInfo("Queued message sent successfully via fair processor", {
        messageId: queuedMessage.id,
        businessId,
        messageType: queuedMessage.messageType,
        messageSid: result.messageSid,
        usedCredits: shouldUseCredits,
      });

      return { status: "sent", messageSid: result.messageSid };
    } catch (error) {
      logError("Failed to send queued message in fair processor", {
        messageId: queuedMessage.id,
        businessId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Send message with credit deduction
   */
  private static async sendWithCredits(
    bizStorage: IStorage,
    message: QueuedMessage
  ): Promise<any> {
    const business = await bizStorage.getBusiness();

    // Validate subaccount setup (subaccount-only, no legacy fallback)
    if (!business.subaccountProvisioned) {
      throw new Error(
        "Message sending requires subaccount provisioning. Please complete your business setup."
      );
    }

    const subaccountCreds = await bizStorage.getSubaccountCredentials();
    if (!subaccountCreds?.phoneNumber) {
      throw new Error(
        "No phone number configured in subaccount. Please complete your phone setup."
      );
    }

    // Use subaccount credentials only - no messaging service needed for direct phone number routing
    const messagingServiceSid: string | undefined = undefined;
    const defaultFrom: string = subaccountCreds.phoneNumber;

    const shouldUseCredits = this.shouldUseCredits(message.messageType);

    if (shouldUseCredits) {
      if (subaccountCreds && business.subaccountProvisioned) {
        // Use subaccount for credit-based messages
        const result =
          await MessageCreditService.sendWithCreditDeductionSubaccount(
            bizStorage,
            subaccountCreds,
            {
              to: message.phoneNumber,
              message: message.messageContent,
              from: message.from || defaultFrom,
              messagingServiceSid:
                (message.messagingServiceSid || messagingServiceSid) ??
                undefined,
              contactId: message.contactId,
              messageType: message.messageType,
              mediaUrl: message.mediaUrl,
              campaignId: message.campaignId,
              businessId: business.id,
              ...(message.metadata || {}),
            }
          );

        if (result.success) {
          // Create message record
          await bizStorage.createMessage({
            phoneNumber: message.phoneNumber,
            contactId: message.contactId,
            content: message.messageContent,
            status: "sent",
            messageType: message.messageType,
            billingStatus: result.billingStatus,
            messageSid: result.messageSid,
            campaignId: message.campaignId, // Include campaignId for completion detection
          });
        }

        return result;
      } else {
        // Fallback to legacy credit system
        const tempCreds = {
          businessId: business.id,
          accountSid: process.env.TWILIO_ACCOUNT_SID!,
          messagingServiceSid: messagingServiceSid || null,
          createdAt: new Date(),
          updatedAt: new Date(),
          id: 0,
        };

        const result = await MessageCreditService.sendWithCreditDeduction(
          bizStorage,
          tempCreds,
          {
            to: message.phoneNumber,
            message: message.messageContent,
            from: message.from || defaultFrom,
            messagingServiceSid:
              (message.messagingServiceSid || messagingServiceSid) ?? undefined,
            contactId: message.contactId,
            messageType: message.messageType,
            mediaUrl: message.mediaUrl,
            campaignId: message.campaignId,
            businessId: business.id,
            ...(message.metadata || {}),
          }
        );

        if (result.success) {
          // Create message record
          await bizStorage.createMessage({
            phoneNumber: message.phoneNumber,
            contactId: message.contactId,
            content: message.messageContent,
            status: "sent",
            messageType: message.messageType,
            billingStatus: result.billingStatus,
            messageSid: result.messageSid,
            campaignId: message.campaignId, // Include campaignId for completion detection
          });
        }

        return result;
      }
    } else {
      // Send without credits (operational messages)
      if (subaccountCreds && business.subaccountProvisioned) {
        // Use subaccount for operational messages
        return await TwilioService.sendSMSWithSubaccount(
          subaccountCreds,
          {
            to: message.phoneNumber,
            message: message.messageContent,
            from: message.from || defaultFrom,
            messagingServiceSid:
              (message.messagingServiceSid || messagingServiceSid) ?? undefined,
            contactId: message.contactId,
          },
          business.id
        );
      } else {
        // Fallback to legacy operational messages
        const tempCreds = {
          businessId: business.id,
          accountSid: process.env.TWILIO_ACCOUNT_SID!,
          messagingServiceSid: messagingServiceSid || null,
          createdAt: new Date(),
          updatedAt: new Date(),
          id: 0,
        };

        return await TwilioService.sendSMS(
          tempCreds,
          {
            to: message.phoneNumber,
            message: message.messageContent,
            from: message.from || defaultFrom,
            messagingServiceSid:
              (message.messagingServiceSid || messagingServiceSid) ?? undefined,
            contactId: message.contactId,
          },
          business.id
        );
      }
    }
  }

  /**
   * Determine if message type should use credit system
   */
  private static shouldUseCredits(messageType: string): boolean {
    const creditMessages = ["welcome", "individual", "test", "campaign"];
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
   * Check if there are messages to process in any business queue
   */
  private static hasMessagesToProcess(): boolean {
    for (const messages of this.processingQueue.values()) {
      if (messages.length > 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if there are queued messages to process
   */
  private static hasQueuedMessagesToProcess(
    messagesByBusiness: Map<number, Array<any>>
  ): boolean {
    for (const messages of messagesByBusiness.values()) {
      if (messages.length > 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get total number of messages across all business queues
   */
  private static getTotalQueueSize(): number {
    let total = 0;
    for (const messages of this.processingQueue.values()) {
      total += messages.length;
    }
    return total;
  }

  /**
   * Get empty stats structure
   */
  private static getEmptyStats(): ProcessingStats {
    return {
      totalProcessed: 0,
      sentCount: 0,
      queuedCount: 0,
      failedCount: 0,
      suppressedCount: 0,
      businessCount: 0,
      processingTimeMs: 0,
    };
  }

  /**
   * Get current processing statistics
   */
  static getStats(): ProcessingStats {
    return { ...this.stats };
  }

  /**
   * Get current queue status
   */
  static getQueueStatus() {
    return {
      isProcessing: this.isProcessing,
      businessCount: this.processingQueue.size,
      totalMessages: this.getTotalQueueSize(),
      accountMpsLimit: this.ACCOUNT_MPS_LIMIT,
      messagesPerBusinessPerCycle: this.MESSAGES_PER_BUSINESS_PER_CYCLE,
    };
  }

  /**
   * Clear all queues (for testing/admin purposes)
   */
  static clearQueues(): void {
    this.processingQueue.clear();
    this.isProcessing = false;
    logInfo("Fair processor queues cleared");
  }
}
