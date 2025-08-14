import type { IStorage } from "../db/storage";
import { MessageCreditService } from "./message-credits.js";
import { FairRateLimitedProcessorV2 } from "./fair-rate-limited-processor-v2.js";
import { QuietHoursCompliance } from "./quiet-hours-compliance.js";
import { logError, logInfo } from "../utils/logger.util";
import type { CommitMessageParams } from "./message-commitment.js";

export interface CampaignExecutionResult {
  sentCount: number;
  queuedCount: number;
  failedCount: number;
  totalContacts: number;
  hasQueuedMessages: boolean;
  nextSendTime?: Date;
  totalProcessed: number;
  creditsDeducted: number;
  remainingCredits: number;
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
  try {
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
        creditsDeducted: 0,
        remainingCredits: (await bizStorage.getCredits())?.balance || 0,
      };
    }

    const business = await bizStorage.getBusiness();

    // Try to get subaccount credentials first
    const subaccountCreds = await bizStorage.getSubaccountCredentials();
    let messagingServiceSid: string | undefined;
    let defaultNumber: string | undefined;

    if (subaccountCreds && business.subaccountProvisioned) {
      // Use subaccount credentials - no messaging service needed for direct phone number routing
      messagingServiceSid = undefined;
      defaultNumber = subaccountCreds.phoneNumber;
      logInfo("Using subaccount credentials for campaign", {
        campaignId,
        businessId: business.id,
        subaccountSid: subaccountCreds.subaccountSid,
      });
    } else {
      // Fallback to legacy credentials
      messagingServiceSid = await bizStorage.getMessagingServiceSid();
      const numbers = await bizStorage.getPhoneNumbers();
      defaultNumber = numbers.find((n) => n.isDefault)?.phoneNumber;
      logInfo("Using legacy credentials for campaign", {
        campaignId,
        businessId: business.id,
      });
    }

    logInfo("Starting campaign execution with new system", {
      campaignId,
      businessId: business.id,
      contactCount: contacts.length,
      messageLength: campaign.message.length,
      hasMedia: !!campaign.mediaUrl,
    });

    // Handle coupon recipients (existing logic)
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

    // Update campaign status to processing
    await bizStorage.updateCampaign(campaignId, {
      status: "processing",
      processingStatus: "processing",
    });

    // Calculate total credit cost for validation
    const creditCostPerMessage = MessageCreditService.calculateCreditCost(
      campaign.message,
      !!campaign.mediaUrl
    );
    const totalCreditCost = contacts.length * creditCostPerMessage;

    logInfo("Campaign credit calculation", {
      campaignId,
      contactCount: contacts.length,
      creditCostPerMessage,
      totalCreditCost,
    });

    // Prepare messages for commitment (credits will be deducted immediately)
    const campaignMessages: CommitMessageParams[] = contacts.map((contact) => ({
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
        campaignName: campaign.name,
        campaignSource: campaign.campaignSource,
      },
    }));

    logInfo("Prepared campaign messages for commitment", {
      campaignId,
      messageCount: campaignMessages.length,
      businessId: business.id,
    });

    // Execute through fair processor with immediate credit deduction
    const processingStats =
      await FairRateLimitedProcessorV2.addBusinessMessages(
        business.id,
        campaignMessages
      );

    logInfo("Campaign committed for processing", {
      campaignId,
      businessId: business.id,
      totalCommitted: processingStats.queuedCount,
      processingTimeMs: processingStats.processingTimeMs,
    });

    // Update campaign with processing results
    await bizStorage.updateCampaign(campaignId, {
      status: "processing",
      processingStatus: "committed",
      sentCount: 0, // Will be updated as messages are actually sent
      deliveredCount: 0, // Will be updated based on Twilio webhooks
    });

    // Get current credits to show remaining balance
    const currentCredits = await bizStorage.getCredits();
    const remainingCredits = currentCredits?.balance || 0;

    logInfo("Campaign execution completed", {
      campaignId,
      businessId: business.id,
      totalContacts: contacts.length,
      queuedCount: processingStats.queuedCount,
      creditsDeducted: totalCreditCost,
      remainingCredits,
    });

    return {
      sentCount: 0, // Messages are committed, not yet sent
      queuedCount: processingStats.queuedCount,
      failedCount: processingStats.failedCount,
      totalContacts: contacts.length,
      hasQueuedMessages: processingStats.queuedCount > 0,
      nextSendTime:
        processingStats.queuedCount > 0
          ? new Date(Date.now() + 30000) // Processing will start within 30 seconds
          : undefined,
      totalProcessed: processingStats.queuedCount,
      creditsDeducted: totalCreditCost,
      remainingCredits,
    };
  } catch (error) {
    logError("Campaign execution failed", {
      campaignId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Update campaign status to failed
    try {
      await bizStorage.updateCampaign(campaignId, {
        status: "failed",
        processingStatus: "failed",
      });
    } catch (updateError) {
      logError("Failed to update campaign status to failed", {
        campaignId,
        updateError,
      });
    }

    throw error;
  }
}
