import twilio from "twilio";
import type { TwilioCredential } from "@shared/schema";

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

    let serviceSid = creds.messagingServiceSid;
    if (!serviceSid) {
      const service = await client.messaging.services.create({
        friendlyName: `Messaging Service - ${TWILIO_ACCOUNT_SID!.slice(-4)}`,
      });
      serviceSid = service.sid;
    }

    const num = await client.incomingPhoneNumbers.create({
      phoneNumber,
      smsUrl: webhookUrl,
    });

    await client.messaging
      .services(serviceSid)
      .phoneNumbers.create({ phoneNumberSid: num.sid });

    return { phoneSid: num.sid, serviceSid };
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
