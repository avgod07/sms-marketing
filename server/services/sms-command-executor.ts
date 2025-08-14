import type { IStorage } from "../db/storage.js";
import type { Contact, SmsCommandPending } from "@shared/schema";
import { SMSCommandRateLimiter } from "./sms-command-rate-limiter.js";
import { SMSCommandResponses } from "./sms-command-responses.js";
import { SMSCommandPending } from "./sms-command-pending.js";
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

export interface SMSCommandPendingResult {
  success: boolean;
  isPending?: boolean;
  error?: string;
}

export class SMSCommandExecutor {
  /**
   * Validate phone configuration before processing SMS commands
   * Prevents credit deduction when responses can't be sent
   * UPDATED: Subaccount-only validation (no legacy fallbacks)
   */
  private static async validatePhoneConfiguration(
    bizStore: IStorage
  ): Promise<{ isValid: boolean; error?: string }> {
    try {
      const business = await bizStore.getBusiness();

      // Check if business has subaccount provisioning
      if (!business.subaccountProvisioned) {
        logError("SMS command blocked - no subaccount provisioning", {
          businessId: business.id,
          subaccountProvisioned: false,
        });

        return {
          isValid: false,
          error:
            "SMS commands require subaccount provisioning. Please complete your business setup to use SMS commands.",
        };
      }

      // Check if subaccount has phone number configured
      const subaccountCreds = await bizStore.getSubaccountCredentials();
      if (!subaccountCreds?.phoneNumber) {
        logError("SMS command blocked - no subaccount phone number", {
          businessId: business.id,
          subaccountProvisioned: true,
          hasSubaccountCreds: !!subaccountCreds,
          hasPhoneNumber: !!subaccountCreds?.phoneNumber,
        });

        return {
          isValid: false,
          error:
            "No phone number configured in subaccount. Please complete your phone setup before using SMS commands.",
        };
      }

      logInfo("SMS command phone validation passed", {
        businessId: business.id,
        phoneNumber: subaccountCreds.phoneNumber,
        subaccountSid: subaccountCreds.subaccountSid,
      });

      return { isValid: true };
    } catch (error) {
      logError("Error validating phone configuration for SMS command", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        isValid: false,
        error: "System error validating phone configuration",
      };
    }
  }

  /**
   * Create pending command with preview (NEW - replaces immediate execution)
   */
  static async createPendingCommand(
    businessId: number,
    bizStore: IStorage,
    senderPhone: string,
    message: string,
    contact: Contact
  ): Promise<SMSCommandPendingResult> {
    try {
      logInfo("Starting SMS command validation for pending creation", {
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
        };
      }

      // 2. Validate phone configuration FIRST (prevents credit loss)
      const phoneValidation = await this.validatePhoneConfiguration(bizStore);
      if (!phoneValidation.isValid) {
        logError("SMS command failed phone validation", {
          businessId,
          senderPhone,
          error: phoneValidation.error,
        });
        return {
          success: false,
          error: phoneValidation.error || "Phone configuration invalid",
        };
      }

      // 3. Get contacts and validate
      const contacts = (await bizStore.getContacts()).filter((c) => c.active);

      if (contacts.length === 0) {
        await SMSCommandResponses.sendNoContactsResponse(bizStore, senderPhone);
        return {
          success: false,
          error: "No active contacts found",
        };
      }

      // 4. Calculate credits needed (always 1 credit per contact for 160-char limit)
      const creditCost = 1; // Simple fixed cost for MVP
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
        };
      }

      // 4. Store as pending command (2-minute expiration)
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

      await SMSCommandPending.storePendingCommand(businessId, {
        senderPhone,
        messageContent: message,
        contactCount: contacts.length,
        creditCost: totalCreditsNeeded,
        expiresAt,
      });

      // 5. Send preview response
      await SMSCommandResponses.sendPreviewResponse(
        bizStore,
        senderPhone,
        message,
        contacts.length,
        totalCreditsNeeded
      );

      logInfo("SMS command pending creation successful", {
        businessId,
        contactCount: contacts.length,
        creditCost: totalCreditsNeeded,
        expiresAt: expiresAt.toISOString(),
      });

