import moment from "moment-timezone";
import { IStorage } from "../db/storage.js";
import { QuietHoursCompliance } from "./quiet-hours-compliance.js";
import { MessageCreditService } from "./message-credits.js";
import { logInfo, logError } from "../utils/logger.util.js";
import type {
  CampaignScheduleRequest,
  CampaignScheduleResponse,
  ScheduledCampaignListItem,
  SchedulingValidationResult,
} from "@shared/api-types";

export interface SchedulingOptions {
  scheduledSendTime: Date;
  scheduledBy?: string;
  scheduleNotes?: string;
  forceSchedule?: boolean; // Skip some validations (admin override)
}

export interface CampaignData {
  name: string;
  message: string;
  mediaUrl?: string;
}

export interface SchedulingResult {
  success: boolean;
  campaign?: any;
  scheduledFor?: Date;
  errors?: string[];
  warnings?: string[];
}

/**
 * CampaignSchedulingService
 * Handles user-scheduled campaigns (distinct from quiet hours queuing)
 */
export class CampaignSchedulingService {
  /**
   * Create a new campaign and schedule it for future delivery (without executing immediately)
   */
  static async createScheduledCampaign(
    bizStorage: IStorage,
    campaignData: CampaignData,
    options: SchedulingOptions
  ): Promise<SchedulingResult> {
    try {
      // Get business info for timezone validation
      const business = await bizStorage.getBusiness();

      // Validate scheduling time
      const validation = this.validateScheduleTime(
        options.scheduledSendTime,
        business.timezone,
        options.forceSchedule
      );

      if (!validation.isValid && !options.forceSchedule) {
        return {
          success: false,
          errors: validation.errors,
          warnings: validation.warnings,
        };
      }

      // Validate credits availability
      const contacts = (await bizStorage.getContacts()).filter((c) => c.active);
      if (contacts.length === 0) {
        return {
          success: false,
          errors: ["No active contacts found for this campaign"],
        };
      }

      const creditCost = MessageCreditService.calculateCreditCost(
        campaignData.message,
        !!campaignData.mediaUrl
      );
      const totalCreditsNeeded = contacts.length * creditCost;

      const credits = await bizStorage.getCredits();
      const balance = credits?.balance || 0;

      if (balance < totalCreditsNeeded) {
        return {
          success: false,
          errors: [
            `Insufficient credits. Need ${totalCreditsNeeded}, have ${balance}`,
          ],
        };
      }

      // Create campaign with scheduled status (do NOT execute)
      const campaign = await bizStorage.createCampaign({
        name: campaignData.name,
        message: campaignData.message,
        mediaUrl: campaignData.mediaUrl,
        // Set scheduling fields on creation
        status: "scheduled",
        scheduledSendTime: options.scheduledSendTime,
        schedulingType: "scheduled",
        scheduledBy: options.scheduledBy,
        scheduleNotes: options.scheduleNotes,
      });

      logInfo("Scheduled campaign created successfully", {
        campaignId: campaign.id,
        scheduledFor: options.scheduledSendTime.toISOString(),
        businessId: business.id,
        contactCount: contacts.length,
        creditsRequired: totalCreditsNeeded,
      });

      return {
        success: true,
        campaign,
        scheduledFor: options.scheduledSendTime,
        warnings: validation.warnings,
      };
    } catch (error) {
      logError("Failed to create scheduled campaign", {
        error,
        campaignData,
        options,
      });
      return {
        success: false,
        errors: ["Failed to create scheduled campaign. Please try again."],
      };
    }
  }

