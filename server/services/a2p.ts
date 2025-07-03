import twilio from "twilio";
import { decrypt } from "../utils/encryption.util";
import type {
  BusinessProfile,
  Business,
  TwilioCredential,
  TwilioA2pConfig,
} from "@shared/schema";

export interface A2PRegistrationResult {
  customerProfileSid: string;
  brandSid: string;
  campaignSid: string;
  status: string;
}

export interface CampaignRegistrationResult {
  brandSid: string;
  campaignSid: string;
  status: string;
}

async function createClient(creds: TwilioCredential) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set");
  }

  return twilio(accountSid, authToken);
}

export async function registerBusinessForA2P(
  creds: TwilioCredential,
  business: Business,
  profile: BusinessProfile,
  config: TwilioA2pConfig
): Promise<A2PRegistrationResult> {
  const client = await createClient(creds);

  // Create customer profile
  const customer = await client.trusthub.v1.customerProfiles.create({
    friendlyName: business.name,
    email: profile.repEmail,
    policySid: "RNXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", // US A2P policy SID
  });

  // Register brand
  const highVolume = ["100K to 500K", "500K to 1M", "More than 1M+"];
  const brandType = highVolume.includes(config.volume)
    ? "STANDARD"
    : "LOW_VOLUME";
  const brand = await client.messaging.v1.brandRegistrations.create({
    customerProfileBundleSid: customer.sid,
    a2PProfileBundleSid: customer.sid,
    brandType,
  });

  // Register campaign
  const campaign = await client.messaging.v1
    .services(creds.messagingServiceSid!)
    .usAppToPerson.create({
      brandRegistrationSid: brand.sid,
      description: profile.campaignDescription,
      messageFlow: "User opt in via website form",
      messageSamples: [profile.sample1, profile.sample2],
      usAppToPersonUsecase: config.useCases[0] || profile.useCase,
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

export async function registerCampaignForA2P(
  creds: TwilioCredential,
  profile: BusinessProfile,
  config: TwilioA2pConfig
): Promise<CampaignRegistrationResult> {
  if (!profile.customerProfileSid) {
    throw new Error("Customer profile SID is missing");
  }

  const client = await createClient(creds);

  const highVolume = ["100K to 500K", "500K to 1M", "More than 1M+"];
  const brandType = highVolume.includes(config.volume)
    ? "STANDARD"
    : "LOW_VOLUME";

  const brand = await client.messaging.v1.brandRegistrations.create({
    customerProfileBundleSid: profile.customerProfileSid,
    a2PProfileBundleSid: profile.customerProfileSid,
    brandType,
  });

  const campaign = await client.messaging.v1
    .services(creds.messagingServiceSid!)
    .usAppToPerson.create({
      brandRegistrationSid: brand.sid,
      description: profile.campaignDescription,
      messageFlow: "User opt in via website form",
      messageSamples: [profile.sample1, profile.sample2],
      usAppToPersonUsecase: config.useCases[0] || profile.useCase,
      hasEmbeddedLinks: false,
      hasEmbeddedPhone: false,
    });

  return {
    brandSid: brand.sid,
    campaignSid: campaign.sid,
    status: (campaign as any).campaignStatus || "pending",
  };
}
