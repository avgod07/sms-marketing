import { UniversalMessageService } from "./universal-message.js";
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
   * Send preview response with confirmation request
   */
  static async sendPreviewResponse(
    bizStore: IStorage,
    phoneNumber: string,
    message: string,
    contactCount: number,
    creditCost: number
  ): Promise<void> {
    const credits = await bizStore.getCredits();
    const balance = credits?.balance || 0;

    const preview = `🔍 PREVIEW:
"${message}"

📊 DETAILS:
• Recipients: ${contactCount} active contact${contactCount > 1 ? "s" : ""}
• Credit cost: ${creditCost} credit${
      creditCost > 1 ? "s" : ""
    } (current balance: ${balance})
• Message length: ${message.length}/160 characters

Reply YES to send or NO to cancel.
⏱️ Expires in 2 minutes.`;

    await this.sendResponseMessage(bizStore, phoneNumber, preview);
  }

  /**
   * Send confirmation response after successful send
   */
  static async sendConfirmationResponse(
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

    const credits = await bizStore.getCredits();
    const remainingBalance = credits?.balance || 0;

    const message = `✅ Campaign sent to ${sentCount} contact${
      sentCount > 1 ? "s" : ""
    }. ${creditsUsed} credit${creditsUsed > 1 ? "s" : ""} used.
Remaining balance: ${remainingBalance} credits.
Next send available: ${timeStr}`;

    await this.sendResponseMessage(bizStore, phoneNumber, message);
  }

  /**
   * Send confirmation response with queue information
   */
  static async sendConfirmationWithQueueResponse(
    bizStore: IStorage,
    phoneNumber: string,
    sentCount: number,
    queuedCount: number,
    creditsUsed: number,
    nextAvailable: Date
  ): Promise<void> {
    const timeStr = nextAvailable.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const credits = await bizStore.getCredits();
    const remainingBalance = credits?.balance || 0;

    const message = `✅ Campaign processed for ${
      sentCount + queuedCount
    } contact${sentCount + queuedCount > 1 ? "s" : ""}.
📤 Sent immediately: ${sentCount}
⏰ Queued for business hours: ${queuedCount}
${creditsUsed} credit${creditsUsed > 1 ? "s" : ""} will be used.
Remaining balance: ${remainingBalance} credits.
Next send available: ${timeStr}`;

    await this.sendResponseMessage(bizStore, phoneNumber, message);
  }

  /**
   * Send success response with queue information
   */
  static async sendSuccessWithQueueResponse(
    bizStore: IStorage,
    phoneNumber: string,
    sentCount: number,
    queuedCount: number,
    creditsUsed: number,
    nextAvailable: Date
  ): Promise<void> {
    const timeStr = nextAvailable.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const message = `✅ Campaign processed for ${
      sentCount + queuedCount
    } contact${sentCount + queuedCount > 1 ? "s" : ""}.
📤 Sent immediately: ${sentCount}
⏰ Queued for business hours: ${queuedCount}
${creditsUsed} credit${creditsUsed > 1 ? "s" : ""} will be used.
Next available: ${timeStr}`;

    await this.sendResponseMessage(bizStore, phoneNumber, message);
  }

  /**
   * Send cancellation response
   */
  static async sendCancellationResponse(
    bizStore: IStorage,
    phoneNumber: string,
    originalMessage: string
  ): Promise<void> {
    const truncatedMessage =
      originalMessage.length > 50
        ? originalMessage.substring(0, 50) + "..."
        : originalMessage;

    const message = `❌ Campaign canceled. No credits used.
Your message was: "${truncatedMessage}"`;

    await this.sendResponseMessage(bizStore, phoneNumber, message);
  }

  /**
   * Send timeout/expiration response
   */
  static async sendTimeoutResponse(
    bizStore: IStorage,
    phoneNumber: string
  ): Promise<void> {
    const message = `⏱️ Campaign expired. No action taken.
Send a new SEND: command to try again.`;

    await this.sendResponseMessage(bizStore, phoneNumber, message);
  }

  /**
   * Send business hours error response for SMS commands
   */
  static async sendBusinessHoursErrorResponse(
    bizStore: IStorage,
    phoneNumber: string,
    businessTimezone: string
  ): Promise<void> {
    const { QuietHoursCompliance } = await import(
      "./quiet-hours-compliance.js"
    );
    const nextSendTime = QuietHoursCompliance.getNextSendTime(businessTimezone);

    const nextSendFormatted = nextSendTime.toLocaleString("en-US", {
      timeZone: businessTimezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      weekday:
        nextSendTime.getDate() !== new Date().getDate() ? "short" : undefined,
    });

    const message = `❌ Cannot send campaigns outside business hours (8 AM - 8 PM).
Try again after ${nextSendFormatted}.`;

    await this.sendResponseMessage(bizStore, phoneNumber, message);
  }

  /**
   * Helper function to send response message via UniversalMessageService
   * These are operational messages and should not deduct credits
   * Respects TCPA quiet hours compliance
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

      // Send response via UniversalMessageService with TCPA compliance
      // SMS command responses are operational and should respect quiet hours
      const result = await UniversalMessageService.sendMessage(bizStore, {
        businessId: business.id,
        phoneNumber,
        messageContent: message,
        messageType: "sms_command_response",
        from,
        messagingServiceSid: messagingServiceSid ?? undefined,
      });

      if (result.status === "sent") {
        logInfo("SMS command response sent immediately", {
          businessId: business.id,
          phoneNumber,
          messageLength: message.length,
          messageSid: result.messageId,
        });
      } else if (result.status === "queued") {
        logInfo("SMS command response queued for quiet hours", {
          businessId: business.id,
          phoneNumber,
          messageLength: message.length,
          queueId: result.queueId,
          scheduledFor: result.scheduledFor,
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
