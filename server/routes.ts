import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertContactSchema,
  insertCampaignSchema,
  insertMessageSchema,
  insertCouponSchema,
} from "@shared/schema";
import { z } from "zod";

const userCredentialsSchema = z.object({
  username: z.string(),
  password: z.string(),
});
import twilio from "twilio";
import { executeCampaign } from "./services/campaign.js";
import passport from "passport";
import bcrypt from "bcryptjs";
import { ensureAuthenticated } from "./auth";
import { logError, logInfo } from "./logger";
import { nanoid } from "nanoid";
import { createRateLimiter } from "./rate-limit";

export async function registerRoutes(app: Express): Promise<Server> {
  const redeemRateLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
  // Authentication routes
  app.post("/api/signup", async (req, res) => {
    try {
      const { username, password } = userCredentialsSchema.parse(req.body);
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "User already exists" });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ username, passwordHash });
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

      const messages = await storage.getMessages();
      const message = messages.find(m => m.phoneNumber === To && m.status !== "delivered" && m.status !== "failed");
      if (message) {
        await storage.updateMessageStatus(message.id, status, status === "delivered" ? new Date() : undefined);
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
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      logError("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
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
        contacts = await storage.searchContacts(search, status);
      } else if (status) {
        contacts = await storage.getContactsByStatus(status);
      } else if (segment) {
        contacts = await storage.getContactsBySegment(segment);
      } else {
        contacts = await storage.getContacts();
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
      const contact = await storage.getContact(id);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      logError("Error fetching contact:", error);
      res.status(500).json({ message: "Failed to fetch contact" });
    }
  });

  app.post("/api/contacts", async (req, res) => {
    try {
      const validatedData = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(validatedData);
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
      const contact = await storage.updateContact(id, validatedData);
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
      await storage.deleteContact(id);
      res.status(204).send();
    } catch (error) {
      logError("Error deleting contact:", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // Campaign routes
  app.get("/api/campaigns", async (req, res) => {
    try {
      const campaigns = await storage.getCampaigns();
      res.json(campaigns);
    } catch (error) {
      logError("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.get("/api/campaigns/stats", async (req, res) => {
    try {
      const stats = await storage.getCampaignStats();
      res.json(stats);
    } catch (error) {
      logError("Error fetching campaign stats:", error);
      res.status(500).json({ message: "Failed to fetch campaign stats" });
    }
  });

  app.get("/api/campaigns/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const campaign = await storage.getCampaign(id);
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
      const campaign = await storage.createCampaign(validatedData);

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
      const validatedData = insertCampaignSchema.partial().parse(req.body);
      const campaign = await storage.updateCampaign(id, validatedData);
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
      await storage.deleteCampaign(id);
      res.status(204).send();
    } catch (error) {
      logError("Error deleting campaign:", error);
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });

  app.post("/api/campaigns/:id/duplicate", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const campaign = await storage.getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      const copy = await storage.createCampaign({
        name: `${campaign.name} (Copy)`,
        message: campaign.message,
        audience: campaign.audience,
        status: "active",
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
      const campaign = await storage.getCampaign(campaignId);

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

      const coupons = await storage.searchCoupons({
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
      const coupon = await storage.getCoupon(id);
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
      const redemptions = await storage.getCouponRedemptions(id);
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
      const coupon = await storage.createCoupon(validatedData);
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
      const coupon = await storage.updateCoupon(id, validatedData);
      res.json(coupon);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      logError("Error updating coupon:", error);
      res.status(500).json({ message: "Failed to update coupon" });
    }
  });

  app.post("/api/coupons/:code/redeem", redeemRateLimiter, async (req, res) => {
    try {
      const code = req.params.code;
      const coupon = await storage.getCouponByCode(code);
      if (!coupon) {
        return res.status(404).json({ message: "Coupon not found" });
      }

      if (coupon.status !== "active") {
        return res.status(400).json({ error: "INACTIVE" });
      }

      if (coupon.expirationDate && new Date(coupon.expirationDate) < new Date()) {
        return res.status(400).json({ error: "EXPIRED" });
      }
      if (
        coupon.validDays !== null &&
        coupon.validDays !== undefined &&
        new Date(coupon.createdAt).getTime() + coupon.validDays * 24 * 60 * 60 * 1000 < Date.now()
      ) {
        return res.status(400).json({ error: "EXPIRED" });
      }

      if ((coupon.usageCount ?? 0) >= 1) {
        return res
          .status(400)
          .json({ error: "ALREADY_REDEEMED", message: "This coupon has already been used and cannot be redeemed again." });
      }

      const phoneNumber = req.body.phoneNumber;
      if (!phoneNumber) {
        return res.status(400).json({ message: "phoneNumber is required" });
      }

      const contact = await storage.getContactByPhoneNumber(phoneNumber);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const received = await storage.hasContactReceivedCoupon(contact.id, code);
      if (!received) {
        return res.status(400).json({
          message:
            "This contact was not part of the campaign that received this coupon.",
        });
      }
      const contactId = contact.id;

      const currentCount = coupon.usageCount ?? 0;
      const updated = await storage.updateCoupon(coupon.id, {
        usageCount: currentCount + 1,
      });
      await storage.createCouponRedemption({
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
      await storage.deleteCoupon(id);
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
        messages = await storage.getMessagesByCampaign(parseInt(campaignId as string));
      } else {
        messages = await storage.getMessages();
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
      const message = await storage.createMessage(validatedData);
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
      const message = await storage.updateMessageStatus(id, status, deliveredAt ? new Date(deliveredAt) : undefined);
      res.json(message);
    } catch (error) {
      logError("Error updating message status:", error);
      res.status(500).json({ message: "Failed to update message status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
