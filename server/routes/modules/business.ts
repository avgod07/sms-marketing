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
      const complianceText = "Text STOP to unsubscribe.";
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
}
