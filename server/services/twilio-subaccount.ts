import { getMainClient, getSubaccountClient } from "./twilio.js";
import type { IStorage } from "../db/storage.js";
import { logInfo, logError } from "../utils/logger.util.js";

export interface BusinessInfo {
  businessName: string;
  websiteUrl?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
}

export interface ProvisioningResult {
  subaccountSid: string;
  phoneNumber: string;
  phoneNumberSid: string;
  messagingServiceSid: string;
  tfvStatus: string;
  tfvRequestId?: string;
}

export interface ApiKeyResult {
  sid: string;
  secret: string;
}

export interface PhoneNumberResult {
  sid: string;
  phoneNumber: string;
}

export interface MessagingServiceResult {
  sid: string;
}

export interface TFVResult {
  requestId: string;
  status: string;
}

export class TwilioSubaccountService {
  /**
   * Complete subaccount provisioning flow for a business
   */
  static async provisionBusinessSubaccount(params: {
    businessId: number;
    businessInfo: BusinessInfo;
    monthlyVolume: string;
    useCases: string[];
    initialMessage: string;
    storage: IStorage;
  }): Promise<ProvisioningResult> {
    const {
      businessId,
      businessInfo,
      monthlyVolume,
      useCases,
      initialMessage,
      storage,
    } = params;

    try {
      logInfo("Starting subaccount provisioning", {
        businessId,
        businessName: businessInfo.businessName,
      });

      // Step 1: Create Twilio Subaccount
      const subaccount = await this.createSubaccount(
        businessInfo.businessName,
        businessId
      );
      logInfo("Subaccount created", { subaccountSid: subaccount.sid });

      // Step 2: Generate API Key for subaccount
      const apiKey = await this.generateSubaccountApiKey(subaccount.sid);
      logInfo("API key generated", { apiKeySid: apiKey.sid });

      // Step 3: Purchase toll-free number in subaccount
      const phoneNumber = await this.purchaseTollFreeNumber(
        subaccount.sid,
        apiKey,
        businessId
      );
      logInfo("Phone number purchased", {
        phoneNumber: phoneNumber.phoneNumber,
      });

      // Step 4: Create messaging service in subaccount
      const messagingService = await this.createMessagingService(
        subaccount.sid,
        apiKey,
        phoneNumber.sid
      );
      logInfo("Messaging service created", {
        messagingServiceSid: messagingService.sid,
      });

      // Step 5: Submit TFV (if business info is complete)
      let tfvResult: TFVResult | null = null;
      if (
        this.canSubmitTFV(businessInfo, monthlyVolume, useCases, initialMessage)
      ) {
        tfvResult = await this.submitTollFreeVerification(
          subaccount.sid,
          apiKey,
          phoneNumber.phoneNumber,
          businessInfo,
          monthlyVolume,
          useCases,
          initialMessage
        );
        logInfo("TFV submitted", { tfvRequestId: tfvResult.requestId });
      }

      // Step 6: Store all credentials securely
      await storage.createTwilioSubaccount({
        subaccountSid: subaccount.sid,
        subaccountAuthToken: subaccount.authToken,
        apiKeySid: apiKey.sid,
        apiKeySecret: apiKey.secret,
        phoneNumber: phoneNumber.phoneNumber,
        phoneNumberSid: phoneNumber.sid,
        messagingServiceSid: messagingService.sid,
        tfvRequestId: tfvResult?.requestId || null,
        tfvStatus: tfvResult?.status || "pending",
        status: "active",
      });

      // Mark business as having subaccount provisioned
      await storage.updateBusiness({ subaccountProvisioned: true });

      logInfo("Subaccount provisioning completed", {
        businessId,
        subaccountSid: subaccount.sid,
        phoneNumber: phoneNumber.phoneNumber,
      });

      return {
        subaccountSid: subaccount.sid,
        phoneNumber: phoneNumber.phoneNumber,
        phoneNumberSid: phoneNumber.sid,
        messagingServiceSid: messagingService.sid,
        tfvStatus: tfvResult?.status || "pending",
        tfvRequestId: tfvResult?.requestId,
      };
    } catch (error) {
      logError("Subaccount provisioning failed", { businessId, error });
      // Cleanup any partially created resources
      await this.cleanupFailedProvisioning(businessId);
      throw error;
    }
  }

  /**
   * Create a new Twilio subaccount
   */
  private static async createSubaccount(
    businessName: string,
    businessId: number
  ) {
    const client = getMainClient();

    const subaccount = await client.api.v2010.accounts.create({
      friendlyName: `${businessName} (Business ID: ${businessId})`,
    });

    return {
      sid: subaccount.sid,
      authToken: subaccount.authToken,
    };
  }

  /**
   * Generate API key for a subaccount
   */
  private static async generateSubaccountApiKey(
    subaccountSid: string
  ): Promise<ApiKeyResult> {
    const client = getMainClient();

    // Use the v1 IAM API to create an API key for the specific subaccount
    const apiKey = await client.iam.v1.newApiKey.create({
      accountSid: subaccountSid,
      friendlyName: `Primary API Key for ${subaccountSid}`,
    });

    return {
      sid: apiKey.sid,
      secret: apiKey.secret,
    };
  }

