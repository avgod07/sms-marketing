import client from './twilio-client.js';
import type {
  BusinessProfile,
  Business,
  TwilioA2pConfig,
} from '@shared/schema';

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

export async function registerBusinessForA2P(
  messagingServiceSid: string,
  business: Business,
  profile: BusinessProfile,
  config: TwilioA2pConfig,
): Promise<A2PRegistrationResult> {
  const customer = await client.trusthub.v1.customerProfiles.create({
    friendlyName: business.name,
    email: profile.repEmail,
    policySid: 'RNXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  });

  const highVolume = ['100K to 500K', '500K to 1M', 'More than 1M+'];
  const brandType = highVolume.includes(config.volume) ? 'STANDARD' : 'LOW_VOLUME';
  const brand = await client.messaging.v1.brandRegistrations.create({
    customerProfileBundleSid: customer.sid,
    a2PProfileBundleSid: customer.sid,
    brandType,
  });

  const campaign = await client.messaging.v1
    .services(messagingServiceSid)
    .usAppToPerson.create({
      brandRegistrationSid: brand.sid,
      description: profile.campaignDescription,
      messageFlow: 'User opt in via website form',
      messageSamples: [profile.sample1, profile.sample2],
      usAppToPersonUsecase: config.useCases[0] || profile.useCase,
      hasEmbeddedLinks: false,
      hasEmbeddedPhone: false,
    });

  return {
    customerProfileSid: customer.sid,
    brandSid: brand.sid,
    campaignSid: campaign.sid,
    status: (campaign as any).campaignStatus || 'pending',
  };
}

export async function registerCampaignForA2P(
  messagingServiceSid: string,
  profile: BusinessProfile,
  config: TwilioA2pConfig,
): Promise<CampaignRegistrationResult> {
  if (!profile.customerProfileSid) {
    throw new Error('Customer profile SID is missing');
  }

  const highVolume = ['100K to 500K', '500K to 1M', 'More than 1M+'];
  const brandType = highVolume.includes(config.volume) ? 'STANDARD' : 'LOW_VOLUME';

  const brand = await client.messaging.v1.brandRegistrations.create({
    customerProfileBundleSid: profile.customerProfileSid,
    a2PProfileBundleSid: profile.customerProfileSid,
    brandType,
  });

  const campaign = await client.messaging.v1
    .services(messagingServiceSid)
    .usAppToPerson.create({
      brandRegistrationSid: brand.sid,
      description: profile.campaignDescription,
      messageFlow: 'User opt in via website form',
      messageSamples: [profile.sample1, profile.sample2],
      usAppToPersonUsecase: config.useCases[0] || profile.useCase,
      hasEmbeddedLinks: false,
      hasEmbeddedPhone: false,
    });

  return {
    brandSid: brand.sid,
    campaignSid: campaign.sid,
    status: (campaign as any).campaignStatus || 'pending',
  };
}
