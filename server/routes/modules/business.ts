import type { Express } from "express";
import { requireAuth } from "@clerk/express";
import { createClerkClient } from "@clerk/backend";
import { z } from "zod";
import { InsertBusinessProfile } from "@shared/schema";
import { logError } from "../../utils/logger.util";
import {
  businessProfileSchema,
  getBizForRequest,
  logDetailedError,
} from "./utils";
import { logInfo } from "../../utils/logger.util";

export function registerBusinessRoutes(app: Express) {
  // Initialize Clerk client
  const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
  });

  app.get("/api/dashboard/stats", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const stats = await biz.getDashboardStats();
      const defaults = {
        totalContacts: 0,
        messagesSent: 0,
        activeCampaigns: 0,
        deliveryRate: 0,
        contactsChange: null as number | null,
        messagesChange: null as number | null,
        campaignsChange: null as number | null,
        deliveryRateChange: null as number | null,
      };
      res.json({ ...defaults, ...(stats || {}) });
    } catch (error) {
      logDetailedError("Error fetching dashboard stats", error);
      const defaults = {
        totalContacts: 0,
        messagesSent: 0,
        activeCampaigns: 0,
        deliveryRate: 0,
        contactsChange: null as number | null,
        messagesChange: null as number | null,
        campaignsChange: null as number | null,
        deliveryRateChange: null as number | null,
      };
      res
        .status(500)
        .json({ message: "Failed to fetch dashboard stats", stats: defaults });
    }
  });

  app.get("/api/setup/status", requireAuth(), async (req, res) => {
    try {
      const { biz, user } = await getBizForRequest(req);
      const contactStats = await biz.getContactStats();
      const couponStats = await biz.getCouponStats();
      const messagingServiceSid = await biz.getMessagingServiceSid();
      const phoneNumbers = await biz.getPhoneNumbers();
      const business = await biz.getBusiness();

      // Consider phone configured if we have messaging service OR phone numbers
      const phoneConfigured = !!messagingServiceSid || phoneNumbers.length > 0;

      res.json({
        phoneConfigured,
        hasContacts: contactStats.allContacts > 0,
        hasCoupons: couponStats.allCoupons > 0,
        onboardingComplete: !!business.onboardingComplete,
      });
    } catch (error) {
      logDetailedError("Error fetching setup status", error);
      res.status(500).json({ message: "Failed to fetch setup status" });
    }
  });

  // New endpoint: Get account info (company name and email)
  app.get("/api/business/account-info", requireAuth(), async (req, res) => {
    try {
      const { biz, user } = await getBizForRequest(req);
      const business = await biz.getBusiness();
      const progress = await biz.getOnboardingProgress();
      const phoneNumbers = await biz.getPhoneNumbers();

      // Get the default phone number
      const defaultPhone = phoneNumbers.find((n) => n.isDefault);

      // Get Clerk user email
      let clerkEmail = "";
      if (user.clerkId) {
        try {
          const clerkUser = await clerkClient.users.getUser(user.clerkId);
          clerkEmail = clerkUser.emailAddresses[0]?.emailAddress || "";
        } catch (clerkError) {
          logError("Error fetching Clerk user email:", clerkError);
          // Fallback to onboarding email if Clerk fails
          clerkEmail = progress?.email || "";
        }
      } else {
        // No Clerk ID, use onboarding email
        clerkEmail = progress?.email || "";
      }

      res.json({
        companyName: business.name || progress?.businessName || "",
        contactEmail: clerkEmail || progress?.email || "",
        phoneNumber: defaultPhone?.phoneNumber || null,
      });
    } catch (error) {
      logError("Error fetching account info:", error);
      res.status(500).json({ message: "Failed to fetch account info" });
    }
  });

  // New endpoint: Update account info (company name only)
  const accountInfoSchema = z.object({
    companyName: z
      .string()
      .min(1, "Company name is required")
      .max(100, "Company name too long"),
  });

  app.post("/api/business/account-info", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const { companyName } = accountInfoSchema.parse(req.body);

      await biz.updateBusiness({ name: companyName.trim() });

      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Validation error", errors: error.errors });
      }
      logError("Error updating account info:", error);
      res.status(500).json({ message: "Failed to update account info" });
    }
  });

  // New endpoint: Get initial message
  app.get("/api/business/initial-message", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const business = await biz.getBusiness();

      res.json({
        initialMessage: business.initialMessage || "",
        onboardingComplete: !!business.onboardingComplete,
      });
    } catch (error) {
      logError("Error fetching initial message:", error);
      res.status(500).json({ message: "Failed to fetch initial message" });
    }
  });

  // New endpoint: Update initial message
  const initialMessageSchema = z.object({
    initialMessage: z
      .string()
      .min(1, "Initial message is required")
      .max(160, "Initial message must be 160 characters or less"),
  });

  app.post("/api/business/initial-message", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const { initialMessage } = initialMessageSchema.parse(req.body);

      // Ensure initial message includes compliance text
      const complianceText =
        "Reply STOP to opt out, HELP for help. Msg & data rates may apply. Msg frequency varies.";
      const finalMessage = initialMessage.includes(complianceText)
        ? initialMessage
        : `${initialMessage} ${complianceText}`;

      // Check if final message exceeds 160 characters
      if (finalMessage.length > 160) {
        return res.status(400).json({
          message:
            "Initial message with compliance text exceeds 160 characters. Please shorten your message.",
        });
      }

      await biz.updateBusiness({ initialMessage: finalMessage });

      res.json({
        success: true,
        initialMessage: finalMessage,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Validation error", errors: error.errors });
      }
      logError("Error updating initial message:", error);
      res.status(500).json({ message: "Failed to update initial message" });
    }
  });

  app.get("/api/business-profile", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const profile = await biz.getBusinessProfile();
      res.json(profile || null);
    } catch (error) {
      logError("Error fetching business profile:", error);
      res.status(500).json({ message: "Failed to fetch business profile" });
    }
  });

  app.post("/api/business-profile", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const data = businessProfileSchema.parse(req.body) as {
        name?: string;
      } & InsertBusinessProfile;
      const { name, ...profile } = data;
      if (name) {
        await biz.updateBusiness({ name });
      }
      const saved = await biz.upsertBusinessProfile(profile);
      res.json(saved);
    } catch (error) {
      if (error instanceof Error && "errors" in error) {
        // zod error
        return res
          .status(400)
          .json({ message: "Validation error", errors: (error as any).errors });
      }
      logError("Error saving business profile:", error);
      res.status(500).json({ message: "Failed to save business profile" });
    }
  });

  // Timezone management endpoints for TCPA compliance

  /**
   * Get current business timezone with comprehensive info
   */
  app.get("/api/business/timezone", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const business = await biz.getBusiness();

      const { QuietHoursCompliance } = await import(
        "../../services/quiet-hours-compliance.js"
      );
      const { MessageQueueService } = await import(
        "../../services/message-queue.js"
      );

      // Get current time in business timezone
      const currentTime = new Date();
      const businessTime = currentTime.toLocaleString("en-US", {
        timeZone: business.timezone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZoneName: "short",
      });

      // Get timezone display name
      const timezoneName =
        new Intl.DateTimeFormat("en-US", {
          timeZone: business.timezone,
          timeZoneName: "long",
        })
          .formatToParts(currentTime)
          .find((part) => part.type === "timeZoneName")?.value ||
        business.timezone;

      // Check if current time is business hours
      const isBusinessHours = QuietHoursCompliance.canSendImmediately(
        business.timezone,
        "campaign"
      );

      // Get queue information
      const queueStats = await MessageQueueService.getBusinessQueueStats(
        business.id
      );
      const pendingMessages = queueStats.pending || 0;

      // Get next send time if outside business hours
      const nextSendTime = !isBusinessHours
        ? QuietHoursCompliance.getNextSendTime(business.timezone)
        : null;

      // Format business hours
      const businessHours = "8:00 AM - 8:00 PM";
      const businessHoursWithTz = `${businessHours} ${businessTime
        .split(" ")
        .pop()}`;

      // Determine detection method (for now, assume auto unless manually changed)
      const detectionMethod = business.timezoneUpdatedAt ? "manual" : "auto";

      // Check if timezone matches business address (simple state-based check)
      const { TimezoneService } = await import(
        "../../services/timezone-lookup.js"
      );
      let addressMatch = true;
      let suggestedTimezone = business.timezone;

      // Get business profile for address information
      try {
        const businessProfile = await biz.getBusinessProfile();
        if (
          businessProfile?.addressState &&
          businessProfile?.addressPostalCode
        ) {
          suggestedTimezone = TimezoneService.getTimezoneFromAddress({
            state: businessProfile.addressState,
            postalCode: businessProfile.addressPostalCode,
            country: businessProfile.addressCountry || "United States",
          });
          addressMatch = suggestedTimezone === business.timezone;
        }
      } catch (profileError) {
        // If we can't get business profile, assume current timezone is correct
        logError("Could not fetch business profile for timezone validation", {
          error: profileError,
        });
        addressMatch = true;
      }

      res.json({
        current: {
          timezone: business.timezone,
          displayName: timezoneName,
          currentTime: businessTime,
          businessHours: businessHoursWithTz,
          isBusinessHours: isBusinessHours,
        },
        detection: {
          method: detectionMethod,
          lastUpdated: business.timezoneUpdatedAt || business.createdAt,
          suggestedTimezone: addressMatch ? undefined : suggestedTimezone,
          addressMatch: addressMatch,
        },
        queueInfo:
          pendingMessages > 0
            ? {
                pendingMessages: pendingMessages,
                nextSendTime: nextSendTime?.toISOString(),
              }
            : undefined,
      });
    } catch (error) {
      logError("Error fetching business timezone:", error);
      res.status(500).json({ message: "Failed to fetch business timezone" });
    }
  });

  /**
   * Update business timezone with confirmation tracking
   */
  app.put("/api/business/timezone", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const timezoneSchema = z.object({
        timezone: z.string().min(1, "Timezone is required"),
        confirmed: z.boolean().default(false),
        reason: z
          .enum(["business_moved", "incorrect_detection", "other"])
          .optional(),
      });

      const { timezone, confirmed, reason } = timezoneSchema.parse(req.body);

      // Validate timezone by checking if it's a valid timezone
      try {
        new Date().toLocaleString("en-US", { timeZone: timezone });
      } catch (timezoneError) {
        return res.status(400).json({
          message: "Invalid timezone format",
          timezone: timezone,
        });
      }

      // For safety, require confirmation for timezone changes
      if (!confirmed) {
        return res.status(400).json({
          message: "Timezone change must be confirmed",
          requiresConfirmation: true,
        });
      }

      // Update business timezone and track the manual change
      await biz.updateBusiness({
        timezone,
        timezoneUpdatedAt: new Date(),
      });

      const business = await biz.getBusiness();

      // Log the timezone change for audit purposes
      logInfo("Business timezone manually updated", {
        businessId: business.id,
        oldTimezone: business.timezone,
        newTimezone: timezone,
        reason: reason || "not_specified",
        timestamp: new Date().toISOString(),
      });

      // Get comprehensive timezone info for response
      const businessTime = new Date().toLocaleString("en-US", {
        timeZone: business.timezone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZoneName: "short",
      });

      const timezoneName =
        new Intl.DateTimeFormat("en-US", {
          timeZone: business.timezone,
          timeZoneName: "long",
        })
          .formatToParts(new Date())
          .find((part) => part.type === "timeZoneName")?.value ||
        business.timezone;

      res.json({
        success: true,
        current: {
          timezone: business.timezone,
          displayName: timezoneName,
          currentTime: businessTime,
          businessHours: `8:00 AM - 8:00 PM ${businessTime.split(" ").pop()}`,
        },
        detection: {
          method: "manual",
          lastUpdated: business.timezoneUpdatedAt || business.createdAt,
          reason: reason,
        },
        message: "Business timezone updated successfully",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      logError("Error updating business timezone", { error });
      res.status(500).json({ message: "Failed to update business timezone" });
    }
  });

  /**
   * Get timezone suggestions based on address
   */
  app.post(
    "/api/business/timezone/suggest",
    requireAuth(),
    async (req, res) => {
      try {
        const addressSchema = z.object({
          state: z.string().min(1, "State is required"),
          postalCode: z.string().min(1, "Postal code is required"),
          country: z.string().optional().default("United States"),
        });

        const address = addressSchema.parse(req.body);

        const { TimezoneService } = await import(
          "../../services/timezone-lookup.js"
        );
        const suggestedTimezone =
          TimezoneService.getTimezoneFromAddress(address);

        res.json({
          suggestedTimezone,
          currentTime: new Date().toLocaleString("en-US", {
            timeZone: suggestedTimezone,
            timeZoneName: "short",
          }),
          address,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            message: "Validation error",
            errors: error.errors,
          });
        }
        logError("Error getting timezone suggestion:", error);
        res.status(500).json({ message: "Failed to get timezone suggestion" });
      }
    }
  );

  /**
   * Validate timezone change and show impact assessment
   */
  app.post(
    "/api/business/timezone/validate",
    requireAuth(),
    async (req, res) => {
      try {
        const { biz } = await getBizForRequest(req);
        const business = await biz.getBusiness();

        const validationSchema = z.object({
          newTimezone: z.string().min(1, "Timezone is required"),
        });

        const { newTimezone } = validationSchema.parse(req.body);

        // Validate timezone format
        try {
          new Date().toLocaleString("en-US", { timeZone: newTimezone });
        } catch (timezoneError) {
          return res.status(400).json({
            isValid: false,
            error: "Invalid timezone format",
            newTimezone: newTimezone,
          });
        }

        const { QuietHoursCompliance } = await import(
          "../../services/quiet-hours-compliance.js"
        );
        const { MessageQueueService } = await import(
          "../../services/message-queue.js"
        );
        const { TimezoneService } = await import(
          "../../services/timezone-lookup.js"
        );

        // Get current business hours in both timezones
        const currentBusinessHours = "8:00 AM - 8:00 PM";
        const currentTzName =
          new Intl.DateTimeFormat("en-US", {
            timeZone: business.timezone,
            timeZoneName: "short",
          })
            .formatToParts(new Date())
            .find((part) => part.type === "timeZoneName")?.value || "";

        const newTzName =
          new Intl.DateTimeFormat("en-US", {
            timeZone: newTimezone,
            timeZoneName: "short",
          })
            .formatToParts(new Date())
            .find((part) => part.type === "timeZoneName")?.value || "";

        // Check for timezone/address mismatch
        const warnings: string[] = [];
        const suggestions: string[] = [];

        try {
          const businessProfile = await biz.getBusinessProfile();
          if (
            businessProfile?.addressState &&
            businessProfile?.addressPostalCode
          ) {
            const suggestedTimezone = TimezoneService.getTimezoneFromAddress({
              state: businessProfile.addressState,
              postalCode: businessProfile.addressPostalCode,
              country: businessProfile.addressCountry || "United States",
            });

            if (suggestedTimezone !== newTimezone) {
              warnings.push(
                `Selected timezone doesn't match your business location (${businessProfile.addressState})`
              );
              suggestions.push(
                `Consider ${suggestedTimezone} based on your business address`
              );
            }
          }
        } catch (profileError) {
          // If we can't get business profile, skip address validation
          logError("Could not fetch business profile for timezone validation", {
            error: profileError,
          });
        }

        // Get queue impact information
        const queueStats = await MessageQueueService.getBusinessQueueStats(
          business.id
        );
        const queuedMessagesAffected = queueStats.pending || 0;

        if (queuedMessagesAffected > 0) {
          warnings.push(
            `${queuedMessagesAffected} queued messages will send at the original scheduled time`
          );
        }

        // Calculate time difference impact
        const currentTime = new Date();
        const currentHour = parseInt(
          currentTime.toLocaleString("en-US", {
            timeZone: business.timezone,
            hour: "numeric",
            hour12: false,
          })
        );
        const newHour = parseInt(
          currentTime.toLocaleString("en-US", {
            timeZone: newTimezone,
            hour: "numeric",
            hour12: false,
          })
        );

        const hourDifference = Math.abs(newHour - currentHour);
        if (hourDifference > 0) {
          warnings.push(
            `Business hours will shift by ${hourDifference} hour${
              hourDifference > 1 ? "s" : ""
            }`
          );
        }

        res.json({
          isValid: true,
          warnings: warnings,
          suggestions: suggestions,
          impact: {
            currentBusinessHours: `${currentBusinessHours} ${currentTzName}`,
            newBusinessHours: `${currentBusinessHours} ${newTzName}`,
            queuedMessagesAffected: queuedMessagesAffected,
            timeDifference:
              hourDifference > 0
                ? `${hourDifference} hour${hourDifference > 1 ? "s" : ""}`
                : "No change",
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            message: "Validation error",
            errors: error.errors,
          });
        }
        logError("Error validating timezone change:", error);
        res.status(500).json({ message: "Failed to validate timezone change" });
      }
    }
  );

  /**
   * Check current business hours status
   */
  app.get("/api/business/hours-check", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const business = await biz.getBusiness();

      const { QuietHoursCompliance } = await import(
        "../../services/quiet-hours-compliance.js"
      );

      const isBusinessHours = QuietHoursCompliance.canSendImmediately(
        business.timezone,
        "campaign"
      );

      const currentTime = new Date();
      const businessTime = currentTime.toLocaleString("en-US", {
        timeZone: business.timezone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZoneName: "short",
      });

      const nextBusinessHour = isBusinessHours
        ? null
        : QuietHoursCompliance.getNextSendTime(business.timezone);

      const nextBusinessHourStr = nextBusinessHour
        ? nextBusinessHour.toLocaleString("en-US", {
            timeZone: business.timezone,
            weekday: "short",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
        : null;

      res.json({
        isBusinessHours,
        currentTime: businessTime,
        nextBusinessHour: nextBusinessHourStr,
        willBeQueued: !isBusinessHours,
        businessTimezone: business.timezone,
        businessHours: "8 AM - 8 PM",
      });
    } catch (error) {
      logError("Error checking business hours:", error);
      res.status(500).json({ message: "Failed to check business hours" });
    }
  });
}
