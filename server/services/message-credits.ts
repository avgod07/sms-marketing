import { IStorage } from "../db/storage";
import type { TwilioCredential } from "@shared/schema";
import { TwilioService } from "./twilio";
import { logInfo, logError } from "../utils/logger.util";

export class InsufficientCreditsError extends Error {
  constructor(message: string = "Insufficient credits") {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}

export interface MessageCreditOptions {
  to: string;
  message: string;
  from?: string;
  messagingServiceSid?: string;
  mediaUrl?: string;
  contactId?: number;
  campaignId?: number;
  messageType?: string;
}

export interface MessageCreditResult {
  success: boolean;
  error?: string;
  messageSid?: string;
  creditCost: number;
  remainingCredits: number;
  billingStatus: "success" | "failed";
}

/**
 * Detects if message contains characters that require UCS-2 encoding
 */
function requiresUCS2Encoding(message: string): boolean {
  // Check for characters outside basic ASCII range (0-127)
  if (/[^\u0000-\u007F]/.test(message)) {
    return true;
  }

  // Check for smart quotes, em dashes, and other common UCS-2 characters
  if (/[""''–—…]/.test(message)) {
    return true;
  }

  // GSM basic character set check
  const gsmBasicChars =
    /^[A-Za-z0-9@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-.\/:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\~\[\]|€]*$/;

  return !gsmBasicChars.test(message);
}

/**
 * Calculates accurate Twilio credit cost based on segmentation
 */
function calculateTwilioCreditCost(message: string, hasMedia: boolean): number {
  // MMS is ONLY triggered by media attachments, not message length
  if (hasMedia) {
    return 3; // Flat MMS rate
  }

  const messageLength = message.length;
  const needsUCS2 = requiresUCS2Encoding(message);

  if (needsUCS2) {
    // UCS-2 encoding (Unicode characters, emojis, smart quotes, etc.)
    const singleMessageLimit = 70;
    const multiSegmentLimit = 67;

    if (messageLength <= singleMessageLimit) {
      return 1;
    } else {
      return Math.ceil(messageLength / multiSegmentLimit);
    }
  } else {
    // GSM-7 encoding (standard ASCII-like characters)
    const singleMessageLimit = 160;
    const multiSegmentLimit = 153;

    if (messageLength <= singleMessageLimit) {
      return 1;
    } else {
      return Math.ceil(messageLength / multiSegmentLimit);
    }
  }
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
    // Determine credit cost based on accurate Twilio segmentation
    const creditCost = calculateTwilioCreditCost(
      options.message,
      !!options.mediaUrl
    );

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
        mediaUrl: options.mediaUrl, // Only include if present (for MMS)
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
        const isMedia = !!options.mediaUrl;
        const segments = isMedia ? 1 : creditCost;

        const description = isMedia
          ? `Sent MMS ${messageTypeLabel} message to ${options.to}`
          : `Sent ${segments} SMS segment${
              segments > 1 ? "s" : ""
            } ${messageTypeLabel} message to ${options.to}`;

        const updatedCredits = await biz.adjustCredits(
          -creditCost,
          isMedia ? "send_mms" : "send_sms",
          description,
          {
            to: options.to,
            contactId: options.contactId,
            campaignId: options.campaignId,
            messageType: options.messageType,
            messageSid: twilioResult.messageSid,
            segments: segments,
          }
        );

        logInfo("Message sent and credits deducted successfully", {
          to: options.to,
          creditCost,
          segments: segments,
          isMedia,
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
      } catch (creditError) {
        // CRITICAL: Twilio sent but we couldn't deduct credits
        // This is a billing inconsistency that needs manual review
        logError("CRITICAL: Message sent but credit deduction failed", {
          to: options.to,
          creditCost,
          twilioMessageSid: twilioResult.messageSid,
          creditError:
            creditError instanceof Error
              ? creditError.message
              : String(creditError),
          messageType: options.messageType,
        });

        return {
          success: true, // Message was sent successfully
          messageSid: twilioResult.messageSid,
          creditCost,
          remainingCredits: currentBalance, // No change since deduction failed
          billingStatus: "failed", // Mark billing as failed for review
        };
      }
    } catch (error) {
      // Pre-send validation failed or Twilio completely failed
      if (error instanceof InsufficientCreditsError) {
        throw error; // Re-throw credit errors for proper handling
      }

      logError("Message sending failed before Twilio attempt", {
        to: options.to,
        error: error instanceof Error ? error.message : String(error),
        messageType: options.messageType,
      });

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        creditCost,
        remainingCredits: currentBalance,
        billingStatus: "success", // No billing attempted
      };
    }
  }

  /**
   * Check if business has enough credits for a message
   * @param biz - Business storage instance
   * @param message - Message content
   * @param messageCount - Number of messages to check for
   * @param hasMedia - Whether the message includes media
   * @returns Promise<boolean>
   */
  static async hasEnoughCredits(
    biz: IStorage,
    message: string,
    messageCount: number = 1,
    hasMedia: boolean = false
  ): Promise<boolean> {
    const creditCostPerMessage = calculateTwilioCreditCost(message, hasMedia);
    const totalCost = messageCount * creditCostPerMessage;

    const credits = await biz.getCredits();
    const currentBalance = credits?.balance || 0;

    return currentBalance >= totalCost;
  }

  /**
   * Calculate credit cost for a message without sending
   * @param message - Message content
   * @param hasMedia - Whether the message includes media
   * @returns number of credits needed
   */
  static calculateCreditCost(
    message: string,
    hasMedia: boolean = false
  ): number {
    return calculateTwilioCreditCost(message, hasMedia);
  }
}
