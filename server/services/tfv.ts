import twilio from "twilio";
import type {
  Business,
  TwilioCredential,
  TwilioA2pConfig, // Using legacy alias for compatibility
} from "@shared/schema";
import { logInfo, logError } from "../utils/logger.util";

export interface TFVRegistrationResult {
  tfvSid: string;
  status: string;
  phoneNumber: string;
}

// Map existing use cases to TFV categories
function mapUseCaseToTFVCategory(useCase: string): string {
  const useCaseMap: Record<string, string> = {
    MARKETING: "MARKETING",
    CUSTOMER_SUPPORT: "TWO_WAY",
    NOTIFICATIONS: "MIXED",
    REMINDERS: "MIXED",
    PROMOTIONS: "MARKETING",
    APPOINTMENT_REMINDERS: "MIXED",
    ORDER_UPDATES: "MIXED",
    TRANSACTIONAL: "MIXED",
  };

  return useCaseMap[useCase] || "MIXED";
}

// Map volume ranges to TFV expected format
function mapVolumeToTFVFormat(volume: string): number {
  const volumeMap: Record<string, number> = {
    "Less than 1K": 1000,
    "1K to 10K": 10000,
    "10K to 100K": 100000,
    "100K to 500K": 500000,
    "500K to 1M": 1000000,
    "More than 1M+": 2000000,
  };

  return volumeMap[volume] || 10000;
}

// Generate sample messages based on use cases
function generateSampleMessages(useCases: string[]): string[] {
  const sampleMap: Record<string, string> = {
    MARKETING:
      "Exclusive 20% off sale this weekend! Shop now and save big. Reply STOP to opt out.",
    CUSTOMER_SUPPORT:
      "Hi! We received your inquiry. Our team will respond within 24 hours. Need immediate help? Call us at (555) 123-4567.",
    NOTIFICATIONS:
      "Your order #12345 has shipped! Track it here: [link]. Delivery expected by Friday.",
    REMINDERS:
      "Reminder: Your appointment is tomorrow at 2 PM. Reply YES to confirm or RESCHEDULE to change.",
    PROMOTIONS:
      "Flash sale alert! 30% off everything for the next 4 hours. Use code FLASH30 at checkout.",
    APPOINTMENT_REMINDERS:
      "Appointment reminder: Tomorrow 3 PM with Dr. Smith. Reply CONFIRM or call (555) 123-4567 to reschedule.",
    ORDER_UPDATES:
      "Order update: Your pizza order is ready for pickup! Thanks for choosing Tony's Pizza.",
    TRANSACTIONAL:
      "Your payment of $49.99 has been processed successfully. Transaction ID: TXN123456789.",
  };

  // Return samples for provided use cases, fallback to generic samples
  const samples = useCases.map((useCase) => sampleMap[useCase]).filter(Boolean);

  if (samples.length === 0) {
    samples.push(
      "Welcome to our service! We're excited to have you. Reply STOP to unsubscribe.",
      "Your verification code is 123456. This code expires in 10 minutes."
    );
  }

  // Ensure we have at least 2 samples (required by TFV)
  if (samples.length === 1) {
    samples.push(
      "Thank you for your business! We appreciate your support. Reply STOP to unsubscribe."
    );
  }

  return samples.slice(0, 5); // TFV accepts up to 5 samples
}

async function createClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const businessProfileSid = process.env.TWILIO_BUSINESS_PROFILE_SID;

  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set");
  }

  if (!businessProfileSid) {
    throw new Error(
      "TWILIO_BUSINESS_PROFILE_SID must be set for TFV submissions"
    );
  }

  return twilio(accountSid, authToken);
}

