import type { IStorage } from "../db/storage";
import { UniversalMessageService } from "./universal-message.js";
import { MessageCreditService } from "./message-credits.js";
import { QuietHoursCompliance } from "./quiet-hours-compliance.js";
import {
  FairRateLimitedProcessor,
  type QueuedMessage,
} from "./fair-rate-limited-processor.js";
import { logError } from "../utils/logger.util";
import { logInfo } from "../utils/logger.util";

export interface CampaignExecutionResult {
  // Processing stats (immediate)
  sentCount: number; // Sent immediately
  queuedCount: number; // Queued for later
  failedCount: number; // Failed to process
  totalContacts: number; // Total attempted

  // Queue info (for UX)
  hasQueuedMessages: boolean;
  nextSendTime?: Date; // When queued messages will send

  // Traditional delivery stats (for compatibility)
  totalProcessed: number; // sentCount + queuedCount (successful processing)
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
    return {
      sentCount: 0,
      queuedCount: 0,
      failedCount: 0,
      totalContacts: 0,
      hasQueuedMessages: false,
      totalProcessed: 0,
    };
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
    // Prepare all messages for fair processing
    const campaignMessages: QueuedMessage[] = contacts.map((contact) => ({
      businessId: business.id,
      phoneNumber: contact.phoneNumber,
      messageContent: campaign.message,
      messageType: "campaign",
      contactId: contact.id,
      campaignId: campaign.id,
      from: defaultNumber,
      messagingServiceSid: messagingServiceSid ?? undefined,
      mediaUrl: campaign.mediaUrl || undefined,
      metadata: {
        campaignId: campaign.id,
        creditCost,
      },
    }));

    logInfo("Starting fair campaign processing", {
      campaignId,
      messageCount: campaignMessages.length,
      businessId: business.id,
    });

    // Process all messages through fair rate-limited processor
    const processingStats = await FairRateLimitedProcessor.addBusinessMessages(
      business.id,
      campaignMessages
    );

    const sentCount = processingStats.sentCount;
    const queuedCount = processingStats.queuedCount;
    const failedCount = processingStats.failedCount;

    // Credits are automatically deducted by FairRateLimitedProcessor for sent messages
    // Queued messages will have credits deducted when they are actually sent

    logInfo("Campaign execution completed via fair processor", {
      campaignId,
      sentCount,
      queuedCount,
      failedCount,
      totalContacts: contacts.length,
      processingTimeMs: processingStats.processingTimeMs,
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
      hasQueuedMessages: queuedCount > 0,
      nextSendTime:
        queuedCount > 0
          ? QuietHoursCompliance.getNextSendTime(business.timezone)
          : undefined,
      totalProcessed: sentCount + queuedCount,
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