  /**
   * Schedule a campaign for future delivery
   */
  static async scheduleCampaign(
    bizStorage: IStorage,
    campaignId: number,
    options: SchedulingOptions
  ): Promise<SchedulingResult> {
    try {
      const campaign = await bizStorage.getCampaign(campaignId);
      if (!campaign) {
        return {
          success: false,
          errors: ["Campaign not found"],
        };
      }

      // Validate campaign can be scheduled
      if (campaign.status === "completed") {
        return {
          success: false,
          errors: ["Completed campaigns cannot be scheduled"],
        };
      }

      if (campaign.status === "scheduled") {
        return {
          success: false,
          errors: [
            "Campaign is already scheduled. Use reschedule to change the time.",
          ],
        };
      }

      // Get business info for timezone validation
      const business = await bizStorage.getBusiness();

      // Validate scheduling time
      const validation = this.validateScheduleTime(
        options.scheduledSendTime,
        business.timezone,
        options.forceSchedule
      );

      if (!validation.isValid && !options.forceSchedule) {
        return {
          success: false,
          errors: validation.errors,
          warnings: validation.warnings,
        };
      }

      // Validate credits availability
      const contacts = (await bizStorage.getContacts()).filter((c) => c.active);
      if (contacts.length === 0) {
        return {
          success: false,
          errors: ["No active contacts found for this campaign"],
        };
      }

      const creditCost = MessageCreditService.calculateCreditCost(
        campaign.message,
        !!campaign.mediaUrl
      );
      const totalCreditsNeeded = contacts.length * creditCost;

      const credits = await bizStorage.getCredits();
      const balance = credits?.balance || 0;

      if (balance < totalCreditsNeeded) {
        return {
          success: false,
          errors: [
            `Insufficient credits. Need ${totalCreditsNeeded}, have ${balance}`,
          ],
        };
      }

      // Update campaign with scheduling information
      const updatedCampaign = await bizStorage.updateCampaign(campaignId, {
        status: "scheduled",
        scheduledSendTime: options.scheduledSendTime,
        schedulingType: "scheduled",
        scheduledBy: options.scheduledBy,
        scheduleNotes: options.scheduleNotes,
      });

      logInfo("Campaign scheduled successfully", {
        campaignId,
        scheduledFor: options.scheduledSendTime.toISOString(),
        businessId: business.id,
        contactCount: contacts.length,
        creditsRequired: totalCreditsNeeded,
      });

      return {
        success: true,
        campaign: updatedCampaign,
        scheduledFor: options.scheduledSendTime,
        warnings: validation.warnings,
      };
    } catch (error) {
      logError("Failed to schedule campaign", { error, campaignId, options });
      return {
        success: false,
        errors: ["Failed to schedule campaign. Please try again."],
      };
    }
  }

  /**
   * Reschedule an existing scheduled campaign
   */
  static async rescheduleCampaign(
    bizStorage: IStorage,
    campaignId: number,
    newScheduleTime: Date,
    scheduledBy?: string,
    scheduleNotes?: string
  ): Promise<SchedulingResult> {
    try {
      const campaign = await bizStorage.getCampaign(campaignId);
      if (!campaign) {
        return {
          success: false,
          errors: ["Campaign not found"],
        };
      }

      if (campaign.status !== "scheduled") {
        return {
          success: false,
          errors: ["Only scheduled campaigns can be rescheduled"],
        };
      }

      const business = await bizStorage.getBusiness();
      const validation = this.validateScheduleTime(
        newScheduleTime,
        business.timezone
      );

      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
          warnings: validation.warnings,
        };
      }

      const updatedCampaign = await bizStorage.updateCampaign(campaignId, {
        scheduledSendTime: newScheduleTime,
        scheduledBy,
        scheduleNotes,
        updatedAt: new Date(),
      });

      logInfo("Campaign rescheduled successfully", {
        campaignId,
        oldScheduleTime: campaign.scheduledSendTime,
        newScheduleTime: newScheduleTime.toISOString(),
        businessId: business.id,
      });

