import type { IStorage } from "../db/storage";
import { UniversalMessageService } from "./universal-message.js";
import { MessageCreditService } from "./message-credits.js";
import { logError } from "../utils/logger.util";
import { logInfo } from "../utils/logger.util";

export interface CampaignExecutionResult {
  sentCount: number;
  queuedCount: number;
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
    return { sentCount: 0, queuedCount: 0, failedCount: 0, totalContacts: 0 };
  }

  // Determine credit cost per message using accurate Twilio segmentation
  const creditCost = MessageCreditService.calculateCreditCost(
    campaign.message,
    !!campaign.mediaUrl
  );

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

  const business = await bizStorage.getBusiness();
  const messagingServiceSid = await bizStorage.getMessagingServiceSid();
  const numbers = await bizStorage.getPhoneNumbers();
  const defaultNumber = numbers.find((n) => n.isDefault)?.phoneNumber;

  try {
    let sentCount = 0;
    let queuedCount = 0;
    let failedCount = 0;

    // Send messages to each contact using UniversalMessageService
    // This will handle TCPA quiet hours compliance automatically
    for (const contact of contacts) {
      try {
        const result = await UniversalMessageService.sendMessage(bizStorage, {
          businessId: business.id,
          phoneNumber: contact.phoneNumber,
          messageContent: campaign.message,
          messageType: "campaign",
          contactId: contact.id,
          campaignId: campaign.id,
          from: defaultNumber,
          messagingServiceSid: messagingServiceSid ?? undefined,
          mediaUrl: campaign.mediaUrl || undefined,
        });

        if (result.status === "sent") {
          sentCount++;
        } else if (result.status === "queued") {
          queuedCount++;
        }
      } catch (error) {
        failedCount++;
        logError("Failed to send campaign message to contact", {
          campaignId,
          contactId: contact.id,
          phoneNumber: contact.phoneNumber,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Credits are automatically deducted by UniversalMessageService for sent messages
    // Queued messages will have credits deducted when they are actually sent

    logInfo("Campaign execution completed", {
      campaignId,
      sentCount,
      queuedCount,
      failedCount,
      totalContacts: contacts.length,
    });

    // Update campaign with results
    await bizStorage.updateCampaign(campaignId, {
      status: "completed",
      sentCount: sentCount + queuedCount, // Total processed (sent + queued)
      deliveredCount: sentCount, // Actually delivered immediately
    });

    return {
      sentCount,
      queuedCount,
      failedCount,
      totalContacts: contacts.length,
    };
  } catch (error) {
    logError("Campaign execution failed", {
      campaignId,
      error: error instanceof Error ? error.message : String(error),
      contactsCount: contacts.length,
    });
    throw error;
  }
}
