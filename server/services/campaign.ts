import type { IStorage } from "../db/storage";
import { TwilioService } from "./twilio";

export interface CampaignExecutionResult {
  sentCount: number;
  failedCount: number;
  totalContacts: number;
}

export async function executeCampaign(
  bizStorage: IStorage,
  campaignId: number,
): Promise<CampaignExecutionResult> {
  const campaign = await bizStorage.getCampaign(campaignId);
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const contacts = (await bizStorage.getContacts()).filter(c => c.active);

  if (contacts.length === 0) {
    return { sentCount: 0, failedCount: 0, totalContacts: 0 };
  }

  const allCoupons = await bizStorage.getCoupons();
  const campaignCoupons = allCoupons.filter(c =>
    campaign.message.includes(c.code),
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

  const numbers = await bizStorage.getPhoneNumbers();
  const defaultNumber = numbers.find(n => n.isDefault)?.phoneNumber;
  const defaultServiceSid = numbers.find(n => n.isDefault)?.serviceSid;

  if (!defaultNumber && !defaultServiceSid) {
    throw new Error(
      'This business has not completed onboarding or lacks a valid phone number.',
    );
  }

  const smsMessages = contacts.map(contact => ({
    to: contact.phoneNumber,
    message: campaign.message,
    campaignId: campaign.id,
    contactId: contact.id,
    from: defaultNumber,
    messagingServiceSid: defaultServiceSid || undefined,
  }));

  const results = await TwilioService.sendBulkSMS(smsMessages);

  let sentCount = 0;
  let deliveredCount = 0;
  let failedCount = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const contact = contacts[i];

    const messageData = {
      phoneNumber: contact.phoneNumber,
      contactId: contact.id,
      content: campaign.message,
      status: result.success ? "sent" : "failed",
      campaignId: campaign.id,
      messageSid: result.messageSid,
    };

    await bizStorage.createMessage(messageData);

    if (result.success) {
      sentCount++;
      deliveredCount++; // Assume delivered until webhook updates
    } else {
      failedCount++;
    }
  }

  const totalAttempts = sentCount + failedCount;
  const failureRate = totalAttempts > 0 ? failedCount / totalAttempts : 0;
  const status = sentCount === 0 || failureRate >= 0.8 ? "failed" : "in_progress";

  await bizStorage.updateCampaign(campaignId, {
    status,
    sentCount: (campaign.sentCount || 0) + sentCount,
    deliveredCount: (campaign.deliveredCount || 0) + deliveredCount,
  });

  return { sentCount, failedCount, totalContacts: contacts.length };
}
