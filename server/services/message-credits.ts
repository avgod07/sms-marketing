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

export interface MessageCreditResult {
  success: boolean;
  messageSid?: string;
  error?: string;
  creditCost: number;
  remainingCredits: number;
  billingStatus: "success" | "failed";
  internalNote?: string;
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

/**
 * Centralized service for handling message sending with credit deduction
 */
export class MessageCreditService {
  /**
   * Send a message with proper credit deduction - SEND FIRST, THEN DEDUCT
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

    // Get current credit balance for validation
    const credits = await biz.getCredits();
    const currentBalance = credits?.balance || 0;

    try {
      // STEP 1: CHECK CREDITS FIRST - CRITICAL BUSINESS PROTECTION
      if (currentBalance < creditCost) {
        throw new InsufficientCreditsError(
          `Insufficient credits. Need ${creditCost}, have ${currentBalance}`
        );
      }

      // STEP 2: Send message to Twilio ONLY if user has credits
      const twilioResult = await TwilioService.sendSMS(creds, {
        to: options.to,
        message: options.message,
        from: options.from,
        messagingServiceSid:
          options.messagingServiceSid ||
          (creds?.messagingServiceSid ?? undefined),
        contactId: options.contactId,
        campaignId: options.campaignId,
      });

      // If Twilio failed, stop here - no billing needed
      if (!twilioResult.success) {
        return {
          success: false,
          error: twilioResult.error || "Failed to send message via Twilio",
          creditCost,
          remainingCredits: currentBalance,
          billingStatus: "success", // No billing attempted
        };
      }

      // STEP 3: Twilio succeeded - now attempt to deduct credits
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
            messageSid: twilioResult.messageSid,
          }
        );

        logInfo("Message sent and credits deducted successfully", {
          to: options.to,
          creditCost,
          remainingCredits: updatedCredits.balance,
          messageType: options.messageType,
          messageSid: twilioResult.messageSid,
        });

        return {
          success: true,
          messageSid: twilioResult.messageSid,
          creditCost,
          remainingCredits: updatedCredits.balance,
          billingStatus: "success",
        };
      } catch (billingError) {
        // STEP 4: Message was sent but billing failed - rare technical issue
        logError(
          "BILLING_SYSTEM_FAILURE: Message sent but credit deduction failed",
          {
            to: options.to,
            creditCost,
            messageSid: twilioResult.messageSid,
            messageType: options.messageType,
            error:
              billingError instanceof Error
                ? billingError.message
                : String(billingError),
            timestamp: new Date().toISOString(),
          }
        );

        // Return success since message was sent - billing failure is internal issue
        return {
          success: true,
          messageSid: twilioResult.messageSid,
          creditCost,
          remainingCredits: currentBalance, // Unchanged since deduction failed
          billingStatus: "failed",
          internalNote:
            "Billing system failure - requires internal investigation",
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
          billingStatus: "success", // No billing attempted
        };
      }

      // Unexpected error during process
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
        billingStatus: "success", // No billing attempted due to early failure
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
