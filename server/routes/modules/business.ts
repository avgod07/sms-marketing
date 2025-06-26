import type { Express } from "express";
import { requireAuth } from "@clerk/express";
import { InsertBusinessProfile } from "@shared/schema";
import { logError } from "../../utils/logger.util";
import {
  businessProfileSchema,
  getBizForRequest,
  logDetailedError,
} from "./utils";

export function registerBusinessRoutes(app: Express) {
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
      const creds = await biz.getTwilioCredentials();
      res.json({
        phoneConfigured: !!creds,
        hasContacts: contactStats.allContacts > 0,
        hasCoupons: couponStats.allCoupons > 0,
        onboardingComplete: !!user.onboardingComplete,
      });
    } catch (error) {
      logDetailedError("Error fetching setup status", error);
      res.status(500).json({ message: "Failed to fetch setup status" });
    }
  });

  app.get("/api/business-profile", async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const profile = await biz.getBusinessProfile();
      res.json(profile || null);
    } catch (error) {
      logError("Error fetching business profile:", error);
      res.status(500).json({ message: "Failed to fetch business profile" });
    }
  });

  app.post("/api/business-profile", async (req, res) => {
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
