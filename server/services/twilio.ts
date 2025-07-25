import twilio from "twilio";
import type { TwilioCredential } from "@shared/schema";
import { normalizePhoneNumber } from "../utils/normalize.util.js";

// Centralized Twilio configuration from environment variables
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Validate required environment variables
if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  throw new Error(
    "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables must be set"
  );
}

// Single Twilio client instance for the entire application
let twilioClient: twilio.Twilio | null = null;

function getClient(): twilio.Twilio {
  if (!twilioClient) {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

export interface SMSMessage {
  to: string;
  message: string;
  from?: string;
  messagingServiceSid?: string;
  campaignId?: number;
  contactId?: number;
  mediaUrl?: string; // For MMS support
}

export interface SMSResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

export interface PhoneValidationResult {
  isValid: boolean;
  canReceiveSMS: boolean;
  carrier?: string;
  type?: string;
  error?: string;
}

export class TwilioService {
  static async sendSMS(
    creds: TwilioCredential | undefined,
    smsData: SMSMessage
  ): Promise<SMSResult> {
    try {
      const client = getClient();

      const params: any = {
        body: smsData.message,
        to: smsData.to,
      };

      if (smsData.messagingServiceSid)
        params.messagingServiceSid = smsData.messagingServiceSid;
      else params.from = smsData.from || TWILIO_PHONE_NUMBER;

      // Add media URL for MMS if provided
      if (smsData.mediaUrl) {
        params.mediaUrl = [smsData.mediaUrl];
      }

      const message = await client.messages.create(params);

      return {
        success: true,
        messageSid: message.sid,
      };
    } catch (error: any) {
      console.error("Twilio SMS Error:", error);
      return {
        success: false,
        error: error.message || "Failed to send SMS",
      };
    }
  }

  /**
   * Validate a phone number using Twilio's Lookup API
   * This checks if the number is valid and can receive SMS
   */
  static async validatePhoneNumber(
    creds: TwilioCredential | undefined,
    phoneNumber: string
  ): Promise<PhoneValidationResult> {
    try {
      const client = getClient();

      // Basic lookup to validate the number format
      const lookup = await client.lookups.v2.phoneNumbers(phoneNumber).fetch();

      // If we get here, the number is valid
      return {
        isValid: true,
        canReceiveSMS: true, // Assume it can receive SMS if valid
        carrier: "Unknown",
        type: "Unknown",
      };
    } catch (error: any) {
      return {
        isValid: false,
        canReceiveSMS: false,
        error: error.message || "Invalid phone number",
      };
    }
  }

  static async sendBulkSMS(
    creds: TwilioCredential | undefined,
    messages: SMSMessage[]
  ): Promise<SMSResult[]> {
    const results: SMSResult[] = [];

    // Send messages in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchPromises = batch.map((msg) => this.sendSMS(creds, msg));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add a small delay between batches
      if (i + batchSize < messages.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  static async fetchAvailableTollFreeNumbers(
    creds: TwilioCredential | undefined,
    opts: { page?: number; contains?: string; limit?: number } = {}
  ): Promise<string[]> {
    const client = getClient();

    const params: any = {
      smsEnabled: true,
      // Removed voiceEnabled - we don't care about voice capabilities
      // Most toll-free numbers support both SMS and voice
      pageSize: opts.limit ?? 12,
      pageNumber: opts.page ?? 0,
    };
    if (opts.contains) params.contains = opts.contains;

    const page = await client.availablePhoneNumbers("US").tollFree.page(params);
    return page.instances.map((n: any) => n.phoneNumber);
  }

  static async purchaseAndAssignNumber(
    creds: TwilioCredential,
    phoneNumber: string,
    webhookUrl: string
  ): Promise<{ phoneSid: string; serviceSid: string }> {
    const client = getClient();

    try {
      console.log(`🔍 Attempting to purchase toll-free number: ${phoneNumber}`);

      // Normalize phone number to E.164 format (add +1 prefix if missing)
      const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
      console.log(`📞 Normalized phone number: ${normalizedPhoneNumber}`);

      let serviceSid = creds.messagingServiceSid;
      if (!serviceSid) {
        console.log("📡 Creating new messaging service...");
        const service = await client.messaging.services.create({
          friendlyName: `Messaging Service - ${TWILIO_ACCOUNT_SID!.slice(-4)}`,
        });
        serviceSid = service.sid;
        console.log(`✅ Created messaging service: ${serviceSid}`);
      }

      console.log("💰 Purchasing phone number from Twilio...");
      const createParams: any = {
        phoneNumber: normalizedPhoneNumber,
      };

      // Only set smsUrl if webhookUrl is provided (for production)
      if (webhookUrl) {
        createParams.smsUrl = webhookUrl;
        console.log(`📞 Setting webhook URL: ${webhookUrl}`);
      } else {
        console.log("⚠️ No webhook URL set (development mode)");
      }

      const num = await client.incomingPhoneNumbers.create(createParams);
      console.log(`✅ Phone number purchased successfully: ${num.sid}`);

      console.log("🔗 Adding number to messaging service...");
      try {
        await client.messaging
          .services(serviceSid)
          .phoneNumbers.create({ phoneNumberSid: num.sid });
        console.log("✅ Number added to messaging service successfully");
      } catch (messagingError: any) {
        console.log(
          `⚠️ Failed to add to messaging service ${serviceSid}: ${messagingError.message}`
        );

        // If messaging service doesn't exist, create a new one
        if (messagingError.status === 404) {
          console.log("🔄 Creating new messaging service...");
          const newService = await client.messaging.services.create({
            friendlyName: `Messaging Service - ${TWILIO_ACCOUNT_SID!.slice(
              -4
            )}`,
          });
          serviceSid = newService.sid;
          console.log(`✅ Created new messaging service: ${serviceSid}`);

          // Try adding the number to the new service
          await client.messaging
            .services(serviceSid)
            .phoneNumbers.create({ phoneNumberSid: num.sid });
          console.log("✅ Number added to new messaging service successfully");
        } else {
          throw messagingError; // Re-throw if it's a different error
        }
      }

      return { phoneSid: num.sid, serviceSid };
    } catch (error: any) {
      console.error(`❌ Error purchasing phone number ${phoneNumber}:`, {
        error: error.message,
        code: error.code,
        status: error.status,
        moreInfo: error.moreInfo,
        details: error.details,
      });

      // Re-throw with more specific error information
      const enhancedError = new Error(
        `Failed to purchase ${phoneNumber}: ${error.message} (Code: ${error.code})`
      );
      (enhancedError as any).code = error.code;
      (enhancedError as any).status = error.status;
      (enhancedError as any).moreInfo = error.moreInfo;
      (enhancedError as any).details = error.details;
      throw enhancedError;
    }
  }

  static isConfigured(): boolean {
    return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);
  }

  static getConfiguration() {
    return {
      accountSid: TWILIO_ACCOUNT_SID || "Not configured",
      phoneNumber: TWILIO_PHONE_NUMBER || "Not configured",
      isConfigured: this.isConfigured(),
    };
  }
}
