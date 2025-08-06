import { QuietHoursCompliance } from "./quiet-hours-compliance.js";
import { MessageQueueService } from "./message-queue.js";
import { TwilioService } from "./twilio.js";
import { MessageCreditService } from "./message-credits.js";
import { logInfo, logError } from "../utils/logger.util.js";
import type { IStorage } from "../db/storage.js";

export interface SendMessageParams {
  businessId: number;
  phoneNumber: string;
  messageContent: string;
  messageType: string;
  contactId?: number;
  metadata?: any;
  // Optional Twilio-specific params
  from?: string;
  messagingServiceSid?: string;
  campaignId?: number;
  mediaUrl?: string;
}

export interface SendMessageResult {
  status: "sent" | "queued";
  scheduledFor?: Date;
  messageId?: string;
  queueId?: number;
}

/**
 * UniversalMessageService
 * Central service for all message sending with TCPA compliance
 * Routes messages to immediate sending or queue based on quiet hours
 */
export class UniversalMessageService {
  /**
   * Send a message with TCPA compliance checking
   * @param bizStorage - Business storage instance
   * @param params - Message parameters
   * @returns Result indicating if message was sent or queued
   */
  static async sendMessage(
    bizStorage: IStorage,
    params: SendMessageParams
  ): Promise<SendMessageResult> {
    try {
      const business = await bizStorage.getBusiness();

      // Check if message can be sent immediately
      if (
        QuietHoursCompliance.canSendImmediately(
          business.timezone,
          params.messageType
        )
      ) {
        // Send immediately
        return await this.sendImmediately(bizStorage, params);
      } else {
        // Queue for later
        return await this.queueForLater(bizStorage, params, business.timezone);
      }
    } catch (error) {
      logError("Failed to process message send request", {
        error,
        businessId: params.businessId,
        messageType: params.messageType,
      });
      throw error;
    }
  }

  /**
   * Send message immediately via Twilio
   * @param bizStorage - Business storage instance
   * @param params - Message parameters
   * @returns Send result
   */
  private static async sendImmediately(
    bizStorage: IStorage,
    params: SendMessageParams
  ): Promise<SendMessageResult> {
    try {
      // Determine sending method based on message type
      if (this.shouldUseCredits(params.messageType)) {
        // Use credit deduction system for regular messages
        return await this.sendWithCredits(bizStorage, params);
      } else {
        // Send directly for system/compliance messages
        return await this.sendDirectly(bizStorage, params);
      }
    } catch (error) {
      logError("Failed to send message immediately", {
        error,
        businessId: params.businessId,
        messageType: params.messageType,
      });
      throw error;
    }
  }

  /**
   * Queue message for later delivery
   * @param bizStorage - Business storage instance
   * @param params - Message parameters
   * @param businessTimezone - Business timezone
   * @returns Queue result
   */
  private static async queueForLater(
    bizStorage: IStorage,
    params: SendMessageParams,
    businessTimezone: string
  ): Promise<SendMessageResult> {
    try {
      // NEW: Charge credits upfront before queueing (fixes double billing bug)
      // All queued messages are now pre-paid, eliminating billing complexity in queue processor
      const creditCost = MessageCreditService.calculateCreditCost(
        params.messageContent,
        !!params.mediaUrl
      );

      // Check and deduct credits immediately - fail fast if insufficient
      const currentCredits = await bizStorage.getCredits();
      const currentBalance = currentCredits?.balance || 0;

      if (currentBalance < creditCost) {
        throw new Error(
          `Insufficient credits. Need ${creditCost}, have ${currentBalance}`
        );
      }

      // Deduct credits immediately using the same pattern as MessageCommitmentService
      const updatedCredits = await bizStorage.adjustCredits(
        -creditCost,
        "message_queue",
        `Queued ${params.messageType} message for TCPA compliance`,
        {
          messageType: params.messageType,
          creditCost,
          phoneNumber: params.phoneNumber,
          contactId: params.contactId,
          timestamp: new Date().toISOString(),
        }
      );

      logInfo("Credits deducted for queued message", {
        businessId: params.businessId,
        messageType: params.messageType,
        creditCost,
        previousBalance: currentBalance,
        remainingCredits: updatedCredits.balance,
      });

      const scheduledFor =
        QuietHoursCompliance.getNextSendTime(businessTimezone);

      const queuedMessage = await MessageQueueService.queueMessage({
        businessId: params.businessId,
        contactId: params.contactId,
        phoneNumber: params.phoneNumber,
        messageContent: params.messageContent,
        messageType: params.messageType,
        scheduledFor,
        metadata: {
          ...params.metadata,
          from: params.from,
          messagingServiceSid: params.messagingServiceSid,
          campaignId: params.campaignId,
          mediaUrl: params.mediaUrl,
          // Mark as pre-paid to help with debugging
          creditsPaid: true,
          creditsDeducted: creditCost,
        },
      });

      logInfo("Message queued with upfront billing", {
        businessId: params.businessId,
        messageType: params.messageType,
        queueId: queuedMessage.id,
        scheduledFor: scheduledFor.toISOString(),
        creditCost,
      });

      return {
        status: "queued",
        scheduledFor,
        queueId: queuedMessage.id,
      };
    } catch (error) {
      logError("Failed to queue message with upfront billing", {
        error,
        businessId: params.businessId,
        messageType: params.messageType,
      });
      throw error;
    }
  }

