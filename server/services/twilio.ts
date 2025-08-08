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

// Single Twilio client instance for the main account
let mainTwilioClient: twilio.Twilio | null = null;

// Cache for subaccount clients
const subaccountClients = new Map<string, twilio.Twilio>();

/**
 * Get the main Twilio client (for account management operations)
 */
function getMainClient(): twilio.Twilio {
  if (!mainTwilioClient) {
    mainTwilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return mainTwilioClient;
}

/**
 * Get a Twilio client for a specific subaccount
 */
function getSubaccountClient(
  apiKeySid: string,
  apiKeySecret: string,
  subaccountSid: string
): twilio.Twilio {
  const clientKey = `${apiKeySid}:${subaccountSid}`;

  if (!subaccountClients.has(clientKey)) {
    const client = twilio(apiKeySid, apiKeySecret, {
      accountSid: subaccountSid,
    });
    subaccountClients.set(clientKey, client);
  }

  return subaccountClients.get(clientKey)!;
}

/**
 * Legacy function for backward compatibility - uses main client
 * @deprecated Use getMainClient() or getSubaccountClient() instead
 */
function getClient(): twilio.Twilio {
  return getMainClient();
}

export interface SubaccountCredentials {
  subaccountSid: string;
  subaccountAuthToken: string;
  apiKeySid: string;
  apiKeySecret: string;
  phoneNumber: string;
  phoneNumberSid: string;
  messagingServiceSid: string;
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

// Export client utilities for use in other services
export { getMainClient, getSubaccountClient };

/**
 * Get the correct auth token for webhook validation based on business
 * @param businessId - Business ID from webhook URL
 * @returns Auth token (main account or subaccount)
 */
export async function getWebhookAuthToken(businessId: number): Promise<string> {
  try {
    const { storage } = await import("../db/storage.js");
    const { logInfo, logError } = await import("../utils/logger.util.js");

    const bizStorage = storage.forBusiness(businessId);
    const business = await bizStorage.getBusiness();

    logInfo("Determining webhook auth token", {
      businessId,
      subaccountProvisioned: business.subaccountProvisioned,
    });

    // Check if business uses subaccount
    if (business.subaccountProvisioned) {
      const subaccountCreds = await bizStorage.getSubaccountCredentials();
      if (subaccountCreds?.subaccountAuthToken) {
        logInfo("Using subaccount auth token for webhook validation", {
          businessId,
          subaccountSid: subaccountCreds.subaccountSid,
        });
        return subaccountCreds.subaccountAuthToken;
      } else {
        logError(
          "Subaccount provisioned but no credentials found, falling back to main account",
          {
            businessId,
          }
        );
      }
    }

    // Fallback to main account token for legacy businesses or when subaccount creds unavailable
    const mainToken = process.env.TWILIO_AUTH_TOKEN;
    if (!mainToken) {
      throw new Error("TWILIO_AUTH_TOKEN not configured");
    }

    logInfo("Using main account auth token for webhook validation", {
      businessId,
      reason: business.subaccountProvisioned
        ? "subaccount_creds_unavailable"
        : "legacy_business",
    });

    return mainToken;
  } catch (error) {
    const { logError } = await import("../utils/logger.util.js");
    logError("Failed to get webhook auth token, falling back to main account", {
      businessId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Final fallback to main account token
    const mainToken = process.env.TWILIO_AUTH_TOKEN;
    if (!mainToken) {
      throw new Error(
        "TWILIO_AUTH_TOKEN not configured and no fallback available"
      );
    }
    return mainToken;
  }
}

export class TwilioService {
  /**
   * Send SMS using subaccount credentials
   */
  static async sendSMSWithSubaccount(
    subaccountCreds: SubaccountCredentials,
    smsData: SMSMessage,
    businessId?: number
  ): Promise<SMSResult> {
    try {
      const client = getSubaccountClient(
        subaccountCreds.apiKeySid,
        subaccountCreds.apiKeySecret,
        subaccountCreds.subaccountSid
      );

      const params: any = {
        body: smsData.message,
        to: smsData.to,
      };

      // Use messaging service if available, otherwise use the subaccount's phone number
      if (subaccountCreds.messagingServiceSid) {
        params.messagingServiceSid = subaccountCreds.messagingServiceSid;
      } else {
        params.from = smsData.from || subaccountCreds.phoneNumber;
      }

      // Add media URL for MMS if provided
      if (smsData.mediaUrl) {
        params.mediaUrl = [smsData.mediaUrl];
      }

      // Add status callback to ensure webhooks go to the correct endpoint
      const baseUrl =
        process.env.TWILIO_WEBHOOK_BASE_URL ||
        (process.env.NODE_ENV === "production" ? process.env.BASE_URL : null);
      if (baseUrl && businessId) {
        params.statusCallback = `${baseUrl}/api/webhooks/twilio/status-callback/${businessId}`;
      }

      const message = await client.messages.create(params);

      return {
        success: true,
        messageSid: message.sid,
      };
    } catch (error: any) {
      console.error("Twilio SMS Error (Subaccount):", error);
      return {
        success: false,
        error: error.message || "Failed to send SMS",
      };
    }
  }

  /**
   * Legacy method - uses main account credentials
   * @deprecated Use sendSMSWithSubaccount for new implementations
   */
  static async sendSMS(
    creds: TwilioCredential | undefined,
    smsData: SMSMessage,
    businessId?: number
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

      // Add status callback to ensure webhooks go to the correct endpoint
      const baseUrl =
        process.env.TWILIO_WEBHOOK_BASE_URL ||
        (process.env.NODE_ENV === "production" ? process.env.BASE_URL : null);
      if (baseUrl && businessId) {
        params.statusCallback = `${baseUrl}/api/webhooks/twilio/status-callback/${businessId}`;
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
    webhookUrl: string,
    businessId?: number
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
        // Generate business-specific webhook URL if businessId is provided
        const finalWebhookUrl =
          businessId &&
          webhookUrl.includes("/webhooks/twilio-inbound") &&
          !webhookUrl.includes(`/${businessId}`)
            ? webhookUrl.replace(
                "/webhooks/twilio-inbound",
                `/webhooks/twilio-inbound/${businessId}`
              )
            : webhookUrl;

        createParams.smsUrl = finalWebhookUrl;
        console.log(
          `📞 Setting webhook URL: ${finalWebhookUrl}${
            businessId ? ` (business-specific for ID: ${businessId})` : ""
          }`
        );
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