  /**
   * Purchase a toll-free number for the subaccount
   */
  private static async purchaseTollFreeNumber(
    subaccountSid: string,
    apiKey: ApiKeyResult,
    businessId: number
  ): Promise<PhoneNumberResult> {
    const subaccountClient = getSubaccountClient(
      apiKey.sid,
      apiKey.secret,
      subaccountSid
    );

    // Search for available toll-free numbers
    const availableNumbers = await subaccountClient.api.v2010
      .accounts(subaccountSid)
      .availablePhoneNumbers("US")
      .tollFree.list({ limit: 5 });

    if (availableNumbers.length === 0) {
      throw new Error("No toll-free numbers available");
    }

    // Construct webhook URLs using the same pattern as legacy system
    const baseUrl =
      process.env.TWILIO_WEBHOOK_BASE_URL ||
      (process.env.NODE_ENV === "production" ? process.env.BASE_URL : null);

    const createParams: any = {
      phoneNumber: availableNumbers[0].phoneNumber,
    };

    // Only set webhook URLs in production (same pattern as legacy system)
    if (baseUrl) {
      createParams.smsUrl = `${baseUrl}/webhooks/twilio-inbound/${businessId}`;
      createParams.statusCallback = `${baseUrl}/api/webhooks/twilio/status-callback/${businessId}`;

      logInfo("Setting webhook URLs for subaccount phone number", {
        businessId,
        subaccountSid,
        phoneNumber: availableNumbers[0].phoneNumber,
        smsUrl: createParams.smsUrl,
        statusCallback: createParams.statusCallback,
      });
    } else {
      logInfo("No webhook URLs set (development mode)", {
        businessId,
        subaccountSid,
        phoneNumber: availableNumbers[0].phoneNumber,
      });
    }

    // Purchase the number with webhook configuration
    const phoneNumber = await subaccountClient.api.v2010
      .accounts(subaccountSid)
      .incomingPhoneNumbers.create(createParams);

    return {
      sid: phoneNumber.sid,
      phoneNumber: phoneNumber.phoneNumber,
    };
  }

  /**
   * Create messaging service and add phone number to it
   */
  private static async createMessagingService(
    subaccountSid: string,
    apiKey: ApiKeyResult,
    phoneNumberSid: string
  ): Promise<MessagingServiceResult> {
    const subaccountClient = getSubaccountClient(
      apiKey.sid,
      apiKey.secret,
      subaccountSid
    );

    // Create messaging service
    const messagingService =
      await subaccountClient.messaging.v1.services.create({
        friendlyName: "Business Messaging Service",
      });

    // Add phone number to messaging service
    await subaccountClient.messaging.v1
      .services(messagingService.sid)
      .phoneNumbers.create({
        phoneNumberSid: phoneNumberSid,
      });

    return {
      sid: messagingService.sid,
    };
  }

  /**
   * Submit Toll-Free Verification request
   */
  private static async submitTollFreeVerification(
    subaccountSid: string,
    apiKey: ApiKeyResult,
    phoneNumber: string,
    businessInfo: BusinessInfo,
    monthlyVolume: string,
    useCases: string[],
    initialMessage: string
  ): Promise<TFVResult> {
    const subaccountClient = getSubaccountClient(
      apiKey.sid,
      apiKey.secret,
      subaccountSid
    );

    const tfvRequest =
      await subaccountClient.messaging.v1.tollfreeVerifications.create({
        businessName: businessInfo.businessName,
        businessWebsite: businessInfo.websiteUrl || "",
        businessStreetAddress: businessInfo.address1 || "",
        businessStreetAddress2: businessInfo.address2 || "",
        businessCity: businessInfo.city || "",
        businessStateProvinceRegion: businessInfo.state || "",
        businessPostalCode: businessInfo.postalCode || "",
        businessCountry: businessInfo.country || "US",
        businessContactFirstName: businessInfo.firstName || "",
        businessContactLastName: businessInfo.lastName || "",
        businessContactEmail: businessInfo.email || "",
        businessContactPhone: businessInfo.phoneNumber || "",
        notificationEmail: businessInfo.email || "", // Required field
        tollfreePhoneNumberSid: phoneNumber,
        useCaseCategories: useCases,
        useCaseSummary: `Monthly volume: ${monthlyVolume}. Use cases: ${useCases.join(
          ", "
        )}`,
        productionMessageSample: initialMessage,
        optInImageUrls: [], // Add if you have opt-in screenshots
        optInType: "VERBAL", // or 'WEB_FORM' based on your flow
        messageVolume: this.mapVolumeToTFVFormat(monthlyVolume),
      });

    return {
      requestId: tfvRequest.sid,
      status: tfvRequest.status,
    };
  }

  /**
   * Check if we have enough info to submit TFV
   */
  private static canSubmitTFV(
    businessInfo: BusinessInfo,
    monthlyVolume: string,
    useCases: string[],
    initialMessage: string
  ): boolean {
    return !!(
      businessInfo.businessName &&
      businessInfo.email &&
      monthlyVolume &&
      useCases.length > 0 &&
      initialMessage
    );
  }

  /**
   * Map volume string to TFV format
   */
  private static mapVolumeToTFVFormat(volume: string): string {
    const volumeMap: Record<string, string> = {
      "Less than 1K": "1000",
      "1K - 10K": "10000",
      "10K - 100K": "100000",
      "100K - 250K": "250000",
      "250K - 500K": "500000",
      "500K - 750K": "750000",
      "750K - 1M": "1000000",
      "More than 1M": "1000000",
    };

    return volumeMap[volume] || "10000";
  }

  /**
   * Cleanup resources if provisioning fails
   */
  private static async cleanupFailedProvisioning(
    businessId: number
  ): Promise<void> {
    try {
      logInfo("Cleaning up failed provisioning", { businessId });
      // TODO: Implement cleanup logic to remove partially created Twilio resources
      // This would involve tracking what was created and cleaning it up
    } catch (error) {
      logError("Cleanup failed", { businessId, error });
    }
  }
}
