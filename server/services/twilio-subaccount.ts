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

    // Validate input parameters at the start
    if (!businessId || businessId <= 0) {
      throw new Error("Invalid businessId provided");
    }

    if (!businessInfo?.businessName?.trim()) {
      throw new Error("Business name is required for subaccount provisioning");
    }

    if (!monthlyVolume?.trim()) {
      throw new Error("Monthly volume is required for subaccount provisioning");
    }

    if (!useCases?.length) {
      throw new Error("Use cases are required for subaccount provisioning");
    }

    if (!initialMessage?.trim()) {
      throw new Error(
        "Initial message is required for subaccount provisioning"
      );
    }

    if (!storage) {
      throw new Error(
        "Storage instance is required for subaccount provisioning"
      );
    }

    try {
      logInfo("Starting subaccount provisioning", {
        businessId,
        businessName: businessInfo.businessName,
        monthlyVolume,
        useCasesCount: useCases.length,
        hasWebsite: !!businessInfo.websiteUrl,
        hasEmail: !!businessInfo.email,
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
        businessInfo.phoneNumber || "" // Pass the user's selected phone number
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
          initialMessage,
          businessId
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
   * Purchase a specific toll-free number in the subaccount
   */
  private static async purchaseTollFreeNumber(
    subaccountSid: string,
    apiKey: ApiKeyResult,
    selectedPhoneNumber: string // ✅ User's exact choice from frontend
  ): Promise<PhoneNumberResult> {
    const subaccountClient = getSubaccountClient(
      apiKey.sid,
      apiKey.secret,
      subaccountSid
    );

    logInfo("Purchasing specific toll-free number", {
      subaccountSid,
      selectedPhoneNumber,
    });

    try {
      // ✅ Purchase the EXACT number user selected
      const phoneNumber = await subaccountClient.incomingPhoneNumbers.create({
        phoneNumber: selectedPhoneNumber,
      });

      logInfo("Successfully purchased selected phone number", {
        phoneNumberSid: phoneNumber.sid,
        phoneNumber: phoneNumber.phoneNumber,
        subaccountSid,
      });

      return {
        phoneNumber: phoneNumber.phoneNumber,
        sid: phoneNumber.sid,
      };
    } catch (error) {
      logError("Failed to purchase selected phone number", {
        selectedPhoneNumber,
        subaccountSid,
        error: error instanceof Error ? error.message : String(error),
      });

      // Provide specific error message for better UX
      if (error instanceof Error && error.message.includes("not available")) {
        throw new Error(
          `The selected phone number ${selectedPhoneNumber} is no longer available. Please select a different number.`
        );
      }

      throw new Error(
        `Failed to purchase phone number ${selectedPhoneNumber}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
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
    initialMessage: string,
    businessId: number
  ): Promise<TFVResult> {
    // First validate all required parameters
    this.validateTFVSubmission({
      businessInfo,
      monthlyVolume,
      useCases,
      initialMessage,
    });

    const subaccountClient = getSubaccountClient(
      apiKey.sid,
      apiKey.secret,
      subaccountSid
    );

    // Get phone number SID for external reference ID
    const phoneNumbers = await subaccountClient.api.v2010
      .accounts(subaccountSid)
      .incomingPhoneNumbers.list({ phoneNumber });

    if (phoneNumbers.length === 0) {
      throw new Error(
        `Phone number ${phoneNumber} not found in subaccount ${subaccountSid}`
      );
    }

    const phoneNumberSid = phoneNumbers[0].sid;
    const externalReferenceId = this.generateExternalReferenceId(
      businessId,
      phoneNumberSid
    );

    const volumeString = this.mapVolumeToTFVFormat(monthlyVolume);

    // Log TFV submission details for debugging
    logInfo("TFV submission details", {
      subaccountSid,
      phoneNumber,
      phoneNumberSid,
      businessId,
      businessName: businessInfo.businessName,
      businessWebsite: businessInfo.websiteUrl,
      messageVolume: volumeString,
      externalReferenceId,
      useCases,
      hasBusinessEmail: !!businessInfo.email,
      hasBusinessAddress: !!(
        businessInfo.address1 &&
        businessInfo.city &&
        businessInfo.state
      ),
    });

    try {
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
          tollfreePhoneNumberSid: phoneNumberSid, // Use SID, not phone number
          useCaseCategories: useCases,
          useCaseSummary: `Monthly volume: ${monthlyVolume}. Use cases: ${useCases.join(
            ", "
          )}`,
          productionMessageSample: initialMessage,
          optInImageUrls: [], // Add if you have opt-in screenshots
          optInType: "VERBAL", // or 'WEB_FORM' based on your flow
          messageVolume: volumeString,
          externalReferenceId: externalReferenceId, // ✅ Use compliant external reference ID
        });

      logInfo("TFV submission successful", {
        tfvSid: tfvRequest.sid,
        status: tfvRequest.status,
        externalReferenceId,
        subaccountSid,
      });

      return {
        requestId: tfvRequest.sid,
        status: tfvRequest.status,
      };
    } catch (error: any) {
      logError("TFV submission failed", {
        subaccountSid,
        phoneNumber,
        businessName: businessInfo.businessName,
        error: error.message,
        code: error.code,
        status: error.status,
        moreInfo: error.moreInfo,
        externalReferenceId,
      });
      throw new Error(
        `TFV submission failed: ${error.message || "Unknown error"}`
      );
    }
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
      "1K to 10K": "10000", // ✅ Match frontend exactly
      "10K to 100K": "100000",
      "100K to 500K": "500000",
      "500K to 1M": "1000000",
      "More than 1M+": "1000000", // ✅ Match frontend exactly
    };

    return volumeMap[volume] || "10000";
  }

  /**
   * Generate short external reference ID compliant with Twilio's 50-char limit
   */
  private static generateExternalReferenceId(
    businessId: number,
    phoneNumberSid: string
  ): string {
    const phoneLast8 = phoneNumberSid.slice(-8);
    const externalRefId = `notiflow-biz${businessId}-${phoneLast8}`;

    // Validate length to ensure compliance
    if (externalRefId.length > 50) {
      throw new Error(
        `External reference ID too long: ${externalRefId.length} chars (max: 50)`
      );
    }

    return externalRefId;
  }

  /**
   * Validate TFV submission parameters
   */
  private static validateTFVSubmission(params: {
    businessInfo: BusinessInfo;
    monthlyVolume: string;
    useCases: string[];
    initialMessage: string;
  }): void {
    const { businessInfo, monthlyVolume, useCases, initialMessage } = params;

    const missing: string[] = [];

    if (!businessInfo.businessName?.trim()) missing.push("business name");
    if (!businessInfo.websiteUrl?.trim()) missing.push("business website");
    if (!monthlyVolume?.trim()) missing.push("monthly volume");
    if (!useCases?.length) missing.push("use cases");
    if (!initialMessage?.trim()) missing.push("initial message");

    if (missing.length > 0) {
      throw new Error(
        `TFV submission missing required fields: ${missing.join(", ")}`
      );
    }

    // Validate volume format
    const validVolumes = ["1000", "10000", "100000", "500000", "1000000"];
    const volumeString = this.mapVolumeToTFVFormat(monthlyVolume);
    if (!validVolumes.includes(volumeString)) {
      throw new Error(
        `Invalid volume format: ${volumeString}. Must be one of: ${validVolumes.join(
          ", "
        )}`
      );
    }
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
