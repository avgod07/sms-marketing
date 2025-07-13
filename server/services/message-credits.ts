import type { IStorage } from "../db/storage";
import { TwilioService } from "./twilio";
import type { TwilioCredential } from "@shared/schema";
import { logError, logInfo } from "../utils/logger.util";

export class InsufficientCreditsError extends Error {
  constructor(message = "Insufficient credits") {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}

export interface MessageCreditOptions {
  to: string;
  message: string;
  from?: string;
  messagingServiceSid?: string;
  contactId?: number;
  campaignId?: number;
  mediaUrl?: string;
  messageType?: "initial" | "regular" | "campaign";
}

export interface MessageCreditResult {
  success: boolean;
  messageSid?: string;
  error?: string;
  creditCost: number;
  remainingCredits: number;
}

/**
 * Centralized service for handling message sending with credit deduction
 */
export class MessageCreditService {
  /**
   * Send a message with proper credit deduction
   * @param biz - Business storage instance
   * @param creds - Twilio credentials
   * @param options - Message options
   * @returns Promise<MessageCreditResult>
   */
  static async sendWithCreditDeduction(
    biz: IStorage,
    creds: TwilioCredential | undefined,
    options: MessageCreditOptions
  ): Promise<MessageCreditResult> {
    // Determine credit cost based on message type
    const isMMS = !!options.mediaUrl;
    const creditCost = isMMS ? 3 : 1;

    // Check current credit balance
    const credits = await biz.getCredits();
    const currentBalance = credits?.balance || 0;

    try {
      if (currentBalance < creditCost) {
        throw new InsufficientCreditsError(
          `Insufficient credits. Need ${creditCost}, have ${currentBalance}`
        );
      }

      // Send the message via Twilio
      const result = await TwilioService.sendSMS(creds, {
        to: options.to,
        message: options.message,
        from: options.from,
        messagingServiceSid: options.messagingServiceSid,
        contactId: options.contactId,
        campaignId: options.campaignId,
      });

      // Only deduct credits if message was sent successfully
      if (result.success) {
        try {
          const messageTypeLabel = options.messageType || "regular";
          const description = `Sent ${
            isMMS ? "MMS" : "SMS"
          } ${messageTypeLabel} message to ${options.to}`;

          const updatedCredits = await biz.adjustCredits(
            -creditCost,
            isMMS ? "send_mms" : "send_sms",
            description,
            {
              to: options.to,
              contactId: options.contactId,
              campaignId: options.campaignId,
              messageType: options.messageType,
              messageSid: result.messageSid,
            }
          );

          logInfo("Message sent and credits deducted", {
            to: options.to,
            creditCost,
            remainingCredits: updatedCredits.balance,
            messageType: options.messageType,
            messageSid: result.messageSid,
          });

          return {
            success: true,
            messageSid: result.messageSid,
            creditCost,
            remainingCredits: updatedCredits.balance,
          };
        } catch (creditError) {
          logError("Failed to deduct credits for sent message", {
            to: options.to,
            creditCost,
            messageSid: result.messageSid,
            error:
              creditError instanceof Error
                ? creditError.message
                : String(creditError),
          });

          // Message was sent but credit deduction failed
          // This is a critical error that should be monitored
          return {
            success: false,
            error: "Message sent but credit deduction failed",
            creditCost,
            remainingCredits: currentBalance,
          };
        }
      } else {
        // Message failed to send, no credits deducted
        return {
          success: false,
          error: result.error || "Failed to send message",
          creditCost,
          remainingCredits: currentBalance,
        };
      }
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        logError("Insufficient credits for message", {
          to: options.to,
          creditCost,
          currentBalance,
          messageType: options.messageType,
        });

        return {
          success: false,
          error: error.message,
          creditCost,
          remainingCredits: currentBalance,
        };
      }

      logError("Error in MessageCreditService.sendWithCreditDeduction", {
        to: options.to,
        error: error instanceof Error ? error.message : String(error),
        messageType: options.messageType,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        creditCost,
        remainingCredits: currentBalance,
      };
    }
  }

  /**
   * Check if business has enough credits for a message
   * @param biz - Business storage instance
   * @param messageCount - Number of messages to check for
   * @param isMMS - Whether the messages are MMS
   * @returns Promise<boolean>
   */
  static async hasEnoughCredits(
    biz: IStorage,
    messageCount: number = 1,
    isMMS: boolean = false
  ): Promise<boolean> {
    const creditCost = isMMS ? 3 : 1;
    const totalCost = messageCount * creditCost;

    const credits = await biz.getCredits();
    const currentBalance = credits?.balance || 0;

    return currentBalance >= totalCost;
  }

  /**
   * Get current credit balance
   * @param biz - Business storage instance
   * @returns Promise<number>
   */
  static async getCreditBalance(biz: IStorage): Promise<number> {
    const credits = await biz.getCredits();
    return credits?.balance || 0;
  }
}
