import type { IStorage } from "../db/storage";
import { TwilioService } from "./twilio.js";
import { logError } from "../utils/logger.util";

export interface CampaignExecutionResult {
  sentCount: number;
  failedCount: number;
  totalContacts: number;
}

export class InsufficientCreditsError extends Error {
  constructor(message = "Insufficient credits") {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}

export async function executeCampaign(
  bizStorage: IStorage,
  campaignId: number
): Promise<CampaignExecutionResult> {
  const campaign = await bizStorage.getCampaign(campaignId);
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const contacts = (await bizStorage.getContacts()).filter((c) => c.active);

  if (contacts.length === 0) {
    return { sentCount: 0, failedCount: 0, totalContacts: 0 };
  }

  // Determine credit cost per message
  const isMMS = !!campaign.mediaUrl;
  const creditCost = isMMS ? 3 : 1;

  // --- CREDIT CHECK ONLY (no deduction yet) ---
  const credits = await bizStorage.getCredits();
  const balance = credits?.balance || 0;
  if (balance < contacts.length * creditCost) {
    throw new InsufficientCreditsError();
  }
  // --- END CREDIT CHECK ---

  const allCoupons = await bizStorage.getCoupons();
  const campaignCoupons = allCoupons.filter((c) =>
    campaign.message.includes(c.code)
  );

  for (const contact of contacts) {
    for (const coupon of campaignCoupons) {
      await bizStorage.createCouponRecipient({
        campaignId: campaign.id,
        contactId: contact.id,
        couponId: coupon.id,
      });
    }
  }

  const messagingServiceSid = await bizStorage.getMessagingServiceSid();
  const numbers = await bizStorage.getPhoneNumbers();
  const defaultNumber = numbers.find((n) => n.isDefault)?.phoneNumber;

  // Create a minimal creds object for compatibility
  const tempCreds = {
    businessId: (await bizStorage.getBusiness()).id,
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    messagingServiceSid: messagingServiceSid || null,
    createdAt: new Date(),
    updatedAt: new Date(),
    id: 0,
  };

  const smsMessages = contacts.map((contact) => ({
    to: contact.phoneNumber,
    message: campaign.message,
    campaignId: campaign.id,
    contactId: contact.id,
    from: defaultNumber,
    messagingServiceSid: messagingServiceSid ?? undefined,
    mediaUrl: campaign.mediaUrl || undefined,
  }));

  try {
    const results = await TwilioService.sendBulkSMS(tempCreds, smsMessages);

    let sentCount = 0;
    let deliveredCount = 0;
    let failedCount = 0;

    // Process results and count successes/failures
    for (const result of results) {
      if (result.success) {
        sentCount++;
      } else {
        failedCount++;
      }
    }

    // Only deduct credits for successfully sent messages
    if (sentCount > 0) {
      await bizStorage.adjustCredits(
        -sentCount * creditCost,
        isMMS ? "send_mms" : "send_sms",
        `Sent ${sentCount} ${isMMS ? "MMS" : "SMS"} for campaign ${campaignId}`,
        { campaignId, totalContacts: contacts.length, failedCount }
      );
    }

    // Update campaign with results
    await bizStorage.updateCampaign(campaignId, {
      status: "completed",
      sentCount,
      deliveredCount,
    });

    return { sentCount, failedCount, totalContacts: contacts.length };
  } catch (error) {
    // If sending fails completely, don't deduct any credits
    logError("Campaign execution failed, no credits deducted", {
      campaignId,
      error: error instanceof Error ? error.message : String(error),
      contactsCount: contacts.length,
    });
    throw error;
  }
}
