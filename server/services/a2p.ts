import twilio from "twilio";
import { decrypt } from "../utils/encryption.util";
import type { BusinessProfile, Business, TwilioCredential } from "@shared/schema";

export interface A2PRegistrationResult {
  customerProfileSid: string;
  brandSid: string;
  campaignSid: string;
  status: string;
}

async function createClient(creds: TwilioCredential) {
  const token = decrypt(creds.authTokenEncrypted);
  return twilio(creds.accountSid, token);
}

export async function registerBusinessForA2P(
  creds: TwilioCredential,
  business: Business,
  profile: BusinessProfile,
): Promise<A2PRegistrationResult> {
  const client = await createClient(creds);

  // Create customer profile
  const customer = await client.trusthub.v1.customerProfiles.create({
    friendlyName: business.name,
    email: profile.repEmail,
    policySid: "RNXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", // US A2P policy SID
  });

  // Register brand
  const brand = await client.messaging.v1.brandRegistrations.create({
    customerProfileBundleSid: customer.sid,
    a2PProfileBundleSid: customer.sid,
    brandType: "LOW_VOLUME", // default to low volume standard
  });

  // Register campaign
  const campaign = await client.messaging.v1
    .services(creds.messagingServiceSid!)
    .usAppToPerson.create({
      brandRegistrationSid: brand.sid,
      description: profile.campaignDescription,
      messageFlow: "User opt in via website form",
      messageSamples: [profile.sample1, profile.sample2],
      usAppToPersonUsecase: profile.useCase,
      hasEmbeddedLinks: false,
      hasEmbeddedPhone: false,
    });

  return {
    customerProfileSid: customer.sid,
    brandSid: brand.sid,
    campaignSid: campaign.sid,
    status: (campaign as any).campaignStatus || "pending",
  };
}
