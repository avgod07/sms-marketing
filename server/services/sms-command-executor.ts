import type { IStorage } from "../db/storage.js";
import type { Contact } from "@shared/schema";
import { SMSCommandRateLimiter } from "./sms-command-rate-limiter.js";
import { SMSCommandResponses } from "./sms-command-responses.js";
import { MessageCreditService } from "./message-credits.js";
import { executeCampaign } from "./campaign.js";
import { logInfo, logError } from "../utils/logger.util.js";

export interface SMSCommandExecutionResult {
  success: boolean;
  sentCount?: number;
  creditsUsed?: number;
  nextAvailableTime?: Date;
  error?: string;
  campaignId?: number;
}

export class SMSCommandExecutor {
  /**
   * Execute an SMS command end-to-end
   */
  static async executeCommand(
    businessId: number,
    bizStore: IStorage,
    senderPhone: string,
    message: string,
    contact: Contact
  ): Promise<SMSCommandExecutionResult> {
    try {
      logInfo("Starting SMS command execution", {
        businessId,
        senderPhone,
        messageLength: message.length,
      });

      // 1. Check rate limit
      const rateLimitResult = await SMSCommandRateLimiter.checkRateLimit(
        businessId
      );

      if (!rateLimitResult.allowed) {
        await SMSCommandResponses.sendRateLimitResponse(
          bizStore,
          senderPhone,
          rateLimitResult.nextAvailableAt!
        );
        return {
          success: false,
          error: "Rate limited",
          nextAvailableTime: rateLimitResult.nextAvailableAt,
        };
      }

      // 2. Get contacts and validate
      const contacts = (await bizStore.getContacts()).filter((c) => c.active);

      if (contacts.length === 0) {
        await SMSCommandResponses.sendNoContactsResponse(bizStore, senderPhone);
        return {
          success: false,
          error: "No active contacts found",
        };
      }

      // 3. Calculate credits needed
      const creditCost = MessageCreditService.calculateCreditCost(
        message,
        false
      ); // SMS only for commands
      const totalCreditsNeeded = contacts.length * creditCost;

      const credits = await bizStore.getCredits();
      const balance = credits?.balance || 0;

      if (balance < totalCreditsNeeded) {
        await SMSCommandResponses.sendInsufficientCreditsResponse(
          bizStore,
          senderPhone,
          totalCreditsNeeded,
          balance
        );
        return {
          success: false,
          error: "Insufficient credits",
          creditsUsed: totalCreditsNeeded,
        };
      }

      // 4. Create campaign record (integrates with existing campaigns)
      const campaign = await bizStore.createCampaign({
        name: `SMS Command - ${new Date().toLocaleString()}`,
        message: message,
        mediaUrl: null, // SMS commands don't support media
        campaignSource: "sms_command",
        commandSenderPhone: senderPhone,
      });

      logInfo("Created SMS command campaign", {
        businessId,
        campaignId: campaign.id,
        contactCount: contacts.length,
        creditCost,
        totalCreditsNeeded,
      });

      // 5. Execute campaign using existing infrastructure
      const results = await executeCampaign(bizStore, campaign.id);

      // 6. Record rate limit for this business
      const nextAvailable = await SMSCommandRateLimiter.recordCommandSent(
        businessId
      );

      // 7. Send success response
      await SMSCommandResponses.sendSuccessResponse(
        bizStore,
        senderPhone,
        results.sentCount,
        totalCreditsNeeded,
        nextAvailable
      );

      logInfo("SMS command executed successfully", {
        businessId,
        campaignId: campaign.id,
        sentCount: results.sentCount,
        failedCount: results.failedCount,
        creditsUsed: totalCreditsNeeded,
        nextAvailable: nextAvailable.toISOString(),
      });

      return {
        success: true,
        sentCount: results.sentCount,
        creditsUsed: totalCreditsNeeded,
        nextAvailableTime: nextAvailable,
        campaignId: campaign.id,
      };
    } catch (error) {
      logError("Error executing SMS command:", error);

      try {
        await SMSCommandResponses.sendSystemErrorResponse(
          bizStore,
          senderPhone
        );
      } catch (responseError) {
        logError("Failed to send error response:", responseError);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "System error",
      };
    }
  }

  /**
   * Validate command execution prerequisites
   */
  static async validateCommandExecution(
    businessId: number,
    bizStore: IStorage
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if business exists and is properly configured
      const business = await bizStore.getBusiness();
      if (!business) {
        errors.push("Business not found");
        return { isValid: false, errors, warnings };
      }

      // Check if business has phone numbers configured
      const phoneNumbers = await bizStore.getPhoneNumbers();
      if (phoneNumbers.length === 0) {
        errors.push("No phone numbers configured");
      }

      // Check if business has active contacts
      const contacts = (await bizStore.getContacts()).filter((c) => c.active);
      if (contacts.length === 0) {
        warnings.push("No active contacts found");
      }

      // Check credit balance
      const credits = await bizStore.getCredits();
      const balance = credits?.balance || 0;
      if (balance < 10) {
        // Warn if less than 10 credits
        warnings.push(`Low credit balance: ${balance} credits remaining`);
      }

      // Check rate limit status
      const rateLimitStatus = await SMSCommandRateLimiter.getRateLimitStatus(
        businessId
      );
      if (!rateLimitStatus.canSendNow) {
        errors.push(
          `Rate limited until ${rateLimitStatus.nextAvailableAt?.toLocaleTimeString()}`
        );
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      logError("Error validating command execution:", error);
      return {
        isValid: false,
        errors: ["System error during validation"],
        warnings,
      };
    }
  }
}
