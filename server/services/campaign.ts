import type { IStorage } from "../storage";
import { TwilioService } from "./twilio";

export async function executeCampaign(bizStorage: IStorage, campaignId: number) {
  const campaign = await bizStorage.getCampaign(campaignId);
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const contacts = await bizStorage.getContacts();

  if (contacts.length === 0) {
    return { sentCount: 0, totalContacts: 0 };
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

  const creds = await bizStorage.getTwilioCredentials();
  const numbers = await bizStorage.getPhoneNumbers();
  const defaultNumber = numbers.find(n => n.isDefault)?.phoneNumber;

  const smsMessages = contacts.map(contact => ({
    to: contact.phoneNumber,
    message: campaign.message,
    campaignId: campaign.id,
    contactId: contact.id,
    from: defaultNumber,
    messagingServiceSid: creds?.messagingServiceSid || undefined,
  }));

  const results = await TwilioService.sendBulkSMS(creds, smsMessages);

  let sentCount = 0;
  let deliveredCount = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const contact = contacts[i];

    const messageData = {
      phoneNumber: contact.phoneNumber,
      contactId: contact.id,
      content: campaign.message,
      status: result.success ? "sent" : "failed",
      campaignId: campaign.id,
    };

    await bizStorage.createMessage(messageData);

    if (result.success) {
      sentCount++;
      deliveredCount++; // Assume delivered until webhook updates
    }
  }

  await bizStorage.updateCampaign(campaignId, {
    status: "completed",
    sentCount: (campaign.sentCount || 0) + sentCount,
    deliveredCount: (campaign.deliveredCount || 0) + deliveredCount,
  });

  return { sentCount, totalContacts: contacts.length };
}