      return {
        success: true,
        campaign: updatedCampaign,
        scheduledFor: newScheduleTime,
        warnings: validation.warnings,
      };
    } catch (error) {
      logError("Failed to reschedule campaign", {
        error,
        campaignId,
        newScheduleTime,
      });
      return {
        success: false,
        errors: ["Failed to reschedule campaign. Please try again."],
      };
    }
  }

  /**
   * Cancel a scheduled campaign
   */
  static async cancelScheduledCampaign(
    bizStorage: IStorage,
    campaignId: number
  ): Promise<SchedulingResult> {
    try {
      const campaign = await bizStorage.getCampaign(campaignId);
      if (!campaign) {
        return {
          success: false,
          errors: ["Campaign not found"],
        };
      }

      if (campaign.status !== "scheduled") {
        return {
          success: false,
          errors: ["Only scheduled campaigns can be cancelled"],
        };
      }

      const updatedCampaign = await bizStorage.updateCampaign(campaignId, {
        status: "cancelled",
        schedulingType: "cancelled",
        updatedAt: new Date(),
      });

      logInfo("Scheduled campaign cancelled", {
        campaignId,
        originalScheduleTime: campaign.scheduledSendTime,
        businessId: campaign.businessId,
      });

      return {
        success: true,
        campaign: updatedCampaign,
      };
    } catch (error) {
      logError("Failed to cancel scheduled campaign", { error, campaignId });
      return {
        success: false,
        errors: ["Failed to cancel campaign. Please try again."],
      };
    }
  }

  /**
   * Get list of scheduled campaigns for a business
   */
  static async getScheduledCampaigns(
    bizStorage: IStorage
  ): Promise<ScheduledCampaignListItem[]> {
    try {
      const campaigns = await bizStorage.getCampaigns();
      const business = await bizStorage.getBusiness();
      const contacts = (await bizStorage.getContacts()).filter((c) => c.active);

      const scheduledCampaigns = campaigns
        .filter(
          (c) => c.status === "scheduled" && c.schedulingType === "scheduled"
        )
        .map((campaign) => {
          const creditCost = MessageCreditService.calculateCreditCost(
            campaign.message,
            !!campaign.mediaUrl
          );
          const estimatedCredits = contacts.length * creditCost;

          const countdown = campaign.scheduledSendTime
            ? this.calculateCountdown(
                campaign.scheduledSendTime,
                business.timezone
              )
            : undefined;

          return {
            id: campaign.id,
            name: campaign.name,
            message: campaign.message,
            scheduledSendTime: campaign.scheduledSendTime?.toISOString() || "",
            schedulingType: campaign.schedulingType as "scheduled",
            scheduledBy: campaign.scheduledBy,
            scheduleNotes: campaign.scheduleNotes,
            totalContacts: contacts.length,
            estimatedCredits,
            businessTimezone: business.timezone,
            createdAt: campaign.createdAt.toISOString(),
            countdown,
          } as ScheduledCampaignListItem;
        })
        .sort(
          (a, b) =>
            new Date(a.scheduledSendTime).getTime() -
            new Date(b.scheduledSendTime).getTime()
        );

      return scheduledCampaigns;
    } catch (error) {
      logError("Failed to get scheduled campaigns", { error });
      return [];
    }
  }

  /**
   * Get campaigns ready to be sent (scheduled time has passed)
   */
  static async getCampaignsReadyToSend(): Promise<any[]> {
    try {
      // This would be called by a background job
      // For now, return empty array - we'll implement the background processor later
      return [];
    } catch (error) {
      logError("Failed to get campaigns ready to send", { error });
      return [];
    }
  }

  /**
   * Validate if a campaign can be scheduled for the given time
   */
  static validateScheduleTime(
    scheduledTime: Date,
    businessTimezone: string,
    forceSchedule = false
  ): SchedulingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if time is in the future
    const now = new Date();
    if (scheduledTime <= now) {
      errors.push("Scheduled time must be in the future");
    }

    // Check if too far in the future (optional limit - 1 year)
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    if (scheduledTime > oneYearFromNow) {
      warnings.push("Scheduling more than 1 year in advance");
    }

    // Check business hours in target timezone
    const businessTime = moment(scheduledTime).tz(businessTimezone);
    const hour = businessTime.hour();
    const isBusinessHours = hour >= 8 && hour < 20;

    if (!isBusinessHours && !forceSchedule) {
      warnings.push(
        `Scheduled time (${businessTime.format(
          "h:mm A"
        )}) is outside business hours (8 AM - 8 PM). ` +
          "Messages will still be sent at the scheduled time."
      );
    }

    // Check if it's a weekend
    const dayOfWeek = businessTime.day(); // 0 = Sunday, 6 = Saturday
    if ((dayOfWeek === 0 || dayOfWeek === 6) && !forceSchedule) {
      warnings.push(
        "Scheduled for weekend. Consider scheduling for a weekday for better engagement."
      );
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      businessHoursImpact: {
        isOutsideBusinessHours: !isBusinessHours,
        nextBusinessHour: !isBusinessHours
          ? QuietHoursCompliance.getNextSendTime(businessTimezone).toISOString()
          : undefined,
      },
    };
  }

  /**
   * Calculate countdown display for scheduled campaign
   */
  static calculateCountdown(
    scheduledTime: Date | string,
    timezone: string
  ): { timeUntilSend: string; exactTime: string } {
    const scheduleDate = new Date(scheduledTime);
    const now = new Date();
    const diffMs = scheduleDate.getTime() - now.getTime();

    let timeUntilSend: string;

    if (diffMs <= 0) {
      timeUntilSend = "Ready to send";
    } else if (diffMs < 60 * 1000) {
      timeUntilSend = "Less than 1 minute";
    } else if (diffMs < 60 * 60 * 1000) {
      const minutes = Math.floor(diffMs / (60 * 1000));
      timeUntilSend = `in ${minutes} minute${minutes !== 1 ? "s" : ""}`;
    } else if (diffMs < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diffMs / (60 * 60 * 1000));
      timeUntilSend = `in ${hours} hour${hours !== 1 ? "s" : ""}`;
    } else {
      const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      timeUntilSend = `in ${days} day${days !== 1 ? "s" : ""}`;
    }

    return {
      timeUntilSend,
      exactTime: scheduleDate.toISOString(),
    };
  }
}
