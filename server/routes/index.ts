import type { Express } from "express";
import { createServer, type Server } from "http";
import {
  storage,
  findTwilioCredentialByAccountSid,
  findBusinessIdByPhoneNumber,
} from "../db/storage";
import { db } from "../config/db.config";
import { businesses } from "@shared/schema";
import { normalizePhoneNumber } from "../utils/normalize.util.js";
import { TwilioService } from "../services/twilio.js";
import { socketService } from "../socket";
import {
  insertContactSchema,
  insertMessageSchema,
  insertCouponSchema,
  insertBusinessProfileSchema,
  type InsertBusinessProfile,
} from "@shared/schema";
import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .max(72, { message: "Password must be at most 72 characters" })
  .regex(/[a-z]/, { message: "Password must contain a lowercase letter" })
  .regex(/[A-Z]/, { message: "Password must contain an uppercase letter" })
  .regex(/\d/, { message: "Password must contain a number" })
  .regex(/[^A-Za-z0-9]/, { message: "Password must contain a symbol" });

const loginSchema = z.object({
  username: z.string().email({ message: "Invalid email" }),
  password: passwordSchema,
});

const signupSchema = loginSchema;

const businessProfileSchema = insertBusinessProfileSchema.extend({
  name: z.string().optional(),
});

const simpleCampaignSchema = z.object({
  name: z.string().min(1, { message: "Campaign name is required" }),
  message: z
    .string()
    .min(1, { message: "Message is required" })
    .max(160, { message: "Message must be 160 characters or less" }),
});
import twilio from "twilio";
import { executeCampaign } from "../services/campaign.js";
import { registerBusinessForA2P } from "../services/a2p.js";
import passport from "passport";
import bcrypt from "bcryptjs";
import { ensureAuthenticated } from "../middlewares/auth.middleware";
import { logError, logInfo } from "../utils/logger.util";
import { nanoid } from "nanoid";
import { createRateLimiter } from "../middlewares/rate-limit.middleware";
import { validateCoupon } from "../middlewares/coupon.middleware";
import { encrypt, decrypt } from "../utils/encryption.util";

