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
      .incomingPhoneNumbers.list();

    const phoneNumberSid = phoneNumbers.find(
      (pn) => pn.phoneNumber === phoneNumber
    )?.sid;
    if (!phoneNumberSid) {
      throw new Error(
        `Phone number ${phoneNumber} not found in subaccount ${subaccountSid}`
      );
    }

    const externalReferenceId = this.generateExternalReferenceId(
      businessId,
      phoneNumberSid
    );
    const volumeString = this.mapVolumeToTFVFormat(monthlyVolume);

    // Generate comprehensive TFV-compliant descriptions
    const compliantUseCaseDescriptions =
      this.mapUseCasesToCompliantDescriptions(useCases);
    const optInFlowDescription = this.generateOptInFlowDescription();
    const messageSamples = this.generateUniversalMessageSamples(
      businessInfo.businessName
    );

    // Create comprehensive use case summary
    const useCaseSummary = `This toll-free number will be used for the following business communications: ${compliantUseCaseDescriptions.join(
      ". "
    )}. Monthly message volume: ${monthlyVolume}. All recipients have provided explicit opt-in consent as detailed in our opt-in workflow.`;

    logInfo("Preparing TFV submission with comprehensive data", {
      businessId,
      subaccountSid,
      phoneNumberSid,
      externalReferenceId,
      volumeString,
      useCaseCount: compliantUseCaseDescriptions.length,
      messageSampleCount: messageSamples.length,
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
          // ✅ BUSINESS INFORMATION (Required)
          businessName: businessInfo.businessName,
          businessWebsite:
            businessInfo.websiteUrl ||
            `https://notiflow.com/business/${businessId}`,
          businessStreetAddress: businessInfo.address1 || "",
          businessStreetAddress2: businessInfo.address2 || "",
          businessCity: businessInfo.city || "",
          businessStateProvinceRegion: businessInfo.state || "",
          businessPostalCode: businessInfo.postalCode || "",
          businessCountry: businessInfo.country || "US",

          // ✅ BUSINESS CONTACT (Required)
          businessContactFirstName: businessInfo.firstName || "",
          businessContactLastName: businessInfo.lastName || "",
          businessContactEmail: businessInfo.email || "",
          businessContactPhone: businessInfo.phoneNumber || "",
          notificationEmail: businessInfo.email || "", // Required field

          // ✅ PHONE NUMBER (Required)
          tollfreePhoneNumberSid: phoneNumberSid,

          // ✅ USE CASES (Updated with detailed descriptions)
          useCaseCategories: compliantUseCaseDescriptions,
          useCaseSummary: useCaseSummary,

          // ✅ MESSAGE SAMPLES (Universal examples)
          productionMessageSample: messageSamples[0],

          // ✅ OPT-IN INFORMATION (Comprehensive description)
          optInType: "WEB_FORM", // More accurate than VERBAL for web-based platform
          optInImageUrls: [], // Can be added later if screenshots available

          // ✅ VOLUME (Fixed format)
          messageVolume: volumeString,

          // ✅ ADDITIONAL INFORMATION (All message samples + opt-in description)
          additionalInformation: `OPT-IN WORKFLOW: ${optInFlowDescription}

ADDITIONAL MESSAGE SAMPLES: ${messageSamples
            .slice(1)
            .join(
              " | "
            )}. All messages include clear opt-out instructions and comply with messaging best practices.`,

          // ✅ TRACKING (Compliant external reference)
          externalReferenceId: externalReferenceId,
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
   * Map volume string to TFV format with comma-separated numbers for better Twilio compatibility
   */
  private static mapVolumeToTFVFormat(volume: string): string {
    const volumeMap: Record<string, string> = {
      "Less than 1K": "1,000", // ✅ Comma format for readability
      "1K to 10K": "10,000", // ✅ Comma format for readability
      "10K to 100K": "100,000", // ✅ Comma format for readability
      "100K to 500K": "500,000", // ✅ Comma format for readability
      "500K to 1M": "1,000,000", // ✅ Comma format for readability
      "More than 1M+": "1,000,000", // ✅ Comma format for readability
    };

    return volumeMap[volume] || "10,000";
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
    const validVolumes = ["1,000", "10,000", "100,000", "500,000", "1,000,000"];
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
   * Map frontend use case selections to Twilio-compliant detailed descriptions
   * These descriptions are universal and work for ALL business types
   */
  private static mapUseCasesToCompliantDescriptions(
    useCases: string[]
  ): string[] {
    const useCaseDescriptions: Record<string, string> = {
      "Account Notifications":
        "CUSTOMER_CARE - This number will be used to send account-related notifications including login alerts, password changes, security notifications, account status updates, and service-related communications to existing customers who have opted in to receive messages.",

      "Customer Care":
        "CUSTOMER_CARE - This number will be used to provide customer support communications including service inquiries, technical support responses, account assistance, billing questions, and general customer service interactions to customers who have requested support.",

      "Charity / Nonprofit":
        "OTHER - This number will be used by a charitable or nonprofit organization to send donation acknowledgments, volunteer coordination messages, event notifications, fundraising communications, and program updates to supporters who have opted in to receive messages.",

      "Delivery Notifications":
        "CUSTOMER_CARE - This number will be used to send delivery and shipping notifications including order confirmations, tracking updates, delivery schedules, pickup notifications, and shipping status alerts to customers who have placed orders.",

      "Fraud Alert Messaging":
        "CUSTOMER_CARE - This number will be used to send fraud prevention and security alert messages including suspicious activity notifications, transaction verifications, account security warnings, and identity protection alerts to account holders.",

      Events:
        "MARKETING - This number will be used to send event-related communications including event announcements, registration confirmations, schedule updates, reminder notifications, and post-event follow-ups to attendees who have opted in to receive messages.",

      "Higher Education":
        "CUSTOMER_CARE - This number will be used by educational institutions to send academic notifications including class schedules, assignment reminders, grade notifications, campus alerts, and administrative communications to students and faculty.",

      "K–12 Education":
        "CUSTOMER_CARE - This number will be used by educational institutions to send school-related communications including attendance notifications, parent updates, emergency alerts, event announcements, and administrative messages to students and parents.",

      Marketing:
        "MARKETING - This number will be used to send promotional marketing communications including special offers, product announcements, sales notifications, promotional campaigns, and marketing messages to customers who have explicitly opted in to receive promotional content.",

      "Polling and Voting (Non-Political)":
        "OTHER - This number will be used to conduct non-political surveys, polls, and voting activities including customer feedback requests, opinion surveys, product ratings, service evaluations, and general polling communications.",

      "Political Election Campaigns":
        "POLITICAL - This number will be used for political campaign communications including candidate information, voting reminders, campaign updates, rally notifications, and political messaging to voters who have opted in to receive political communications.",

      "Public Service Announcements":
        "OTHER - This number will be used to send public service announcements including community notifications, safety alerts, government communications, emergency information, and public awareness messages to community members.",
    };

    return useCases.map(
      (useCase) =>
        useCaseDescriptions[useCase] ||
        `OTHER - This number will be used for ${useCase.toLowerCase()} communications to customers who have opted in to receive messages.`
    );
  }

  /**
   * Generate comprehensive universal opt-in flow description
   */
  private static generateOptInFlowDescription(): string {
    return `Customers provide consent through multiple methods: 

1) Web-based platform: During account registration or service signup, customers explicitly check a box stating "I agree to receive text messages from [Business Name] including promotional offers, service updates, and account notifications. Message and data rates may apply. Reply STOP to opt out."

2) QR Code opt-in: Customers scan QR codes displayed in business locations, marketing materials, or digital advertisements which direct them to a mobile-optimized web form where they enter their phone number and provide the same explicit consent as described above.

3) Text-based opt-in: Customers can text keywords (such as "JOIN" or "START") to the business number, which triggers an automated response requesting confirmation of consent with clear opt-out instructions.

All opt-in methods are standalone consent forms not embedded with other agreements, clearly identify the business name, specify the types of messages to be received, and include standard opt-out language. Consent is collected before any messages are sent and records are maintained for compliance purposes.`;
  }

  /**
   * Generate universal message samples that work for all business types
   */
  private static generateUniversalMessageSamples(
    businessName: string
  ): string[] {
    return [
      `Hi [Name], your appointment with ${businessName} is confirmed for [Date] at [Time]. Reply STOP to opt out.`,
      `Your order #[OrderID] has been shipped! Track at [Link]. Questions? Reply or call [Phone]. Reply STOP to opt out.`,
      `${businessName}: Your account balance is $[Amount]. Need help? Reply or visit [Website]. Reply STOP to opt out.`,
      `Thank you for your business! We appreciate your support. Reply STOP to unsubscribe.`,
      `Welcome to ${businessName}! We're excited to have you. Reply STOP to opt out.`,
    ];
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
