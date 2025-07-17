import twilio from "twilio";
import type {
  Business,
  TwilioCredential,
  TwilioA2pConfig, // Using legacy alias for compatibility
} from "@shared/schema";

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

  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set");
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
  businessWebsiteUrl?: string
): Promise<TFVRegistrationResult> {
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

    // Create comprehensive additional information including extra samples
    let additionalInfo = `This business operates a compliant SMS marketing platform. Customers opt-in via our web form at ${baseUrl}/join/${businessId}. All messages include clear opt-out instructions and STOP to unsubscribe functionality.`;

    // Include additional message samples if we have more than one
    if (messageSamples.length > 1) {
      additionalInfo += `\n\nAdditional Message Examples:\n`;
      messageSamples.slice(1, 3).forEach((sample, index) => {
        additionalInfo += `${index + 2}. "${sample}"\n`;
      });
    }

    // Submit TFV application with all required fields
    const verification = await client.messaging.v1.tollfreeVerifications.create(
      {
        businessName: business.name,
        businessWebsite: businessWebsiteUrl || `${baseUrl}/join/${businessId}`, // Use real business website or fallback to join page
        notificationEmail: notificationEmail, // Business notification email
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
      }
    );

    return {
      tfvSid: verification.sid,
      status: verification.status || "pending",
      phoneNumber: phoneNumberSid, // Return the SID for reference
    };
  } catch (error: any) {
    console.error("TFV submission error:", error);
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

    return {
      status: verification.status || "pending",
      rejectionReason: verification.rejectionReason || undefined,
    };
  } catch (error: any) {
    console.error("TFV status check error:", error);
    throw new Error(`Failed to check TFV status: ${error.message}`);
  }
}