export async function registerRoutes(app: Express): Promise<Server> {
  const redeemRateLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
  function biz(req: any) {
    return storage.forBusiness(req.user.businessId);
  }
  // Authentication routes
  app.post("/api/signup", async (req, res) => {
    try {
      const { username, password } = signupSchema.parse(req.body);
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "User already exists" });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const defaultBusinessName = username.split("@")[0] || "Untitled";
      const business = await storage.createBusiness({ name: defaultBusinessName });
      const user = await storage.forBusiness(business.id).createUser({ username, passwordHash });
      try {
        await new Promise<void>((resolve, reject) => {
          req.login(user, (err: any) => {
            if (err) return reject(err);
            return resolve();
          });
        });
        res.status(201).json({ message: "Signed up" });
      } catch (err) {
        logError("Error logging in after signup:", err);
        return res.status(500).json({ message: "Failed to sign up" });
      }
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

  // Twilio status webhook endpoint (unauthenticated)
  app.post("/api/twilio/webhook", async (req, res) => {
    try {
      const { AccountSid, MessageStatus, To } = req.body as any;

      let creds = await findTwilioCredentialByAccountSid(AccountSid);
      let businessId = creds?.businessId;
      if (!businessId && To) {
        businessId = await findBusinessIdByPhoneNumber(To);
        if (businessId) {
          creds = await storage.forBusiness(businessId).getTwilioCredentials();
        }
      }

      if (!businessId || !creds) {
        logError("Unknown status webhook", { AccountSid, To });
        return res.status(400).send("Unknown account");
      }

      const signature = req.get("x-twilio-signature") || "";
      const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
      const token = decrypt(creds.authTokenEncrypted);
      const isValid = twilio.validateRequest(token, signature, url, req.body);
      if (!isValid) {
        return res.status(403).json({ message: "Invalid Twilio signature" });
      }

      let status = "sent";
      if (MessageStatus === "delivered") status = "delivered";
      else if (MessageStatus === "failed" || MessageStatus === "undelivered") status = "failed";

      const bizStore = storage.forBusiness(businessId);
      const messages = await bizStore.getMessages();
      const message = messages.find(m => m.phoneNumber === To && m.status !== "delivered" && m.status !== "failed");
      if (message) {
        await bizStore.updateMessageStatus(
          message.id,
          status,
          status === "delivered" ? new Date() : undefined,
        );
      }

      res.status(200).send("OK");
    } catch (error) {
      logError("Error processing Twilio webhook:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });

  // New Twilio status callback using message SID
  app.post("/api/webhooks/twilio/status-callback", async (req, res) => {
    try {
      const { AccountSid, MessageSid, MessageStatus, To, ErrorCode } =
        req.body as any;

      let creds = await findTwilioCredentialByAccountSid(AccountSid);
      let businessId = creds?.businessId;
      if (!businessId && To) {
        businessId = await findBusinessIdByPhoneNumber(To);
        if (businessId) {
          creds = await storage.forBusiness(businessId).getTwilioCredentials();
        }
      }

      if (!businessId || !creds) {
        logError("Unknown status webhook", { AccountSid, To });
        return res.status(400).send("Unknown account");
      }

      const signature = req.get("x-twilio-signature") || "";
      const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
      const token = decrypt(creds.authTokenEncrypted);
      const isValid = twilio.validateRequest(token, signature, url, req.body);
      if (!isValid) {
        return res.status(403).json({ message: "Invalid Twilio signature" });
      }

      if (!MessageSid) {
        return res.status(400).send("Missing MessageSid");
      }

      let status = "sent";
      if (MessageStatus === "delivered") status = "delivered";
      else if (MessageStatus === "failed" || MessageStatus === "undelivered")
        status = "failed";

      const bizStore = storage.forBusiness(businessId);
      const updated = await bizStore.updateMessageStatusBySid(
        MessageSid,
        status,
        ErrorCode ? parseInt(ErrorCode, 10) : undefined,
      );

      if (updated) {
        socketService?.broadcast('message:status', updated);
      }

      res.status(200).send("OK");
    } catch (error) {
      logError("Error processing Twilio webhook:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });

  // Inbound message webhook for all businesses
  app.post("/webhooks/twilio-inbound", async (req, res) => {
    try {
      const { AccountSid, From, To, Body } = req.body as any;

      let creds = await findTwilioCredentialByAccountSid(AccountSid);
      let businessId = creds?.businessId;
      if (!businessId && To) {
        businessId = await findBusinessIdByPhoneNumber(To);
        if (businessId) {
          creds = await storage.forBusiness(businessId).getTwilioCredentials();
        }
      }

      if (!businessId || !creds) {
        logError("Unknown inbound message", { AccountSid, To });
        return res.status(400).send("Unknown account");
      }

      const signature = req.get("x-twilio-signature") || "";
      const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
      const token = decrypt(creds.authTokenEncrypted);
      const valid = twilio.validateRequest(token, signature, url, req.body);
      if (!valid) {
        return res.status(403).send("Invalid Twilio signature");
      }

      const bizStore = storage.forBusiness(businessId);
      const normalizedFrom = normalizePhoneNumber(From);
      let contact = await bizStore.getContactByPhoneNumber(normalizedFrom);
      if (!contact) {
        contact = await bizStore.createContact({
          firstName: "SMS",
          lastName: "Contact",
          phoneNumber: normalizedFrom,
        });
      }

      const bodyText = (Body || "").trim();

      const message = await bizStore.createMessage({
        phoneNumber: normalizedFrom,
        contactId: contact.id,
        content: bodyText,
        status: "received",
      });

      if (bodyText.toLowerCase() === "stop") {
        if (contact.active) {
          await bizStore.updateContact(contact.id, { active: false });
        }
        const numbers = await bizStore.getPhoneNumbers();
        const from = numbers.find(n => n.isDefault)?.phoneNumber;
        await TwilioService.sendSMS(creds, {
          to: normalizedFrom,
          message:
            "You\u2019ve been removed from our list. You will no longer receive messages from us.",
          from,
          messagingServiceSid: creds?.messagingServiceSid || undefined,
          contactId: contact.id,
        });
      }

      socketService?.broadcast("message:send", message);

      res.status(200).send("OK");
    } catch (error) {
      logError("Error processing inbound webhook:", error);
      res.status(500).json({ message: "Failed to process inbound message" });
    }
  });

  // Public contact signup - no authentication required
  const publicContactSchema = insertContactSchema.extend({
    businessId: z.number(),
  });

  app.post("/public/contacts", async (req, res) => {
    try {
      const { businessId, ...contact } = publicContactSchema.parse(req.body);
      const contactStore = storage.forBusiness(businessId);
      const newContact = await contactStore.createContact(contact);
      res.status(201).json(newContact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      logError("Error creating public contact:", error);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  // Require authentication for subsequent API routes
  app.use("/api", ensureAuthenticated);

  // Dashboard routes
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await biz(req).getDashboardStats();
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
      logError("Error fetching dashboard stats:", error);
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
      res.status(500).json({ message: "Failed to fetch dashboard stats", stats: defaults });
    }
  });

  app.get("/api/analytics", async (req, res) => {
    try {
      const { range } = req.query as { range?: string };
      if (
        !range ||
        !["thisMonth", "lastMonth", "thisWeek", "lastWeek"].includes(range)
      ) {
        return res.status(400).json({ message: "Invalid range" });
      }
      const analytics = await biz(req).getAnalytics(range as any);
      res.json(analytics);
    } catch (error) {
      logError("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  app.get("/api/setup/status", async (req, res) => {
    try {
      const contactStats = await biz(req).getContactStats();
      const couponStats = await biz(req).getCouponStats();
      const creds = await biz(req).getTwilioCredentials();
      res.json({
        phoneConfigured: !!creds,
        hasContacts: contactStats.allContacts > 0,
        hasCoupons: couponStats.allCoupons > 0,
      });
    } catch (error) {
      logError("Error fetching setup status:", error);
      res.status(500).json({ message: "Failed to fetch setup status" });
    }
  });

  app.get("/api/credits", async (_req, res) => {
    try {
      // TODO: replace with real credit lookup
      const credits = 100;
      res.json(credits);
    } catch (error) {
      logError("Error fetching credits:", error);
      res.status(500).json({ message: "Failed to fetch credits" });
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
      const { name, ...profile } = data as { name?: string } & InsertBusinessProfile;
      if (name) {
        await biz(req).updateBusiness({ name });
      }
      const saved = await biz(req).upsertBusinessProfile(profile);
      res.json(saved);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      logError("Error saving business profile:", error);
      res.status(500).json({ message: "Failed to save business profile" });
    }
  });

  app.get("/api/twilio/credentials", async (req, res) => {
    try {
      const creds = await biz(req).getTwilioCredentials();
      if (!creds) {
        return res.json(null);
      }
      const numbers = await biz(req).getPhoneNumbers();
      const phoneNumber = numbers.find(n => n.isDefault)?.phoneNumber || null;
      res.json({
        accountSid: creds.accountSid,
        authToken: decrypt(creds.authTokenEncrypted),
        messagingServiceSid: creds.messagingServiceSid,
        phoneNumber,
      });
    } catch (error) {
      logError("Error fetching Twilio credentials:", error);
      res.status(500).json({ message: "Failed to fetch Twilio credentials" });
    }
  });

  const twilioCredsSchema = z.object({
    accountSid: z.string(),
    authToken: z.string(),
    messagingServiceSid: z.string().optional(),
    phoneNumber: z.string().optional(),
  });

  app.post("/api/twilio/connect", async (req, res) => {
    try {
      const { accountSid, authToken, messagingServiceSid, phoneNumber } =
        twilioCredsSchema.parse(req.body);

      const client = twilio(accountSid, authToken);
      try {
        await client.api.accounts(accountSid).fetch();
      } catch (err: any) {
        return res
          .status(400)
          .json({ message: "Invalid SID or Auth Token, please check and try again" });
      }

      let serviceSid = messagingServiceSid;
      if (!serviceSid) {
        try {
          const service = await client.messaging.services.create({
            friendlyName: `Messaging Service - ${accountSid.slice(-4)}`,
          });
          serviceSid = service.sid;
        } catch (err: any) {
          logError("Error creating messaging service:", err);
          return res
            .status(500)
            .json({ message: "Failed to create messaging service" });
        }
      }

      const encrypted = encrypt(authToken);
      await biz(req).upsertTwilioCredentials({
        accountSid,
        authTokenEncrypted: encrypted,
        messagingServiceSid: serviceSid,
      });

      if (phoneNumber) {
        await biz(req).setPhoneNumbers([
          { phoneNumber, isDefault: true },
        ]);
      }

      res.json({ messagingServiceSid: serviceSid });
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

  app.post("/api/twilio/a2p/register", async (req, res) => {
    try {
      const creds = await biz(req).getTwilioCredentials();
      const profile = await biz(req).getBusinessProfile();
      const business = await biz(req).getBusiness();
      if (!creds || !profile) {
        return res.status(400).json({ message: "Missing profile or credentials" });
      }
      const result = await registerBusinessForA2P(creds, business, profile);
      await biz(req).upsertBusinessProfile({
        ...profile,
        customerProfileSid: result.customerProfileSid,
        brandSid: result.brandSid,
        campaignSid: result.campaignSid,
        registrationStatus: result.status,
      });
      res.json({ status: result.status });
    } catch (error) {
      logError("Error registering A2P:", error);
      res.status(500).json({ message: "Failed to register A2P" });
    }
  });

  // Contact routes
  app.get("/api/contacts", async (req, res) => {
    try {
      const { search } = req.query as { search?: string };

      let contacts;
      if (search) {
        contacts = await biz(req).searchContacts(search);
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
      const stats = await biz(req).getContactStats();
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
      const validatedData = simpleCampaignSchema.parse(req.body);
      const campaign = await biz(req).createCampaign(validatedData);

      const results = await executeCampaign(biz(req), campaign.id);

      res.status(201).json({
        campaign,
        sentCount: results.sentCount,
        failedCount: results.failedCount,
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
      const validatedData = simpleCampaignSchema.partial().parse(req.body);
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
        status: "in_progress",
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

      const results = await executeCampaign(biz(req), campaignId);

      res.json({
        message: "Campaign sent successfully",
        sentCount: results.sentCount,
        failedCount: results.failedCount,
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
      const coupon = await biz(req).getCoupon(id);
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

  // Conversation routes
  app.get("/api/conversations", async (req, res) => {
    try {
      const convs = await biz(req).getConversationSummaries();
      res.json(convs);
    } catch (error) {
      logError("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:contactId/messages", async (req, res) => {
    try {
      const contactId = parseInt(req.params.contactId);
      const msgs = await biz(req).getMessagesByContact(contactId);
      res.json(msgs);
    } catch (error) {
      logError("Error fetching messages by contact:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
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

      const contact = await biz(req).getContact(validatedData.contactId);
      if (!contact || !contact.active) {
        return res.status(400).json({ message: 'Contact is inactive' });
      }

      const creds = await biz(req).getTwilioCredentials();
      const numbers = await biz(req).getPhoneNumbers();
      const from = numbers.find(n => n.isDefault)?.phoneNumber;

      const result = await TwilioService.sendSMS(creds, {
        to: validatedData.phoneNumber,
        message: validatedData.content,
        from,
        messagingServiceSid: creds?.messagingServiceSid || undefined,
        campaignId: validatedData.campaignId ?? undefined,
        contactId: validatedData.contactId,
      });

      const message = await biz(req).createMessage({
        ...validatedData,
        status: result.success ? "sent" : "failed",
        messageSid: result.messageSid,
      });


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
      const { status, deliveredAt, errorCode } = req.body;
      const message = await biz(req).updateMessageStatus(
        id,
        status,
        deliveredAt ? new Date(deliveredAt) : undefined,
        errorCode,
      );
      res.json(message);
    } catch (error) {
      logError("Error updating message status:", error);
      res.status(500).json({ message: "Failed to update message status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
