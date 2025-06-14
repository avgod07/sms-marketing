import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { normalizePhoneNumber } from "./phone.js";
import { TwilioService } from "./services/twilio.js";
import {
  insertContactSchema,
  insertCampaignSchema,
  insertMessageSchema,
  insertCouponSchema,
  insertBusinessProfileSchema,
} from "@shared/schema";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

const signupSchema = loginSchema.extend({
  businessName: z.string(),
});

const businessProfileSchema = insertBusinessProfileSchema.extend({
  businessName: z.string(),
});
import twilio from "twilio";
import { executeCampaign } from "./services/campaign.js";
import passport from "passport";
import bcrypt from "bcryptjs";
import { ensureAuthenticated } from "./auth";
import { logError, logInfo } from "./logger";
import { nanoid } from "nanoid";
import { createRateLimiter } from "./rate-limit";
import { validateCoupon } from "./coupon-middleware";
import { encrypt, decrypt } from "./utils/encryption";

export async function registerRoutes(app: Express): Promise<Server> {
  const redeemRateLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
  await storage.normalizeCampaignStatuses();

  function biz(req: any) {
    return storage.forBusiness(req.user.businessId);
  }
  // Authentication routes
  app.post("/api/signup", async (req, res) => {
    try {
      const { username, password, businessName } = signupSchema.parse(req.body);
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "User already exists" });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const business = await storage.createBusiness({ name: businessName });
      const user = await storage.forBusiness(business.id).createUser({ username, passwordHash });
      req.login(user, (err: any) => {
        if (err) throw err;
        res.status(201).json({ message: "Signed up" });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      logError("Error signing up:", error);
      res.status(500).json({ message: "Failed to sign up" });
    }
  });

  app.post(
    "/api/login",
    passport.authenticate("local"),
    (_req, res) => {
      res.json({ message: "Logged in" });
    },
  );

  // Return current authenticated user or null
  app.get("/api/me", (req, res) => {
    res.json(req.user || null);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err: any) => {
      if (err) return next(err);
      res.json({ message: "Logged out" });
    });
  });

  // Twilio webhook endpoint (unauthenticated)
  app.post("/api/twilio/webhook", async (req, res) => {
    try {
      const signature = req.get("x-twilio-signature") || "";
      const authToken = process.env.TWILIO_AUTH_TOKEN || "";
      const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

      const isValid = twilio.validateRequest(authToken, signature, url, req.body);
      if (!isValid) {
        return res.status(403).json({ message: "Invalid Twilio signature" });
      }

      const { MessageStatus, To } = req.body;

      let status = "sent";
      if (MessageStatus === "delivered") status = "delivered";
      else if (MessageStatus === "failed" || MessageStatus === "undelivered") status = "failed";

      const messages = await biz(req).getMessages();
      const message = messages.find(m => m.phoneNumber === To && m.status !== "delivered" && m.status !== "failed");
      if (message) {
        await biz(req).updateMessageStatus(message.id, status, status === "delivered" ? new Date() : undefined);
      }

      res.status(200).send("OK");
    } catch (error) {
      logError("Error processing Twilio webhook:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });

  // Require authentication for subsequent API routes
  app.use("/api", ensureAuthenticated);

  // Dashboard routes
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await biz(req).getDashboardStats();
      res.json(stats);
    } catch (error) {
      logError("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/setup/status", async (req, res) => {
    try {
      const contactStats = await biz(req).getContactStats();
      const creds = await biz(req).getTwilioCredentials();
      res.json({
        phoneConfigured: !!creds,
        hasContacts: contactStats.allContacts > 0,
      });
    } catch (error) {
      logError("Error fetching setup status:", error);
      res.status(500).json({ message: "Failed to fetch setup status" });
    }
  });

  app.get("/api/business-profile", async (req, res) => {
    try {
      const profile = await biz(req).getBusinessProfile();
      res.json(profile || null);
    } catch (error) {
      logError("Error fetching business profile:", error);
      res.status(500).json({ message: "Failed to fetch business profile" });
    }
  });

  app.post("/api/business-profile", async (req, res) => {
    try {
      const data = businessProfileSchema.parse(req.body);
      await biz(req).updateBusiness({ name: data.businessName });
      const profile = await biz(req).upsertBusinessProfile(data);
      res.json(profile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      logError("Error saving business profile:", error);
      res.status(500).json({ message: "Failed to save business profile" });
    }
  });

  const twilioCredsSchema = z.object({
    accountSid: z.string(),
    authToken: z.string(),
  });

  app.post("/api/twilio/connect", async (req, res) => {
    try {
      const { accountSid, authToken } = twilioCredsSchema.parse(req.body);

      const client = twilio(accountSid, authToken);
      try {
        await client.api.accounts(accountSid).fetch();
      } catch (err: any) {
        return res
          .status(400)
          .json({ message: "Invalid SID or Auth Token, please check and try again" });
      }

      let service;
      try {
        service = await client.messaging.services.create({
          friendlyName: `Messaging Service - ${accountSid.slice(-4)}`,
        });
      } catch (err: any) {
        logError("Error creating messaging service:", err);
        return res.status(500).json({ message: "Failed to create messaging service" });
      }

      const encrypted = encrypt(authToken);
      await biz(req).upsertTwilioCredentials({
        accountSid,
        authTokenEncrypted: encrypted,
        messagingServiceSid: service.sid,
      });

      res.json({ messagingServiceSid: service.sid });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      logError("Error connecting Twilio:", error);
      res.status(500).json({ message: "Failed to connect Twilio account" });
    }
  });

  app.get("/api/twilio/numbers", async (req, res) => {
    try {
      const creds = await biz(req).getTwilioCredentials();
      if (!creds) {
        return res.status(400).json({ message: "Twilio not connected" });
      }
      const client = twilio(creds.accountSid, decrypt(creds.authTokenEncrypted));
      const numbers = await client.incomingPhoneNumbers.list();
      res.json(
        numbers.map((n: any) => ({
          sid: n.sid,
          phoneNumber: n.phoneNumber,
          friendlyName: n.friendlyName,
        }))
      );
    } catch (error) {
      logError("Error fetching phone numbers:", error);
      res.status(500).json({ message: "Failed to fetch phone numbers" });
    }
  });

  const numberSchema = z.object({
    defaultSid: z.string(),
    sids: z.array(z.string()),
  });

  app.post("/api/twilio/numbers", async (req, res) => {
    try {
      const data = numberSchema.parse(req.body);
      const creds = await biz(req).getTwilioCredentials();
      if (!creds) {
        return res.status(400).json({ message: "Twilio not connected" });
      }
      const client = twilio(creds.accountSid, decrypt(creds.authTokenEncrypted));
      const webhookUrl = `${req.protocol}://${req.get("host")}/api/twilio/webhook`;

      const fetched = await Promise.all(
        data.sids.map((sid) => client.incomingPhoneNumbers(sid).fetch())
      );

      for (const num of fetched) {
        if (creds.messagingServiceSid) {
          await client.messaging
            .services(creds.messagingServiceSid)
            .phoneNumbers.create({ phoneNumberSid: num.sid });
        }
        await client.incomingPhoneNumbers(num.sid).update({ smsUrl: webhookUrl });
      }

      const records = await biz(req).setPhoneNumbers(
        fetched.map((n) => ({
          phoneNumber: n.phoneNumber,
          isDefault: n.sid === data.defaultSid,
        }))
      );

      res.json(records);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      logError("Error saving phone numbers:", error);
      res.status(500).json({ message: "Failed to save phone numbers" });
    }
  });

  // Contact routes
  app.get("/api/contacts", async (req, res) => {
    try {
      const { segment, search, status } = req.query as {
        segment?: string;
        search?: string;
        status?: string;
      };

      let contacts;
      if (search) {
        contacts = await biz(req).searchContacts(search, status);
      } else if (status) {
        contacts = await biz(req).getContactsByStatus(status);
      } else if (segment) {
        contacts = await biz(req).getContactsBySegment(segment);
      } else {
        contacts = await biz(req).getContacts();
      }
      
      res.json(contacts);
    } catch (error) {
      logError("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.get("/api/contacts/stats", async (req, res) => {
    try {
      const { status } = req.query as { status?: string };
      const stats = await storage.getContactStats(status);
      res.json(stats);
    } catch (error) {
      logError("Error fetching contact stats:", error);
      res.status(500).json({ message: "Failed to fetch contact stats" });
    }
  });

  app.get("/api/contacts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const contact = await biz(req).getContact(id);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      logError("Error fetching contact:", error);
      res.status(500).json({ message: "Failed to fetch contact" });
    }
  });

  app.get("/api/contacts/:id/redemptions", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const contact = await biz(req).getContact(id);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      const redemptions = await biz(req).getContactRedemptions(id);
      res.json(redemptions);
    } catch (error) {
      logError("Error fetching contact redemptions:", error);
      res.status(500).json({ message: "Failed to fetch contact redemptions" });
    }
  });

  app.post("/api/contacts", async (req, res) => {
    try {
      const validatedData = insertContactSchema.parse(req.body);
      const contact = await biz(req).createContact(validatedData);
      res.status(201).json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      logError("Error creating contact:", error);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  app.patch("/api/contacts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertContactSchema.partial().parse(req.body);
      const contact = await biz(req).updateContact(id, validatedData);
      res.json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      logError("Error updating contact:", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await biz(req).deleteContact(id);
      res.status(204).send();
    } catch (error) {
      logError("Error deleting contact:", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // Campaign routes
  app.get("/api/campaigns", async (req, res) => {
    try {
      const campaigns = await biz(req).getCampaigns();
      res.json(campaigns);
    } catch (error) {
      logError("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.get("/api/campaigns/stats", async (req, res) => {
    try {
      const stats = await biz(req).getCampaignStats();
      res.json(stats);
    } catch (error) {
      logError("Error fetching campaign stats:", error);
      res.status(500).json({ message: "Failed to fetch campaign stats" });
    }
  });

  app.get("/api/campaigns/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const campaign = await biz(req).getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      logError("Error fetching campaign:", error);
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });

  app.post("/api/campaigns", async (req, res) => {
    try {
      const validatedData = insertCampaignSchema.parse(req.body);
      const campaign = await biz(req).createCampaign(validatedData);

      const results = await executeCampaign(campaign.id);

      res.status(201).json({
        campaign,
        sentCount: results.sentCount,
        totalContacts: results.totalContacts,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      logError("Error creating campaign:", error);
      res.status(500).json({ message: "Failed to create campaign" });
    }
  });

  app.patch("/api/campaigns/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await biz(req).getCampaign(id);
      if (!existing) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      if (existing.status === "completed") {
        return res.status(400).json({ message: "Completed campaigns cannot be edited" });
      }
      const validatedData = insertCampaignSchema.partial().parse(req.body);
      const campaign = await biz(req).updateCampaign(id, validatedData);
      res.json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      logError("Error updating campaign:", error);
      res.status(500).json({ message: "Failed to update campaign" });
    }
  });

  app.delete("/api/campaigns/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await biz(req).deleteCampaign(id);
      res.status(204).send();
    } catch (error) {
      logError("Error deleting campaign:", error);
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });

  app.post("/api/campaigns/:id/duplicate", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const campaign = await biz(req).getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      const copy = await biz(req).createCampaign({
        name: `${campaign.name} (Copy)`,
        message: campaign.message,
        audience: campaign.audience,
        status: "in_progress",
        scheduledAt: campaign.scheduledAt || null,
      });
      res.status(201).json(copy);
    } catch (error) {
      logError("Error duplicating campaign:", error);
      res.status(500).json({ message: "Failed to duplicate campaign" });
    }
  });

  // Send campaign
  app.post("/api/campaigns/:id/send", async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const campaign = await biz(req).getCampaign(campaignId);

      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      const results = await executeCampaign(campaignId);

      res.json({
        message: "Campaign sent successfully",
        sentCount: results.sentCount,
        totalContacts: results.totalContacts,
      });
    } catch (error) {
      logError("Error sending campaign:", error);
      res.status(500).json({ message: "Failed to send campaign" });
    }
  });

  // Coupon routes
  app.get("/api/coupons", async (req, res) => {
    try {
      const { search, status, type, startDate, endDate } = req.query as {
        search?: string;
        status?: string;
        type?: string;
        startDate?: string;
        endDate?: string;
      };

      const coupons = await biz(req).searchCoupons({
        search,
        status,
        type,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });
      res.json(coupons);
    } catch (error) {
      logError("Error fetching coupons:", error);
      res.status(500).json({ message: "Failed to fetch coupons" });
    }
  });

  app.get("/api/coupons/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const coupon = await biz(req).getCoupon(id);
      if (!coupon) {
        return res.status(404).json({ message: "Coupon not found" });
      }
      res.json(coupon);
    } catch (error) {
      logError("Error fetching coupon:", error);
      res.status(500).json({ message: "Failed to fetch coupon" });
    }
  });

  app.get("/api/coupons/:id/redemptions", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const coupon = await storage.getCoupon(id);
      if (!coupon) {
        return res.status(404).json({ message: "Coupon not found" });
      }
      const redemptions = await biz(req).getCouponRedemptions(id);
      res.json(redemptions);
    } catch (error) {
      logError("Error fetching coupon redemptions:", error);
      res.status(500).json({ message: "Failed to fetch coupon redemptions" });
    }
  });

  app.post("/api/coupons", async (req, res) => {
    try {
      const data = { ...req.body };
      if (!data.code) {
        data.code = nanoid(8).toUpperCase();
      }
      if (data.expirationDate) {
        data.expirationDate = new Date(data.expirationDate);
      }
      if (data.validDays !== undefined && data.validDays !== null) {
        data.validDays = Number(data.validDays);
      }
      const validatedData = insertCouponSchema.parse(data);
      const coupon = await biz(req).createCoupon(validatedData);
      res.status(201).json(coupon);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      if (error.code === "23505") {
        return res.status(400).json({ message: "Coupon code already exists" });
      }
      logError("Error creating coupon:", error);
      res.status(500).json({ message: "Failed to create coupon" });
    }
  });

  app.patch("/api/coupons/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = { ...req.body };
      if (data.expirationDate) {
        data.expirationDate = new Date(data.expirationDate);
      }
      if (data.validDays !== undefined && data.validDays !== null) {
        data.validDays = Number(data.validDays);
      }
      const validatedData = insertCouponSchema.partial().parse(data);
      const coupon = await biz(req).updateCoupon(id, validatedData);
      res.json(coupon);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      logError("Error updating coupon:", error);
      res.status(500).json({ message: "Failed to update coupon" });
    }
  });

  app.post(
    "/api/coupons/:code/redeem",
    redeemRateLimiter,
    validateCoupon,
    async (req, res) => {
      try {
        const coupon = (req as any).coupon;
        const code = req.params.code;

      const rawPhone = req.body.phoneNumber;
      if (!rawPhone) {
        return res.status(400).json({ message: "phoneNumber is required" });
      }

      const phoneNumber = normalizePhoneNumber(rawPhone);

      const contact = await biz(req).getContactByPhoneNumber(phoneNumber);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const received = await biz(req).hasContactReceivedCoupon(contact.id, code);
      if (!received) {
        return res.status(400).json({
          message:
            "This contact was not part of the campaign that received this coupon.",
        });
      }

      const alreadyRedeemed = await biz(req).hasContactRedeemedCoupon(
        contact.id,
        coupon.id,
      );
      if (alreadyRedeemed) {
        return res.status(400).json({
          error: "ALREADY_REDEEMED",
          message: "This contact has already redeemed this coupon.",
        });
      }
      const contactId = contact.id;

      const currentCount = coupon.usageCount ?? 0;
      const updated = await biz(req).updateCoupon(coupon.id, {
        usageCount: currentCount + 1,
      });
      await biz(req).createCouponRedemption({
        couponId: coupon.id,
        contactId,
        phoneNumber,
        note: req.body.note,
      });
      logInfo("Coupon redeemed", {
        couponId: coupon.id,
        userId: (req as any).user?.id,
        contactId,
        phoneNumber,
      });
      res.json({ usageCount: updated.usageCount });
    } catch (error) {
      logError("Error redeeming coupon:", error);
      res.status(500).json({ message: "Failed to redeem coupon" });
    }
  });

  app.delete("/api/coupons/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await biz(req).deleteCoupon(id);
      res.status(204).send();
    } catch (error) {
      logError("Error deleting coupon:", error);
      res.status(500).json({ message: "Failed to delete coupon" });
    }
  });

  // Message routes
  app.get("/api/messages", async (req, res) => {
    try {
      const { campaignId } = req.query;
      
      let messages;
      if (campaignId) {
        messages = await biz(req).getMessagesByCampaign(parseInt(campaignId as string));
      } else {
        messages = await biz(req).getMessages();
      }
      
      res.json(messages);
    } catch (error) {
      logError("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const validatedData = insertMessageSchema.parse(req.body);
      const message = await biz(req).createMessage({ ...validatedData });
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      logError("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  app.patch("/api/messages/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, deliveredAt } = req.body;
      const message = await biz(req).updateMessageStatus(id, status, deliveredAt ? new Date(deliveredAt) : undefined);
      res.json(message);
    } catch (error) {
      logError("Error updating message status:", error);
      res.status(500).json({ message: "Failed to update message status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
