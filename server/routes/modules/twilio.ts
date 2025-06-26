import type { Express } from "express";
import { requireAuth } from "@clerk/express";
import twilio from "twilio";
import { decrypt, encrypt } from "../../utils/encryption.util";
import { normalizePhoneNumber } from "../../utils/normalize.util.js";
import { TwilioService } from "../../services/twilio.js";
import { socketService } from "../../socket";
import {
  storage,
  findTwilioCredentialByAccountSid,
  findBusinessIdByPhoneNumber,
} from "../../db/storage";
import { logError } from "../../utils/logger.util";
import { z } from "zod";
import {
  registerBusinessForA2P,
  registerCampaignForA2P,
} from "../../services/a2p.js";
import { a2pConfigSchema, getBizForRequest } from "./utils";
import { db } from "../../config/db.config";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

export function registerTwilioRoutes(app: Express) {
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
      else if (MessageStatus === "failed" || MessageStatus === "undelivered")
        status = "failed";

      const bizStore = storage.forBusiness(businessId);
      const messages = await bizStore.getMessages();
      const message = messages.find(
        (m) =>
          m.phoneNumber === To &&
          m.status !== "delivered" &&
          m.status !== "failed"
      );
      if (message) {
        await bizStore.updateMessageStatus(
          message.id,
          status,
          status === "delivered" ? new Date() : undefined
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
        ErrorCode ? parseInt(ErrorCode, 10) : undefined
      );

      if (updated) {
        socketService?.broadcast("message:status", updated);
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
        const from = numbers.find((n) => n.isDefault)?.phoneNumber;
        await TwilioService.sendSMS(creds, {
          to: normalizedFrom,
          message:
            "You've been removed from our list. You will no longer receive messages from us.",
          from,
          messagingServiceSid: creds?.messagingServiceSid || undefined,
          contactId: contact.id,
        });
      } else {
        socketService?.broadcast("message:send", message);
      }

      res.status(200).send("OK");
    } catch (error) {
      logError("Error processing inbound webhook:", error);
      res.status(500).json({ message: "Failed to process inbound message" });
    }
  });

  // Onboarding related routes
  const onboardingProfileSchema = z.object({
    name: z.string().min(1),
    addressLine1: z.string().min(1),
    addressLine2: z.string().optional(),
    addressCity: z.string().min(1),
    addressState: z.string().min(1),
    addressPostalCode: z.string().min(1),
    addressCountry: z.string().min(1),
    repEmail: z.string().email(),
    repPhone: z.string().min(1),
  });

  app.post(
    "/api/onboarding/business-profile",
    requireAuth(),
    async (req, res) => {
      try {
        const { biz } = await getBizForRequest(req);
        const data = onboardingProfileSchema.parse(req.body);

        const creds = await biz.getTwilioCredentials();
        if (!creds) {
          return res.status(400).json({ message: "Twilio not connected" });
        }

        const client = twilio(
          creds.accountSid,
          decrypt(creds.authTokenEncrypted)
        );

        const customer = await client.trusthub.v1.customerProfiles.create({
          friendlyName: data.name,
          email: data.repEmail,
          policySid: "RNXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        });

        const existing = await biz.getBusinessProfile();
        if (!existing) {
          return res.status(400).json({ message: "Business profile missing" });
        }

        const saved = await biz.upsertBusinessProfile({
          ...existing,
          customerProfileSid: customer.sid,
          registrationStatus: customer.status || existing.registrationStatus,
        });

        res.json({
          sid: saved.customerProfileSid,
          status: saved.registrationStatus,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Validation error", errors: error.errors });
        }
        logError("Error creating Twilio business profile:", error);
        const message: string =
          (error as any)?.message || "Failed to create business profile";
        res.status(500).json({ message });
      }
    }
  );

  app.post(
    "/api/onboarding/register-campaign",
    requireAuth(),
    async (req, res) => {
      try {
        const { biz } = await getBizForRequest(req);
        const creds = await biz.getTwilioCredentials();
        const profile = await biz.getBusinessProfile();
        const config = await biz.getTwilioA2PConfig();
        if (!creds || !profile || !config) {
          return res
            .status(400)
            .json({ message: "Missing profile, credentials or config" });
        }

        if (profile.campaignSid) {
          return res.json({
            sid: profile.campaignSid,
            status: profile.registrationStatus,
          });
        }

        const result = await registerCampaignForA2P(creds, profile, config);
        const saved = await biz.upsertBusinessProfile({
          ...profile,
          brandSid: result.brandSid,
          campaignSid: result.campaignSid,
          registrationStatus: result.status,
        });
        res.json({ sid: saved.campaignSid, status: saved.registrationStatus });
      } catch (error) {
        logError("Error registering campaign:", error);
        res.status(500).json({ message: "Failed to register campaign" });
      }
    }
  );

  app.get("/api/twilio/credentials", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const creds = await biz.getTwilioCredentials();
      if (!creds) {
        return res.json(null);
      }
      const numbers = await biz.getPhoneNumbers();
      const phoneNumber = numbers.find((n) => n.isDefault)?.phoneNumber || null;
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

  app.get("/api/twilio/a2p-config", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const config = await biz.getTwilioA2PConfig();
      res.json(config || null);
    } catch (error) {
      logError("Error fetching A2P config:", error);
      res.status(500).json({ message: "Failed to fetch A2P config" });
    }
  });

  app.post("/api/twilio/a2p-config", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const data = a2pConfigSchema.parse(req.body);
      const saved = await biz.upsertTwilioA2PConfig(data);
      res.json(saved);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Validation error", errors: error.errors });
      }
      logError("Error saving A2P config:", error);
      res.status(500).json({ message: "Failed to save A2P config" });
    }
  });

  const twilioCredsSchema = z.object({
    accountSid: z.string(),
    authToken: z.string(),
    messagingServiceSid: z.string().optional(),
    phoneNumber: z.string().optional(),
  });

  app.post("/api/twilio/connect", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const { accountSid, authToken, messagingServiceSid, phoneNumber } =
        twilioCredsSchema.parse(req.body);

      const client = twilio(accountSid, authToken);
      try {
        await client.api.accounts(accountSid).fetch();
      } catch (err: any) {
        return res.status(400).json({
          message: "Invalid SID or Auth Token, please check and try again",
        });
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
      await biz.upsertTwilioCredentials({
        accountSid,
        authTokenEncrypted: encrypted,
        messagingServiceSid: serviceSid,
      });

      if (phoneNumber) {
        await biz.setPhoneNumbers([{ phoneNumber, isDefault: true }]);
      }

      res.json({ messagingServiceSid: serviceSid });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Validation error", errors: error.errors });
      }
      logError("Error connecting Twilio:", error);
      res.status(500).json({ message: "Failed to connect Twilio account" });
    }
  });

  app.get("/api/twilio/numbers", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const creds = await biz.getTwilioCredentials();
      if (!creds) {
        return res.status(400).json({ message: "Twilio not connected" });
      }
      const client = twilio(
        creds.accountSid,
        decrypt(creds.authTokenEncrypted)
      );
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

  app.post("/api/twilio/numbers", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const data = numberSchema.parse(req.body);
      const creds = await biz.getTwilioCredentials();
      if (!creds) {
        return res.status(400).json({ message: "Twilio not connected" });
      }
      const client = twilio(
        creds.accountSid,
        decrypt(creds.authTokenEncrypted)
      );
      const webhookUrl = `${req.protocol}://${req.get(
        "host"
      )}/api/twilio/webhook`;

      const fetched = await Promise.all(
        data.sids.map((sid) => client.incomingPhoneNumbers(sid).fetch())
      );
      await Promise.all(
        fetched.map((num) =>
          client.incomingPhoneNumbers(num.sid).update({ smsUrl: webhookUrl })
        )
      );
      if (creds.messagingServiceSid) {
        await Promise.all(
          fetched.map((num) =>
            client.messaging
              .services(creds.messagingServiceSid as string)
              .phoneNumbers.create({ phoneNumberSid: num.sid })
          )
        );
      }
      const records = await biz.setPhoneNumbers(
        fetched.map((n) => ({
          phoneSid: n.sid,
          phoneNumber: n.phoneNumber,
          friendlyName: n.friendlyName,
          isDefault: n.sid === data.defaultSid,
        }))
      );
      res.json(records);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Validation error", errors: error.errors });
      }
      logError("Error saving phone numbers:", error);
      res.status(500).json({ message: "Failed to save phone numbers" });
    }
  });

  app.get("/api/twilio/available-tollfree", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const creds = await biz.getTwilioCredentials();
      if (!creds) {
        return res.status(400).json({ message: "Twilio not connected" });
      }
      const page = parseInt((req.query.page as string) || "0", 10);
      const contains = req.query.contains as string | undefined;
      const numbers = await TwilioService.fetchAvailableTollFreeNumbers(creds, {
        page,
        contains,
      });
      res.json(numbers);
    } catch (error) {
      logError("Error fetching available numbers:", error);
      res.status(500).json({ message: "Failed to fetch available numbers" });
    }
  });

  const reserveSchema = z.object({ phoneNumber: z.string() });

  app.post(
    "/api/onboarding/reserve-number",
    requireAuth(),
    async (req, res) => {
      try {
        const { biz } = await getBizForRequest(req);
        const { phoneNumber } = reserveSchema.parse(req.body);
        const creds = await biz.getTwilioCredentials();
        if (!creds) {
          return res.status(400).json({ message: "Twilio not connected" });
        }
        const webhookUrl = `${req.protocol}://${req.get(
          "host"
        )}/api/twilio/webhook`;

        try {
          const { phoneSid, serviceSid } =
            await TwilioService.purchaseAndAssignNumber(
              creds,
              phoneNumber,
              webhookUrl
            );

          if (!creds.messagingServiceSid) {
            await biz.upsertTwilioCredentials({
              accountSid: creds.accountSid,
              authTokenEncrypted: creds.authTokenEncrypted,
              messagingServiceSid: serviceSid,
            });
          }

          await biz.setPhoneNumbers([
            {
              phoneNumber,
              isDefault: true,
              phoneSid,
              serviceSid,
              assignmentStatus: "assigned",
            },
          ]);

          res.json({
            phoneNumber,
            phoneSid,
            serviceSid,
            assignmentStatus: "assigned",
          });
        } catch (err: any) {
          if (err?.status === 400 || err?.status === 409) {
            return res.status(400).json({
              message: "Number is no longer available. Please choose another.",
            });
          }
          logError("Error purchasing phone number:", err);
          return res
            .status(500)
            .json({ message: "Failed to purchase phone number" });
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Validation error", errors: error.errors });
        }
        logError("Error reserving number:", error);
        res.status(500).json({ message: "Failed to reserve number" });
      }
    }
  );

  const tollFreeSchema = z.object({ phoneNumber: z.string() });

  app.post("/api/twilio/tollfree", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const { phoneNumber } = tollFreeSchema.parse(req.body);
      const creds = await biz.getTwilioCredentials();
      if (!creds) {
        return res.status(400).json({ message: "Twilio not connected" });
      }
      const client = twilio(
        creds.accountSid,
        decrypt(creds.authTokenEncrypted)
      );
      const webhookUrl = `${req.protocol}://${req.get(
        "host"
      )}/api/twilio/webhook`;
      const num = await client.incomingPhoneNumbers.create({
        phoneNumber,
        smsUrl: webhookUrl,
      });
      if (creds.messagingServiceSid) {
        await client.messaging
          .services(creds.messagingServiceSid)
          .phoneNumbers.create({ phoneNumberSid: num.sid });
      }
      const [record] = await biz.setPhoneNumbers([
        { phoneNumber: num.phoneNumber, isDefault: true },
      ]);
      res.json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Validation error", errors: error.errors });
      }
      logError("Error purchasing toll-free number:", error);
      res.status(500).json({ message: "Failed to purchase toll-free number" });
    }
  });

  app.post("/api/onboarding/complete", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      await db
        .update(users)
        .set({ onboardingComplete: true })
        .where(eq(users.id, (req.user as any).id));

      if (req.user) {
        (req.user as any).onboardingComplete = true;
      }

      const numbers = await biz.getPhoneNumbers();
      const creds = await biz.getTwilioCredentials();
      const defaultNum = numbers.find((n) => n.isDefault);

      res.json({
        phoneNumber: defaultNum?.phoneNumber || null,
        serviceSid:
          defaultNum?.serviceSid || creds?.messagingServiceSid || null,
      });
    } catch (error) {
      logError("Error completing onboarding:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  app.post("/api/twilio/a2p/register", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const creds = await biz.getTwilioCredentials();
      const profile = await biz.getBusinessProfile();
      const business = await biz.getBusiness();
      const config = await biz.getTwilioA2PConfig();
      if (!creds || !profile || !config) {
        return res
          .status(400)
          .json({ message: "Missing profile, credentials or config" });
      }
      const result = await registerBusinessForA2P(
        creds,
        business,
        profile,
        config
      );
      await biz.upsertBusinessProfile({
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
}