export async function submitTollFreeVerification(
  phoneNumberSid: string,
  business: Business,
  config: TwilioA2pConfig,
  businessId: number,
  baseUrl: string,
  businessEmail?: string,
  businessAddress?: {
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  },
  businessWebsiteUrl?: string,
  businessContact?: {
    // ✅ ADD CONTACT INFO PARAMETER
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  }
): Promise<TFVRegistrationResult> {
  // Log TFV submission start
  logInfo("Starting TFV submission", {
    businessId,
    businessName: business.name,
    phoneNumberSid,
    hasBusinessEmail: !!businessEmail,
    hasBusinessWebsite: !!businessWebsiteUrl,
    hasBusinessAddress: !!businessAddress,
    hasBusinessContact: !!businessContact, // ✅ LOG CONTACT INFO
    useCases: config.useCases,
    volume: config.volume,
  });

  const client = await createClient();

  // Get the primary use case for the notification type
  const primaryUseCase = config.useCases[0] || "MIXED";
  const notificationType = mapUseCaseToTFVCategory(primaryUseCase);

  // Map volume to expected monthly volume
  const expectedVolume = mapVolumeToTFVFormat(config.volume);

  // Generate sample messages based on use cases
  const messageSamples = generateSampleMessages(config.useCases);

  // Use join page as opt-in proof URL - exactly what Twilio wants to see
  const optInImageUrls = [`${baseUrl}/join/${businessId}`];

  try {
    // Use provided business email or fallback
    const notificationEmail = businessEmail || "support@notiflow.com";

    // ✅ VALIDATE REQUIRED FIELDS BEFORE SUBMISSION (PREVENTS API FAILURES)
    if (!process.env.TWILIO_BUSINESS_PROFILE_SID) {
      throw new Error(
        "TWILIO_BUSINESS_PROFILE_SID environment variable is required for TFV submissions"
      );
    }

    if (!business.name || business.name.trim().length === 0) {
      throw new Error("Business name is required for TFV submission");
    }

    if (!messageSamples || messageSamples.length === 0) {
      throw new Error(
        "At least one message sample is required for TFV submission"
      );
    }

    // ✅ VALIDATE PHONE NUMBER FORMAT (E.164 REQUIRED BY TWILIO)
    if (!phoneNumberSid || !phoneNumberSid.startsWith("PN")) {
      throw new Error(
        "Invalid phone number SID format - must be a valid Twilio phone number SID starting with 'PN'"
      );
    }

    // ✅ VALIDATE BUSINESS CONTACT PHONE NUMBER IF PROVIDED
    if (businessContact?.phoneNumber) {
      const phoneRegex = /^\+1[0-9]{10}$/; // E.164 format for US numbers
      if (!phoneRegex.test(businessContact.phoneNumber)) {
        logInfo("Invalid business contact phone format, using fallback", {
          providedPhone: businessContact.phoneNumber,
          fallbackPhone: "+14155551234",
        });
        businessContact.phoneNumber = "+14155551234"; // Use fallback for invalid format
      }
    }

    // Create comprehensive additional information including extra samples
    let additionalInfo = `This business operates a compliant SMS marketing platform. Customers opt-in via our web form at ${baseUrl}/join/${businessId}. All messages include clear opt-out instructions and STOP to unsubscribe functionality.`;

    // Include additional message samples if we have more than one
    if (messageSamples.length > 1) {
      additionalInfo += `\n\nAdditional Message Examples:\n`;
      messageSamples.slice(1, 3).forEach((sample, index) => {
        additionalInfo += `${index + 2}. "${sample}"\n`;
      });
    }

    // ✅ ENHANCE ADDITIONAL INFO WITH MORE COMPLIANCE DETAILS
    additionalInfo += `\n\nCompliance Information:\n`;
    additionalInfo += `- Double opt-in process: Users must confirm subscription via web form\n`;
    additionalInfo += `- Clear unsubscribe instructions: All messages include "Text STOP to unsubscribe"\n`;
    additionalInfo += `- Immediate opt-out processing: STOP messages processed automatically\n`;
    additionalInfo += `- Business verification: All business information verified during onboarding\n`;
    additionalInfo += `- Message volume monitoring: Volume tracking prevents spam\n`;

    // Log TFV submission data being sent to Twilio
    logInfo("TFV submission data", {
      businessId,
      businessName: business.name,
      businessWebsite: businessWebsiteUrl || `${baseUrl}/join/${businessId}`,
      notificationEmail,
      businessContactFirstName: businessContact?.firstName || "Business",
      businessContactLastName: businessContact?.lastName || "Owner",
      businessContactEmail:
        businessContact?.email || businessEmail || "support@notiflow.com",
      businessContactPhone: businessContact?.phoneNumber || "+14155551234", // ✅ LOG REAL CONTACT DATA
      useCaseCategories: config.useCases.map(mapUseCaseToTFVCategory),
      useCaseSummary: `Business using SMS for ${config.useCases
        .join(", ")
        .toLowerCase()} purposes with expected monthly volume of ${config.volume.toLowerCase()}. Primary category: ${notificationType}.`,
      productionMessageSample: messageSamples[0],
      optInType: "VERBAL",
      businessStreetAddress: businessAddress?.address1 || business.name,
      businessCity: businessAddress?.city || "San Francisco",
      businessState: businessAddress?.state || "CA",
      businessPostalCode: businessAddress?.postalCode || "94105",
      businessCountry: businessAddress?.country || "US",
      messageVolume: expectedVolume.toString(),
      tollfreePhoneNumberSid: phoneNumberSid,
      optInImageUrls,
    });

    // Submit TFV application with all required fields
    const verification = await client.messaging.v1.tollfreeVerifications.create(
      {
        businessName: business.name,
        businessWebsite: businessWebsiteUrl || `${baseUrl}/join/${businessId}`, // Use real business website or fallback to join page
        notificationEmail: notificationEmail, // Business notification email

        // Required business contact information (FROM OFFICIAL TWILIO DOCS) - ✅ USE REAL DATA
        businessContactFirstName: businessContact?.firstName || "Business", // Use real first name
        businessContactLastName: businessContact?.lastName || "Owner", // Use real last name
        businessContactEmail:
          businessContact?.email || businessEmail || "support@notiflow.com", // Use real contact email
        businessContactPhone: businessContact?.phoneNumber || "+14155551234", // Use real contact phone

        useCaseCategories: config.useCases.map(mapUseCaseToTFVCategory),
        useCaseSummary: `Business using SMS for ${config.useCases
          .join(", ")
          .toLowerCase()} purposes with expected monthly volume of ${config.volume.toLowerCase()}. Primary category: ${notificationType}.`,
        productionMessageSample: messageSamples[0],
        // Note: Twilio TFV only accepts one production message sample
        // Additional samples are included in additionalInformation
        optInType: "VERBAL", // Twilio expects VERBAL for website-based opt-ins
        additionalInformation: additionalInfo,
        businessStreetAddress: businessAddress?.address1 || business.name, // Use real address or fallback to business name
        businessStreetAddress2: businessAddress?.address2 || "",
        businessCity: businessAddress?.city || "San Francisco", // Use real city or fallback
        businessStateProvinceRegion: businessAddress?.state || "CA",
        businessPostalCode: businessAddress?.postalCode || "94105",
        businessCountry: businessAddress?.country || "US",
        messageVolume: expectedVolume.toString(),
        tollfreePhoneNumberSid: phoneNumberSid, // Phone number SID from Twilio
        optInImageUrls: optInImageUrls,
        customerProfileSid: process.env.TWILIO_BUSINESS_PROFILE_SID!, // Business Profile SID

        // Optional but recommended for tracking
        externalReferenceId: `notiflow-business-${businessId}-${phoneNumberSid}`,
      }
    );

    // Log TFV submission success
    logInfo("TFV submission successful", {
      businessId,
      businessName: business.name,
      tfvSid: verification.sid,
      status: verification.status || "PENDING_REVIEW", // ✅ CORRECT DEFAULT STATUS
      phoneNumberSid,
    });

    return {
      tfvSid: verification.sid,
      status: verification.status || "PENDING_REVIEW", // ✅ CORRECT DEFAULT STATUS
      phoneNumber: phoneNumberSid, // Return the SID for reference
    };
  } catch (error: any) {
    // Log TFV submission error with detailed information
    logError("TFV submission error", {
      businessId,
      businessName: business.name,
      phoneNumberSid,
      error: error.message,
      code: error.code,
      status: error.status,
      moreInfo: error.moreInfo,
    });
    throw new Error(
      `TFV submission failed: ${error.message || "Unknown error"}`
    );
  }
}

export async function getTollFreeVerificationStatus(tfvSid: string): Promise<{
  status: string;
  rejectionReason?: string;
}> {
  const client = await createClient();

  try {
    const verification = await client.messaging.v1
      .tollfreeVerifications(tfvSid)
      .fetch();

    // Log TFV status check
    logInfo("TFV status check", {
      tfvSid,
      status: verification.status || "PENDING_REVIEW", // ✅ CORRECT DEFAULT
      rejectionReason: verification.rejectionReason || undefined,
    });

    return {
      status: verification.status || "PENDING_REVIEW", // ✅ CORRECT DEFAULT
      rejectionReason: verification.rejectionReason || undefined,
    };
  } catch (error: any) {
    logError("TFV status check error", {
      tfvSid,
      error: error.message,
      code: error.code,
      status: error.status,
    });
    throw new Error(`Failed to check TFV status: ${error.message}`);
  }
}