  /**
   * Send message using credit deduction system
   * @param bizStorage - Business storage instance
   * @param params - Message parameters
   */
  private static async sendWithCredits(
    bizStorage: IStorage,
    params: SendMessageParams
  ): Promise<SendMessageResult> {
    const business = await bizStorage.getBusiness();
    const messagingServiceSid = await bizStorage.getMessagingServiceSid();
    const numbers = await bizStorage.getPhoneNumbers();
    const defaultFrom = numbers.find((n) => n.isDefault)?.phoneNumber;

    // Create credentials object
    const tempCreds = {
      businessId: business.id,
      accountSid: process.env.TWILIO_ACCOUNT_SID!,
      messagingServiceSid: messagingServiceSid || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      id: 0,
    };

    // Send with credit deduction
    const result = await MessageCreditService.sendWithCreditDeduction(
      bizStorage,
      tempCreds,
      {
        to: params.phoneNumber,
        message: params.messageContent,
        from: params.from || defaultFrom,
        messagingServiceSid:
          params.messagingServiceSid || messagingServiceSid || undefined,
        contactId: params.contactId,
        campaignId: params.campaignId,
        messageType: params.messageType,
        mediaUrl: params.mediaUrl,
        businessId: params.businessId,
      }
    );

    if (result.success) {
      // Create message record
      await bizStorage.createMessage({
        phoneNumber: params.phoneNumber,
        contactId: params.contactId,
        content: params.messageContent,
        status: "sent",
        messageType: params.messageType,
        billingStatus: result.billingStatus,
        messageSid: result.messageSid,
        campaignId: params.campaignId,
      });

      logInfo("Message sent immediately with credits", {
        businessId: params.businessId,
        messageType: params.messageType,
        messageSid: result.messageSid,
        creditCost: result.creditCost,
      });

      return {
        status: "sent",
        messageId: result.messageSid,
      };
    } else {
      throw new Error(result.error || "Failed to send message");
    }
  }

  /**
   * Send message directly without credit deduction (for system messages)
   * @param bizStorage - Business storage instance
   * @param params - Message parameters
   */
  private static async sendDirectly(
    bizStorage: IStorage,
    params: SendMessageParams
  ): Promise<SendMessageResult> {
    const business = await bizStorage.getBusiness();
    const messagingServiceSid = await bizStorage.getMessagingServiceSid();
    const numbers = await bizStorage.getPhoneNumbers();
    const defaultFrom = numbers.find((n) => n.isDefault)?.phoneNumber;

    // Create credentials object
    const tempCreds = {
      businessId: business.id,
      accountSid: process.env.TWILIO_ACCOUNT_SID!,
      messagingServiceSid: messagingServiceSid || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      id: 0,
    };

    // Send directly via Twilio
    const result = await TwilioService.sendSMS(
      tempCreds,
      {
        to: params.phoneNumber,
        message: params.messageContent,
        from: params.from || defaultFrom,
        messagingServiceSid:
          params.messagingServiceSid || messagingServiceSid || undefined,
        contactId: params.contactId,
        mediaUrl: params.mediaUrl,
      },
      params.businessId
    );

    if (result.success) {
      logInfo("Message sent directly (no credits)", {
        businessId: params.businessId,
        messageType: params.messageType,
        messageSid: result.messageSid,
      });

      return {
        status: "sent",
        messageId: result.messageSid,
      };
    } else {
      throw new Error(result.error || "Failed to send message");
    }
  }

  /**
   * NEW: Send message without credit deduction (for committed messages)
   * Credits were already deducted in the commitment phase
   */
  static async sendMessageWithoutCredits(
    bizStorage: IStorage,
    params: SendMessageParams
  ): Promise<SendMessageResult> {
    try {
      const business = await bizStorage.getBusiness();

      logInfo("Sending committed message without credit deduction", {
        businessId: params.businessId,
        messageType: params.messageType,
        phoneNumber: params.phoneNumber,
      });

      // Send directly without credit deduction but create message record
      const result = await this.sendDirectlyWithRecord(bizStorage, params);

      return result;
    } catch (error) {
      logError("Failed to send committed message", {
        error,
        businessId: params.businessId,
        messageType: params.messageType,
      });
      throw error;
    }
  }

  /**
   * Send directly and create message record (for committed messages)
   */
  private static async sendDirectlyWithRecord(
    bizStorage: IStorage,
    params: SendMessageParams
  ): Promise<SendMessageResult> {
    const business = await bizStorage.getBusiness();
    const messagingServiceSid = await bizStorage.getMessagingServiceSid();
    const numbers = await bizStorage.getPhoneNumbers();
    const defaultFrom = numbers.find((n) => n.isDefault)?.phoneNumber;

    const tempCreds = {
      businessId: business.id,
      accountSid: process.env.TWILIO_ACCOUNT_SID!,
      messagingServiceSid: messagingServiceSid || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      id: 0,
    };

    // Send via Twilio
    const result = await TwilioService.sendSMS(
      tempCreds,
      {
        to: params.phoneNumber,
        message: params.messageContent,
        from: params.from || defaultFrom,
        messagingServiceSid:
          params.messagingServiceSid || messagingServiceSid || undefined,
        contactId: params.contactId,
        mediaUrl: params.mediaUrl,
      },
      params.businessId
    );

    if (result.success) {
      // Create message record
      await bizStorage.createMessage({
        phoneNumber: params.phoneNumber,
        contactId: params.contactId,
        content: params.messageContent,
        status: "sent",
        messageType: params.messageType,
        messageSid: result.messageSid,
        campaignId: params.campaignId,
      });

      logInfo("Committed message sent via Twilio", {
        businessId: params.businessId,
        messageType: params.messageType,
        messageSid: result.messageSid,
      });

      return {
        status: "sent",
        messageId: result.messageSid,
      };
    } else {
      throw new Error(result.error || "Failed to send message via Twilio");
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
    logInfo("Unknown message type - defaulting to credit deduction", {
      messageType,
    });
    return true;
  }
}
