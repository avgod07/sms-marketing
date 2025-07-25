import { TwilioService } from "./twilio.js";
import type { IStorage } from "../db/storage.js";
import { logInfo, logError } from "../utils/logger.util.js";

export class SMSCommandResponses {
  /**
   * Send a rate limit exceeded response
   */
  static async sendRateLimitResponse(
    bizStore: IStorage,
    phoneNumber: string,
    nextAvailable: Date
  ): Promise<void> {
    const timeStr = nextAvailable.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const message = `⏱️ Rate limit exceeded. You can send 1 campaign per hour. Next available: ${timeStr}`;

    await this.sendResponseMessage(bizStore, phoneNumber, message);
  }

  /**
   * Send a success response after campaign is sent
   */
  static async sendSuccessResponse(
    bizStore: IStorage,
    phoneNumber: string,
    sentCount: number,
    creditsUsed: number,
    nextAvailable: Date
  ): Promise<void> {
    const timeStr = nextAvailable.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const message = `✅ Campaign sent to ${sentCount} contact${
      sentCount > 1 ? "s" : ""
    }. ${creditsUsed} credit${
      creditsUsed > 1 ? "s" : ""
    } used. Next available: ${timeStr}`;

    await this.sendResponseMessage(bizStore, phoneNumber, message);
  }

  /**
   * Send insufficient credits response
   */
  static async sendInsufficientCreditsResponse(
    bizStore: IStorage,
    phoneNumber: string,
    needed: number,
    available: number
  ): Promise<void> {
    const message = `❌ Insufficient credits. Need ${needed}, have ${available}. Purchase more in your dashboard.`;

    await this.sendResponseMessage(bizStore, phoneNumber, message);
  }

  /**
   * Send unauthorized sender response
   */
  static async sendUnauthorizedResponse(
    bizStore: IStorage,
    phoneNumber: string
  ): Promise<void> {
    const message = `❌ Unauthorized number. Contact your admin to add this number as a command sender.`;

    await this.sendResponseMessage(bizStore, phoneNumber, message);
  }

  /**
   * Send invalid command format response
   */
  static async sendInvalidFormatResponse(
    bizStore: IStorage,
    phoneNumber: string,
    error?: string
  ): Promise<void> {
    let message = `❌ Invalid format. Use: SEND: your message here`;

    if (error) {
      message += `\nError: ${error}`;
    }

    await this.sendResponseMessage(bizStore, phoneNumber, message);
  }

  /**
   * Send no contacts found response
   */
  static async sendNoContactsResponse(
    bizStore: IStorage,
    phoneNumber: string
  ): Promise<void> {
    const message = `❌ No active contacts found. Add contacts to your account first.`;

    await this.sendResponseMessage(bizStore, phoneNumber, message);
  }

  /**
   * Send generic error response
   */
  static async sendErrorResponse(
    bizStore: IStorage,
    phoneNumber: string,
    error: string
  ): Promise<void> {
    const message = `❌ ${error}`;

    await this.sendResponseMessage(bizStore, phoneNumber, message);
  }

  /**
   * Send system error response
   */
  static async sendSystemErrorResponse(
    bizStore: IStorage,
    phoneNumber: string
  ): Promise<void> {
    const message = `❌ System error. Please try again later or contact support.`;

    await this.sendResponseMessage(bizStore, phoneNumber, message);
  }

  /**
   * Helper function to send response message via Twilio
   * These are operational messages and should not deduct credits
   */
  private static async sendResponseMessage(
    bizStore: IStorage,
    phoneNumber: string,
    message: string
  ): Promise<void> {
    try {
      const business = await bizStore.getBusiness();
      const numbers = await bizStore.getPhoneNumbers();
      const from = numbers.find((n) => n.isDefault)?.phoneNumber;
      const messagingServiceSid = await bizStore.getMessagingServiceSid();

      if (!from && !messagingServiceSid) {
        logError(
          "No phone number or messaging service configured for business",
          {
            businessId: business.id,
          }
        );
        return;
      }

      // Create a minimal creds object for compatibility
      const tempCreds = {
        businessId: business.id,
        accountSid: process.env.TWILIO_ACCOUNT_SID!,
        messagingServiceSid: messagingServiceSid || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        id: 0,
      };

      // Send response message - these are operational and don't consume credits
      const result = await TwilioService.sendSMS(tempCreds, {
        to: phoneNumber,
        message,
        from,
        messagingServiceSid: messagingServiceSid ?? undefined,
      });

      if (result.success) {
        logInfo("SMS command response sent", {
          businessId: business.id,
          phoneNumber,
          messageLength: message.length,
          messageSid: result.messageSid,
        });
      } else {
        logError("Failed to send SMS command response", {
          businessId: business.id,
          phoneNumber,
          error: result.error,
        });
      }
    } catch (error) {
      logError("Error sending SMS command response:", error);
    }
  }

  /**
   * Format time in a user-friendly way
   */
  static formatNextAvailableTime(date: Date): string {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
}