      return {
        success: true,
        isPending: true,
      };
    } catch (error) {
      logError("Error creating pending SMS command:", error);

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
   * Execute confirmed pending command
   */
  static async executePendingCommand(
    businessId: number,
    bizStore: IStorage,
    pendingCommand: SmsCommandPending
  ): Promise<SMSCommandExecutionResult> {
    try {
      logInfo("Starting execution of confirmed SMS command", {
        businessId,
        pendingId: pendingCommand.id,
        contactCount: pendingCommand.contactCount,
        creditCost: pendingCommand.creditCost,
      });

      // CHECK BUSINESS HOURS FIRST - SMS commands fail outside hours
      const business = await bizStore.getBusiness();
      const { QuietHoursCompliance } = await import(
        "./quiet-hours-compliance.js"
      );

      const canSendNow = QuietHoursCompliance.canSendImmediately(
        business.timezone,
        "campaign" // SMS commands create campaigns
      );

      if (!canSendNow) {
        // FAIL the command immediately with business hours error
        await SMSCommandResponses.sendBusinessHoursErrorResponse(
          bizStore,
          pendingCommand.senderPhone,
          business.timezone
        );

        logInfo("SMS command failed - outside business hours", {
          businessId,
          pendingId: pendingCommand.id,
          timezone: business.timezone,
          senderPhone: pendingCommand.senderPhone,
        });

        return {
          success: false,
          error: "Cannot send campaigns outside business hours (8 AM - 8 PM)",
        };
      }

      // Revalidate phone configuration (might have changed since pending created)
      const phoneValidation = await this.validatePhoneConfiguration(bizStore);
      if (!phoneValidation.isValid) {
        logError("Pending SMS command failed phone validation", {
          businessId,
          pendingId: pendingCommand.id,
          error: phoneValidation.error,
        });
        return {
          success: false,
          error: phoneValidation.error || "Phone configuration invalid",
        };
      }

      // Revalidate everything (contacts might have changed)
      const contacts = (await bizStore.getContacts()).filter((c) => c.active);

      if (contacts.length === 0) {
        await SMSCommandResponses.sendNoContactsResponse(
          bizStore,
          pendingCommand.senderPhone
        );
        return {
          success: false,
          error: "No active contacts found",
        };
      }

      // Check credits again (might have changed)
      const credits = await bizStore.getCredits();
      const balance = credits?.balance || 0;
      const creditCost = 1; // Fixed cost for MVP
      const totalCreditsNeeded = contacts.length * creditCost;

      if (balance < totalCreditsNeeded) {
        await SMSCommandResponses.sendInsufficientCreditsResponse(
          bizStore,
          pendingCommand.senderPhone,
          totalCreditsNeeded,
          balance
        );
        return {
          success: false,
          error: "Insufficient credits",
        };
      }

      // Create campaign record
      const campaign = await bizStore.createCampaign({
        name: `SMS Command - ${new Date().toLocaleString()}`,
        message: pendingCommand.messageContent,
        mediaUrl: null, // SMS commands don't support media
        campaignSource: "sms_command",
        commandSenderPhone: pendingCommand.senderPhone,
      });

      logInfo("Created SMS command campaign from pending", {
        businessId,
        campaignId: campaign.id,
        pendingId: pendingCommand.id,
        contactCount: contacts.length,
        totalCreditsNeeded,
      });

      // Execute campaign using existing infrastructure
      const results = await executeCampaign(bizStore, campaign.id);

      // Record rate limit for this business
      const nextAvailable = await SMSCommandRateLimiter.recordCommandSent(
        businessId
      );

      // Send confirmation response (enhanced with remaining balance and queue info)
      if (results.queuedCount > 0) {
        // Some messages were queued due to quiet hours
        await SMSCommandResponses.sendConfirmationWithQueueResponse(
          bizStore,
          pendingCommand.senderPhone,
          results.sentCount,
          results.queuedCount,
          totalCreditsNeeded,
          nextAvailable
        );
      } else {
        // All messages sent immediately
        await SMSCommandResponses.sendConfirmationResponse(
          bizStore,
          pendingCommand.senderPhone,
          results.sentCount,
          totalCreditsNeeded,
          nextAvailable
        );
      }

      logInfo("SMS command executed successfully from pending", {
        businessId,
        campaignId: campaign.id,
        pendingId: pendingCommand.id,
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
      logError("Error executing pending SMS command:", error);

      try {
        await SMSCommandResponses.sendSystemErrorResponse(
          bizStore,
          pendingCommand.senderPhone
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
   * Execute an SMS command end-to-end (LEGACY - kept for backward compatibility)
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

      // 2. Validate phone configuration FIRST (prevents credit loss)
      const phoneValidation = await this.validatePhoneConfiguration(bizStore);
      if (!phoneValidation.isValid) {
        logError("SMS command failed phone validation", {
          businessId,
          senderPhone,
          error: phoneValidation.error,
        });
        return {
          success: false,
          error: phoneValidation.error || "Phone configuration invalid",
        };
      }

      // 3. Get contacts and validate
      const contacts = (await bizStore.getContacts()).filter((c) => c.active);

      if (contacts.length === 0) {
        await SMSCommandResponses.sendNoContactsResponse(bizStore, senderPhone);
        return {
          success: false,
          error: "No active contacts found",
        };
      }

      // 4. Calculate credits needed
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

      // 7. Send success response (with queue info if applicable)
      if (results.queuedCount > 0) {
        // Some messages were queued due to quiet hours
        await SMSCommandResponses.sendSuccessWithQueueResponse(
          bizStore,
          senderPhone,
          results.sentCount,
          results.queuedCount,
          totalCreditsNeeded,
          nextAvailable
        );
      } else {
        // All messages sent immediately
        await SMSCommandResponses.sendSuccessResponse(
          bizStore,
          senderPhone,
          results.sentCount,
          totalCreditsNeeded,
          nextAvailable
        );
      }

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

      // Check if business has subaccount setup with phone numbers
      if (!business.subaccountProvisioned) {
        errors.push("Business requires subaccount provisioning");
      } else {
        const subaccountCreds = await bizStore.getSubaccountCredentials();
        if (!subaccountCreds?.phoneNumber) {
          errors.push("No phone number configured in subaccount");
        }
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
