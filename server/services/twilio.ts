import twilio from "twilio";
import type { TwilioCredential } from "@shared/schema";
import { decrypt } from "../utils/encryption.util";

// Global fallback configuration for development/testing
const fallbackSid =
  process.env.TWILIO_ACCOUNT_SID || "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const fallbackToken = process.env.TWILIO_AUTH_TOKEN || "your_auth_token_here";
const fallbackNumber = process.env.TWILIO_PHONE_NUMBER || "+1234567890";

// Cache clients per account for efficiency
const clientCache = new Map<string, twilio.Twilio>();
function getClient(accountSid: string, token: string) {
  const existing = clientCache.get(accountSid);
  if (existing) return existing;
  const client = twilio(accountSid, token);
  clientCache.set(accountSid, client);
  return client;
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

export class TwilioService {
  static async sendSMS(
    creds: TwilioCredential | undefined,
    smsData: SMSMessage,
  ): Promise<SMSResult> {
    try {
      // Fallback to env configuration if creds not provided
      const sid = creds ? creds.accountSid : fallbackSid;
      const token = creds ? decrypt(creds.authTokenEncrypted) : fallbackToken;
      const client = getClient(sid, token);

      const params: any = {
        body: smsData.message,
        to: smsData.to,
      };

      if (smsData.messagingServiceSid)
        params.messagingServiceSid = smsData.messagingServiceSid;
      else params.from = smsData.from || fallbackNumber;

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

  static async sendBulkSMS(
    creds: TwilioCredential | undefined,
    messages: SMSMessage[],
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
    opts: { page?: number; contains?: string; limit?: number } = {},
  ): Promise<string[]> {
    const sid = creds ? creds.accountSid : fallbackSid;
    const token = creds ? decrypt(creds.authTokenEncrypted) : fallbackToken;
    const client = getClient(sid, token);

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
    webhookUrl: string,
  ): Promise<{ phoneSid: string; serviceSid: string }> {
    const token = decrypt(creds.authTokenEncrypted);
    const client = getClient(creds.accountSid, token);

    let serviceSid = creds.messagingServiceSid;
    if (!serviceSid) {
      const service = await client.messaging.services.create({
        friendlyName: `Messaging Service - ${creds.accountSid.slice(-4)}`,
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
    return !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
    );
  }

  static getConfiguration() {
    return {
      accountSid: process.env.TWILIO_ACCOUNT_SID || "Not configured",
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || "Not configured",
      isConfigured: this.isConfigured(),
    };
  }
}
