import { storage } from "../storage";
import { TwilioService } from "./twilio";
import type { Campaign } from "@shared/schema";

export async function executeCampaign(campaignId: number) {
  const campaign = await storage.getCampaign(campaignId);
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const contacts = await storage.getContactsBySegment(campaign.audience);

  if (contacts.length === 0) {
    return { sentCount: 0, totalContacts: 0 };
  }

  const allCoupons = await storage.getCoupons();
  const campaignCoupons = allCoupons.filter(c =>
    campaign.message.includes(c.code),
  );

  for (const contact of contacts) {
    for (const coupon of campaignCoupons) {
      await storage.createCouponRecipient({
        campaignId: campaign.id,
        contactId: contact.id,
        couponId: coupon.id,
      });
    }
  }

  const smsMessages = contacts.map(contact => ({
    to: contact.phoneNumber,
    message: campaign.message,
    campaignId: campaign.id,
    contactId: contact.id,
  }));

  const results = await TwilioService.sendBulkSMS(smsMessages);

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

    await storage.createMessage(messageData);

    if (result.success) {
      sentCount++;
      deliveredCount++; // Assume delivered until webhook updates
    }
  }

  await storage.updateCampaign(campaignId, {
    status: "completed",
    sentCount: (campaign.sentCount || 0) + sentCount,
    deliveredCount: (campaign.deliveredCount || 0) + deliveredCount,
  });

  return { sentCount, totalContacts: contacts.length };
}
