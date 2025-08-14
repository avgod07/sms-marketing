import type { Express } from "express";
import twilio from "twilio";
import { requireAuth } from "@clerk/express";
import { normalizePhoneNumber } from "../../utils/normalize.util.js";
import { TwilioService } from "../../services/twilio.js";
import { TwilioSubaccountService } from "../../services/twilio-subaccount.js";
import { socketService } from "../../socket";
import { storage } from "../../db/storage";
import { logError } from "../../utils/logger.util";
import { z } from "zod";
import {
  submitTollFreeVerification,
  getTollFreeVerificationStatus,
} from "../../services/tfv.js";
import { a2pConfigSchema, getBizForRequest } from "./utils";
import { db } from "../../config/db.config";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logInfo } from "../../utils/logger.util";
import { requireTFVPreCheck } from "../../middlewares/tfv-purchase-check.middleware";
import { createTFVRateLimiter } from "../../middlewares/rate-limit.middleware";
import { UniversalMessageService } from "../../services/universal-message.js";

// ✅ CREATE TFV RATE LIMITER INSTANCE
const tfvRateLimiter = createTFVRateLimiter();

export function registerTwilioRoutes(app: Express) {
  // Business-specific Twilio status callback using message SID (unauthenticated - external Twilio calls)
  app.post(
    "/api/webhooks/twilio/status-callback/:businessId",
    async (req, res) => {
      try {
        const { AccountSid, MessageSid, MessageStatus, To, ErrorCode } =
          req.body as any;

        // Extract business ID directly from URL parameter - no database lookup needed!
        const businessId = parseInt(req.params.businessId);
        if (!businessId || isNaN(businessId)) {
          logError("Invalid business ID in status callback URL", {
            providedBusinessId: req.params.businessId,
            AccountSid,
            MessageSid,
          });
          return res.status(400).send("Invalid business ID");
        }

        // Validate Twilio signature using correct auth token (subaccount or main account)
        const signature = req.get("x-twilio-signature") || "";
        const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

        try {
          const { getWebhookAuthToken } = await import(
            "../../services/twilio.js"
          );
          const token = await getWebhookAuthToken(businessId);
          const isValid = twilio.validateRequest(
            token,
            signature,
            url,
            req.body
          );

          if (!isValid) {
            logError("Invalid Twilio signature for status callback", {
              businessId,
              MessageSid,
              signature: signature.slice(0, 10) + "...", // Log partial signature for debugging
            });
            return res
              .status(403)
              .json({ message: "Invalid Twilio signature" });
          }
        } catch (error) {
          logError("Failed to validate Twilio signature for status callback", {
            businessId,
            MessageSid,
            error: error instanceof Error ? error.message : String(error),
          });
          return res
            .status(500)
            .json({ message: "Signature validation error" });
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
          socketService?.broadcast("message:status", updated, businessId);
        }

        res.status(200).send("OK");
      } catch (error) {
        logError("Error processing Twilio webhook:", error);
        res.status(500).json({ message: "Failed to process webhook" });
      }
    }
  );

  // Business-specific inbound message webhook (must remain unauthenticated for Twilio)
  app.post("/webhooks/twilio-inbound/:businessId", async (req, res) => {
    try {
      const { AccountSid, From, To, Body } = req.body as any;

      // Extract business ID directly from URL parameter - no database lookup needed!
      const businessId = parseInt(req.params.businessId);
      if (!businessId || isNaN(businessId)) {
        logError("Invalid business ID in webhook URL", {
          providedBusinessId: req.params.businessId,
          AccountSid,
          To,
        });
        return res.status(400).send("Invalid business ID");
      }

      // Validate Twilio signature using correct auth token (subaccount or main account)
      const signature = req.get("x-twilio-signature") || "";
      const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

      try {
        const { getWebhookAuthToken } = await import(
          "../../services/twilio.js"
        );
        const token = await getWebhookAuthToken(businessId);
        const valid = twilio.validateRequest(token, signature, url, req.body);

        if (!valid) {
          logError("Invalid Twilio signature for inbound message", {
            businessId,
            From,
            To,
            signature: signature.slice(0, 10) + "...", // Log partial signature for debugging
          });
          return res.status(403).send("Invalid Twilio signature");
        }
      } catch (error) {
        logError("Failed to validate Twilio signature for inbound message", {
          businessId,
          From,
          To,
          error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).send("Signature validation error");
      }

      const bizStore = storage.forBusiness(businessId);
      const normalizedFrom = normalizePhoneNumber(From);

      // 🚨 NEW: Check SMS command authorization FIRST - before any command scanning
      const { SMSCommandAuth } = await import(
        "../../services/sms-command-auth.js"
      );
      const isAuthorizedSender = await SMSCommandAuth.isAuthorizedSender(
        businessId,
        normalizedFrom
      );

      let contact = await bizStore.getContactByPhoneNumber(normalizedFrom);
      if (!contact) {
        contact = await bizStore.createContact({
          firstName: "SMS",
          lastName: "Contact",
          phoneNumber: normalizedFrom,
        });
      }

      const bodyText = (Body || "").trim();

      // 🚨 NEW: Only scan for commands if sender is authorized
      if (isAuthorizedSender) {
        const { SMSCommandParser } = await import(
          "../../services/sms-command-parser.js"
        );
        const { SMSCommandPending } = await import(
          "../../services/sms-command-pending.js"
        );

        // Check for pending command first
        const pendingCommand = await SMSCommandPending.getPendingCommand(
          businessId
        );

        if (pendingCommand) {
          // Handle YES/NO responses
          const confirmationResult =
            SMSCommandParser.parseConfirmationResponse(bodyText);

          if (confirmationResult.isConfirmation) {
            const { SMSCommandExecutor } = await import(
              "../../services/sms-command-executor.js"
            );
            const { SMSCommandResponses } = await import(
              "../../services/sms-command-responses.js"
            );

            if (confirmationResult.isYes) {
              // Execute the pending command
              logInfo("Executing confirmed SMS command", {
                businessId,
                pendingId: pendingCommand.id,
                senderPhone: normalizedFrom,
              });

              await SMSCommandExecutor.executePendingCommand(
                businessId,
                bizStore,
                pendingCommand
              );
            } else {
              // Cancel the pending command
              logInfo("Canceling SMS command", {
                businessId,
                pendingId: pendingCommand.id,
                senderPhone: normalizedFrom,
              });

              await SMSCommandResponses.sendCancellationResponse(
                bizStore,
                normalizedFrom,
                pendingCommand.messageContent
              );
            }

            // Clear the pending command either way
            await SMSCommandPending.clearPendingCommand(businessId);
            return res.status(200).send("OK");
          }

          // If not a confirmation, treat as new command (replaces pending)
          logInfo("Replacing pending command with new command", {
            businessId,
            oldPendingId: pendingCommand.id,
            senderPhone: normalizedFrom,
          });
        }

        // Parse new SEND: commands
        const commandResult = SMSCommandParser.parseCommand(bodyText);

        if (commandResult.isValidCommand && commandResult.message) {
          // Handle SMS command flow - CREATE PENDING instead of immediate execution
          logInfo("Processing SMS command for pending creation", {
            businessId,
            senderPhone: normalizedFrom,
            messageLength: commandResult.message.length,
          });

          const { SMSCommandExecutor } = await import(
            "../../services/sms-command-executor.js"
          );
          await SMSCommandExecutor.createPendingCommand(
            businessId,
            bizStore,
            normalizedFrom,
            commandResult.message,
            contact
          );

          // Command processed, return early (no need to create regular message)
          return res.status(200).send("OK");
        } else if (commandResult.error) {
          // Invalid command format from authorized sender
          const { SMSCommandResponses } = await import(
            "../../services/sms-command-responses.js"
          );
          await SMSCommandResponses.sendInvalidFormatResponse(
            bizStore,
            normalizedFrom,
            commandResult.error
          );
          return res.status(200).send("OK");
        }
      }

      // Handle as normal message (existing logic)
      const message = await bizStore.createMessage({
        phoneNumber: normalizedFrom,
        contactId: contact.id,
        content: bodyText,
        status: "received",
        messageType: "received",
      });

      if (bodyText.toLowerCase() === "stop") {
        if (contact.active) {
          await bizStore.updateContact(contact.id, { active: false });

          // Enhanced logging for compliance and queue suppression tracking
          logInfo("STOP received - contact deactivated", {
            businessId,
            contactId: contact.id,
            phoneNumber: normalizedFrom,
            previouslyActive: true,
            compliance: {
              note: "Future queued messages will be automatically suppressed",
              tcpaCompliance: "Contact will not receive marketing messages",
              auditTrail:
                "Queue processor will check contact.active status before sending",
            },
          });
        } else {
          // Contact already inactive - still send STOP response per TCPA
          logInfo("STOP received for already inactive contact", {
            businessId,
            contactId: contact.id,
            phoneNumber: normalizedFrom,
            previouslyActive: false,
            compliance: {
              note: "STOP response still required per TCPA even if already inactive",
            },
          });
        }

        // COMPLIANCE REQUIREMENT: STOP responses are free, mandatory, and MUST send immediately
        // UniversalMessageService handles this correctly with "stop_response" type
        await UniversalMessageService.sendMessage(bizStore, {
          businessId: businessId,
          phoneNumber: normalizedFrom,
          messageContent:
            "You've been removed from our list. You will no longer receive messages from us.",
          messageType: "stop_response",
          contactId: contact.id,
        });

        // Enhanced compliance logging
        logInfo("STOP response sent (compliance - no charge)", {
          businessId,
          contactId: contact.id,
          phoneNumber: normalizedFrom,
          compliance: {
            tcpaRequired: true,
            chargeApplied: false,
            messageType: "stop_response",
            sentAt: new Date().toISOString(),
            auditNote: "Automatic suppression now active for future messages",
          },
        });
      } else if (bodyText.toLowerCase() === "help") {
        // COMPLIANCE REQUIREMENT: HELP responses are free, mandatory, and MUST send immediately
        // UniversalMessageService handles this correctly with "help_response" type
        await UniversalMessageService.sendMessage(bizStore, {
          businessId: businessId,
          phoneNumber: normalizedFrom,
          messageContent:
            "NotiFlow SMS Help: Contact us at getnotiflow@gmail.com. Reply STOP to opt out. Msg & data rates may apply.",
          messageType: "help_response",
          contactId: contact.id,
        });

        // Log HELP response for compliance tracking (no billing)
        logInfo("HELP response sent (compliance - no charge)", {
          businessId,
          contactId: contact.id,
          phoneNumber: normalizedFrom,
        });
      } else {
        socketService?.broadcast("message:send", message, businessId);
      }

      res.status(200).send("OK");
    } catch (error) {
      logError("Error processing inbound webhook:", error);
      res.status(500).json({ message: "Failed to process inbound message" });
    }
  });

  // TFV-based onboarding - business profiles no longer needed

  app.get("/api/twilio/tfv/status/:tfvSid", requireAuth(), async (req, res) => {
    try {
      const { tfvSid } = req.params;

      if (!tfvSid) {
        return res.status(400).json({ message: "TFV SID required" });
      }

      const { biz } = await getBizForRequest(req);
      const business = await biz.getBusiness();
      const status = await getTollFreeVerificationStatus(tfvSid, business.id);
      res.json(status);
    } catch (error) {
      logError("Error checking TFV status:", error);
      res.status(500).json({ message: "Failed to check TFV status" });
    }
  });

  app.get("/api/twilio/credentials", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const messagingServiceSid = await biz.getMessagingServiceSid();
      const numbers = await biz.getPhoneNumbers();
      const phoneNumber = numbers.find((n) => n.isDefault)?.phoneNumber || null;

      // Return configuration from environment variables (no sensitive data)
      res.json({
        accountSid: process.env.TWILIO_ACCOUNT_SID || "Not configured",
        messagingServiceSid: messagingServiceSid || null,
        phoneNumber,
        isConfigured: TwilioService.isConfigured(),
      });
    } catch (error) {
      logError("Error fetching Twilio credentials:", error);
      res.status(500).json({ message: "Failed to fetch Twilio credentials" });
    }
  });

  app.get("/api/messaging/config", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const config = await biz.getTwilioA2PConfig();
      res.json(config || null);
    } catch (error) {
      logError("Error fetching messaging config:", error);
      res.status(500).json({ message: "Failed to fetch messaging config" });
    }
  });

  app.post("/api/messaging/config", requireAuth(), async (req, res) => {
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
      logError("Error saving messaging config:", error);
      res.status(500).json({ message: "Failed to save messaging config" });
    }
  });

  // Legacy endpoints for backward compatibility
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

  const twilioConnectSchema = z.object({
    phoneNumber: z.string().optional(),
  });

  app.post("/api/twilio/connect", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const { phoneNumber } = twilioConnectSchema.parse(req.body);

      // Use environment variables for Twilio credentials
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (!accountSid || !authToken) {
        return res.status(500).json({
          message: "Twilio not configured on server",
        });
      }

      const client = twilio(accountSid, authToken);
      try {
        await client.api.accounts(accountSid).fetch();
      } catch (err: any) {
        return res.status(400).json({
          message: "Invalid Twilio configuration, please contact support",
        });
      }

      // Create messaging service if needed
      let serviceSid = null;
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

      // Store only the account SID and messaging service SID (no auth token)
      await biz.upsertTwilioCredentials({
        accountSid,
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

      // Check server-side Twilio configuration
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (!accountSid || !authToken) {
        return res
          .status(500)
          .json({ message: "Twilio not configured on server" });
      }

      const client = twilio(accountSid, authToken);
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

      // Check server-side Twilio configuration
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (!accountSid || !authToken) {
        return res
          .status(500)
          .json({ message: "Twilio not configured on server" });
      }

      const client = twilio(accountSid, authToken);
      // Use environment variable for webhook URL, or skip in development
      const webhookUrl =
        process.env.TWILIO_WEBHOOK_URL ||
        (process.env.NODE_ENV === "production"
          ? `${req.protocol}://${req.get(
              "host"
            )}/api/webhooks/twilio/status-callback`
          : "");

      // Get or create messaging service SID
      let messagingServiceSid = await biz.getMessagingServiceSid();
      if (!messagingServiceSid) {
        const service = await client.messaging.services.create({
          friendlyName: `Business ${
            (
              await biz.getBusiness()
            ).id
          } - Messaging Service`,
        });
        messagingServiceSid = service.sid;
        await biz.setMessagingServiceSid(messagingServiceSid);
      }

      const fetched = await Promise.all(
        data.sids.map((sid) => client.incomingPhoneNumbers(sid).fetch())
      );
      // Only update webhook URL if provided (for production)
      if (webhookUrl) {
        await Promise.all(
          fetched.map((num) =>
            client.incomingPhoneNumbers(num.sid).update({ smsUrl: webhookUrl })
          )
        );
      }

      // Add all phone numbers to messaging service
      await Promise.all(
        fetched.map((num) =>
          client.messaging
            .services(messagingServiceSid!)
            .phoneNumbers.create({ phoneNumberSid: num.sid })
        )
      );
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
      const page = parseInt((req.query.page as string) || "0", 10);
      const contains = req.query.contains as string | undefined;
      const limit = parseInt((req.query.limit as string) || "12", 10);
      const numbers = await TwilioService.fetchAvailableTollFreeNumbers(creds, {
        page,
        contains,
        limit,
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
    requireTFVPreCheck,
    async (req, res) => {
      try {
        const { biz } = await getBizForRequest(req);
        const { phoneNumber: rawPhoneNumber } = reserveSchema.parse(req.body);

        // Normalize phone number to E.164 format (add +1 prefix if missing)
        const phoneNumber = normalizePhoneNumber(rawPhoneNumber);

        // Check server-side Twilio configuration
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;

        if (!accountSid || !authToken) {
          return res
            .status(500)
            .json({ message: "Twilio not configured on server" });
        }

        // Use environment variable for webhook URL, or skip in development
        const webhookUrl =
          process.env.TWILIO_WEBHOOK_URL ||
          (process.env.NODE_ENV === "production"
            ? `${req.protocol}://${req.get(
                "host"
              )}/api/webhooks/twilio/status-callback`
            : "");

        try {
          // Get or create messaging service SID
          let messagingServiceSid = await biz.getMessagingServiceSid();
          const client = twilio(accountSid, authToken);

          // Verify messaging service exists, create new one if not
          if (messagingServiceSid) {
            try {
              await client.messaging.services(messagingServiceSid).fetch();
              console.log(
                `✅ Verified existing messaging service: ${messagingServiceSid}`
              );
            } catch (error: any) {
              if (error.status === 404) {
                console.log(
                  `⚠️ Stored messaging service ${messagingServiceSid} not found, creating new one`
                );
                messagingServiceSid = undefined; // Reset to create a new one
              } else {
                throw error;
              }
            }
          }

          if (!messagingServiceSid) {
            const service = await client.messaging.services.create({
              friendlyName: `Business ${
                (
                  await biz.getBusiness()
                ).id
              } - Messaging Service`,
            });
            messagingServiceSid = service.sid;
            await biz.setMessagingServiceSid(messagingServiceSid);
            console.log(
              `✅ Created new messaging service: ${messagingServiceSid}`
            );
          }

          // Create a temporary creds object for compatibility with existing TwilioService
          const tempCreds = {
            businessId: (await biz.getBusiness()).id,
            accountSid: accountSid,
            messagingServiceSid: messagingServiceSid,
            createdAt: new Date(),
            updatedAt: new Date(),
            id: 0, // temporary ID
          };

          const { phoneSid, serviceSid } =
            await TwilioService.purchaseAndAssignNumber(
              tempCreds,
              phoneNumber,
              webhookUrl,
              tempCreds.businessId
            );

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
          // Add detailed logging to see what Twilio is actually returning
          logError("Detailed onboarding number purchase error:", {
            phoneNumber,
            error: err.message,
            code: err.code,
            status: err.status,
            moreInfo: err.moreInfo,
            details: err.details,
            stack: err.stack?.substring(0, 500), // Truncate stack trace
          });

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

  app.post(
    "/api/twilio/tollfree",
    requireAuth(),
    requireTFVPreCheck,
    async (req, res) => {
      try {
        const { biz } = await getBizForRequest(req);
        const { phoneNumber: rawPhoneNumber } = tollFreeSchema.parse(req.body);

        // Normalize phone number to E.164 format (add +1 prefix if missing)
        const phoneNumber = normalizePhoneNumber(rawPhoneNumber);

        // Debug logging
        const business = await biz.getBusiness();
        logInfo("Toll-free purchase with subaccount provisioning", {
          rawPhoneNumber,
          normalizedPhoneNumber: phoneNumber,
          businessId: business.id,
        });

        // 🚀 NEW: Try subaccount provisioning first
        try {
          // Get onboarding progress for subaccount provisioning
          const onboardingProgress = await biz.getOnboardingProgress();

          if (
            onboardingProgress?.useCases &&
            onboardingProgress?.monthlyVolume
          ) {
            logInfo("Starting subaccount provisioning", {
              businessId: business.id,
              businessName: business.name,
            });

            // Prepare business info from onboarding progress
            const businessInfo = {
              businessName:
                onboardingProgress.businessName ||
                business.name ||
                `Business-${business.id}`,
              websiteUrl: onboardingProgress.websiteUrl || undefined,
              address1: onboardingProgress.address1 || undefined,
              address2: onboardingProgress.address2 || undefined,
              city: onboardingProgress.city || undefined,
              state: onboardingProgress.state || undefined,
              postalCode: onboardingProgress.postalCode || undefined,
              country: onboardingProgress.country || "US",
              firstName: onboardingProgress.firstName || undefined,
              lastName: onboardingProgress.lastName || undefined,
              email: onboardingProgress.email || undefined,
              phoneNumber: phoneNumber, // ✅ Use the selected phone number from request
            };

            // Use subaccount service for complete provisioning
            const baseUrl = `${req.protocol}://${req.get("host")}`;
            const provisioningResult =
              await TwilioSubaccountService.provisionBusinessSubaccount({
                businessId: business.id,
                businessInfo,
                monthlyVolume: onboardingProgress.monthlyVolume,
                useCases: onboardingProgress.useCases || [],
                initialMessage:
                  business.initialMessage || "Welcome! Reply STOP to opt out.",
                storage: biz,
                baseUrl,
              });

            // Mark business as subaccount provisioned
            await biz.updateBusiness({ subaccountProvisioned: true });

            logInfo("Subaccount provisioning completed successfully", {
              businessId: business.id,
              subaccountSid: provisioningResult.subaccountSid,
              phoneNumber: provisioningResult.phoneNumber,
              tfvStatus: provisioningResult.tfvStatus,
            });

            return res.json({
              phoneNumber: provisioningResult.phoneNumber,
              phoneNumberSid: provisioningResult.phoneNumberSid,
              tfvStatus: provisioningResult.tfvStatus,
              tfvRequestId: provisioningResult.tfvRequestId,
              verificationStatus: provisioningResult.tfvStatus,
              message:
                "Subaccount provisioned successfully with dedicated toll-free number",
              subaccountProvisioned: true,
              phoneSid: provisioningResult.phoneNumberSid,
              isDefault: true,
            });
          } else {
            logInfo(
              "Subaccount provisioning skipped - missing onboarding data",
              {
                businessId: business.id,
                hasUseCases: !!onboardingProgress?.useCases,
                hasVolume: !!onboardingProgress?.monthlyVolume,
              }
            );
          }
        } catch (subaccountError) {
          logError(
            "Subaccount provisioning failed - no legacy fallback available",
            {
              businessId: business.id,
              error:
                subaccountError instanceof Error
                  ? subaccountError.message
                  : String(subaccountError),
            }
          );

          const errorMessage =
            subaccountError instanceof Error
              ? subaccountError.message
              : String(subaccountError);

          // ✅ Provide specific error messages for TFV-related failures
          if (
            errorMessage.includes("messageVolume") ||
            errorMessage.includes("MessageVolume")
          ) {
            return res.status(400).json({
              message:
                "Invalid message volume format detected. Our team has been notified and this will be resolved shortly.",
              error: "TFV_VOLUME_FORMAT_ERROR",
              details: "Volume format validation failed",
            });
          }

          if (
            errorMessage.includes("externalReferenceId") ||
            errorMessage.includes("external")
          ) {
            return res.status(400).json({
              message: "Reference ID format error detected. Please try again.",
              error: "TFV_REFERENCE_ID_ERROR",
              details: "External reference ID validation failed",
            });
          }

          if (
            errorMessage.includes("phone number") &&
            errorMessage.includes("not available")
          ) {
            return res.status(400).json({
              message:
                "The selected phone number is no longer available. Please refresh the page and select a different number.",
              error: "PHONE_NUMBER_UNAVAILABLE",
              details: errorMessage,
            });
          }

          if (
            errorMessage.includes("TFV") ||
            errorMessage.includes("toll-free") ||
            errorMessage.includes("verification")
          ) {
            return res.status(500).json({
              message:
                "Toll-free verification setup encountered an issue. Please try again or contact support if the problem persists.",
              error: "TFV_SUBMISSION_ERROR",
              details: errorMessage,
            });
          }

          // ✅ Generic error for other cases with more helpful message
          return res.status(500).json({
            message:
              "Phone number setup encountered an issue. Please try again in a few moments or contact support if the problem persists.",
            error: "PROVISIONING_FAILED",
            details: errorMessage,
          });
        }

        // If we reach here without a successful provisioning result, throw error
        throw new Error(
          "Subaccount provisioning failed - missing onboarding data"
        );

        // ❌ LEGACY FALLBACK REMOVED - COMMENTED OUT TO FORCE SUBACCOUNT-ONLY FLOW
        // // FALLBACK: Use legacy main account flow
        // // Check server-side Twilio configuration
        // const accountSid = process.env.TWILIO_ACCOUNT_SID;
        // const authToken = process.env.TWILIO_AUTH_TOKEN;

        // if (!accountSid || !authToken) {
        //   return res
        //     .status(500)
        //     .json({ message: "Twilio not configured on server" });
        // }

        // const client = twilio(accountSid, authToken);

        // // Check account type to see if it's a trial account
        // try {
        //   const account = await client.api.accounts(accountSid).fetch();
        //   logError("Twilio account info", {
        //     accountType: account.type,
        //     status: account.status,
        //     sid: accountSid.slice(-4),
        //   });
        // } catch (accountError) {
        //   logError("Failed to fetch account info:", accountError);
        // }

        // // Use environment variable for webhook URL, or auto-generate business-specific URL
        // const webhookUrl =
        //   process.env.TWILIO_WEBHOOK_URL ||
        //   (process.env.NODE_ENV === "production"
        //     ? `${req.protocol}://${req.get("host")}/webhooks/twilio-inbound/${
        //         business.id
        //       }`
        //     : undefined);

        // logInfo("Toll-free purchase attempt (legacy flow)", {
        //   businessId: business.id,
        //   phoneNumber,
        //   webhookUrl,
        //   accountSid: accountSid.slice(-4),
        // });

        // const { phoneSid, serviceSid } = await TwilioService.purchaseAndAssignNumber(
        //   { accountSid, authToken },
        //   phoneNumber,
        //   webhookUrl,
        //   business.id
        // );

        // // Store in the legacy businessPhoneNumbers table
        // await biz.addPhoneNumber({
        //   phoneNumber,
        //   phoneSid,
        //   isDefault: true,
        //   verificationStatus: "pending", // Start as pending
        // });

        // // Update business with messaging service SID
        // await biz.updateBusiness({
        //   messagingServiceSid: serviceSid,
        // });

        // // Submit TFV for the purchased number
        // let tfvResult = null;
        // try {
        //   if (
        //     onboardingProgress?.useCases &&
        //     onboardingProgress?.monthlyVolume &&
        //     onboardingProgress?.initialMessage
        //   ) {
        //     logInfo("Submitting TFV for legacy flow", {
        //       businessId: business.id,
        //       phoneNumber,
        //       phoneSid,
        //     });

        //     // Extract business info from onboarding progress
        //     const businessInfo = onboardingProgress.businessName
        //       ? {
        //           businessName: onboardingProgress.businessName,
        //           websiteUrl: onboardingProgress.websiteUrl,
        //           address1: onboardingProgress.address1,
        //           address2: onboardingProgress.address2,
        //           city: onboardingProgress.city,
        //           state: onboardingProgress.state,
        //           postalCode: onboardingProgress.postalCode,
        //           country: onboardingProgress.country,
        //           firstName: onboardingProgress.firstName,
        //           lastName: onboardingProgress.lastName,
        //           email: onboardingProgress.email,
        //           phoneNumber: onboardingProgress.phoneNumber,
        //         }
        //       : null;

        //     if (businessInfo) {
        //       const config: TwilioA2pConfig = {
        //         useCases: onboardingProgress.useCases,
        //         volume: onboardingProgress.monthlyVolume,
        //       };

        //       tfvResult = await submitTollFreeVerification(
        //         phoneSid,
        //         business,
        //         config,
        //         business.id,
        //         `${req.protocol}://${req.get("host")}`,
        //         businessInfo.email,
        //         {
        //           address1: businessInfo.address1 || "",
        //           address2: businessInfo.address2,
        //           city: businessInfo.city || "",
        //           state: businessInfo.state || "",
        //           postalCode: businessInfo.postalCode || "",
        //           country: businessInfo.country || "US",
        //         },
        //         businessInfo.websiteUrl,
        //         {
        //           firstName: businessInfo.firstName || "",
        //           lastName: businessInfo.lastName || "",
        //           email: businessInfo.email || "",
        //           phoneNumber: businessInfo.phoneNumber || "",
        //         }
        //       );

        //       // Update phone number with TFV status
        //       await biz.updatePhoneNumber(phoneSid, {
        //         verificationStatus: tfvResult.status || "pending",
        //         tfvSid: tfvResult.tfvSid,
        //       });

        //       logInfo("TFV submitted successfully for legacy flow", {
        //         businessId: business.id,
        //         tfvSid: tfvResult.tfvSid,
        //         status: tfvResult.status,
        //       });
        //     }
        //   } else {
        //     logInfo("TFV not submitted - missing onboarding data", {
        //       businessId: business.id,
        //       hasUseCases: !!onboardingProgress?.useCases,
        //       hasVolume: !!onboardingProgress?.monthlyVolume,
        //       hasMessage: !!onboardingProgress?.initialMessage,
        //     });
        //   }
        // } catch (tfvError) {
        //   logError("TFV submission failed in legacy flow", {
        //     businessId: business.id,
        //     error: tfvError instanceof Error ? tfvError.message : String(tfvError),
        //   });
        //   // Continue without TFV - phone number is still usable
        // }

        // logInfo("Legacy toll-free purchase completed", {
        //   businessId: business.id,
        //   phoneNumber,
        //   phoneSid,
        //   serviceSid,
        //   tfvStatus: tfvResult?.status || "not_submitted",
        // });

        // res.json({
        //   phoneNumber,
        //   phoneSid,
        //   serviceSid,
        //   verificationStatus: tfvResult?.status || "pending",
        //   tfvSid: tfvResult?.tfvSid || null,
        //   message: "Toll-free number purchased successfully",
        //   isDefault: true,
        // });
        // ❌ END OF LEGACY FALLBACK CODE
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Validation error", errors: error.errors });
        }
        logError("Error purchasing toll-free number:", error);
        res
          .status(500)
          .json({ message: "Failed to purchase toll-free number" });
      }
    }
  );

  // Onboarding Progress Endpoints
  app.get("/api/onboarding/progress", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const progress = await biz.getOnboardingProgress();

      if (!progress) {
        return res.json({
          step: 1,
          businessInfo: null,
          monthlyVolume: null,
          useCases: null,
          initialMessage: null,
        });
      }

      // Convert individual fields back to businessInfo object for frontend compatibility
      const businessInfo = progress.businessName
        ? {
            businessName: progress.businessName,
            websiteUrl: progress.websiteUrl,
            address1: progress.address1,
            address2: progress.address2,
            city: progress.city,
            state: progress.state,
            postalCode: progress.postalCode,
            country: progress.country,
            firstName: progress.firstName,
            lastName: progress.lastName,
            email: progress.email,
            phoneNumber: progress.phoneNumber,
          }
        : null;

      res.json({
        step: progress.step,
        businessInfo,
        monthlyVolume: progress.monthlyVolume,
        useCases: progress.useCases,
        initialMessage: progress.initialMessage
          ? { initialMessage: progress.initialMessage }
          : null,
      });
    } catch (error) {
      logError("Error fetching onboarding progress:", error);
      res.status(500).json({ message: "Failed to fetch onboarding progress" });
    }
  });

  const saveProgressSchema = z.object({
    step: z.number().min(1).max(5),
    businessInfo: z.any().optional(),
    monthlyVolume: z.string().optional(),
    useCases: z.array(z.string()).optional(),
    initialMessage: z
      .object({
        initialMessage: z.string().optional(),
      })
      .optional(),
  });

  app.post("/api/onboarding/save-progress", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const data = saveProgressSchema.parse(req.body);

      // Extract business info fields if provided
      const businessInfo = data.businessInfo;

      const progress = await biz.upsertOnboardingProgress({
        step: data.step,
        // Business info fields
        businessName: businessInfo?.businessName || null,
        websiteUrl: businessInfo?.websiteUrl || null,
        address1: businessInfo?.address1 || null,
        address2: businessInfo?.address2 || null,
        city: businessInfo?.city || null,
        state: businessInfo?.state || null,
        postalCode: businessInfo?.postalCode || null,
        country: businessInfo?.country || null,
        firstName: businessInfo?.firstName || null,
        lastName: businessInfo?.lastName || null,
        email: businessInfo?.email || null,
        phoneNumber: businessInfo?.phoneNumber || null,
        // A2P fields
        monthlyVolume: data.monthlyVolume || null,
        useCases: data.useCases || null,
        // Step 4: Initial message
        initialMessage: data.initialMessage?.initialMessage || null,
      });

      // Convert back to frontend format
      const responseBusinessInfo = progress.businessName
        ? {
            businessName: progress.businessName,
            websiteUrl: progress.websiteUrl,
            address1: progress.address1,
            address2: progress.address2,
            city: progress.city,
            state: progress.state,
            postalCode: progress.postalCode,
            country: progress.country,
            firstName: progress.firstName,
            lastName: progress.lastName,
            email: progress.email,
            phoneNumber: progress.phoneNumber,
          }
        : null;

      res.json({
        step: progress.step,
        businessInfo: responseBusinessInfo,
        monthlyVolume: progress.monthlyVolume,
        useCases: progress.useCases,
        initialMessage: progress.initialMessage
          ? { initialMessage: progress.initialMessage }
          : null,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Validation error", errors: error.errors });
      }
      logError("Error saving onboarding progress:", error);
      res.status(500).json({ message: "Failed to save onboarding progress" });
    }
  });

  const onboardingCompleteSchema = z.object({
    initialMessage: z
      .string()
      .min(1, "Initial message is required")
      .max(160, "Initial message must be 160 characters or less"),
  });

  app.post("/api/onboarding/complete", requireAuth(), async (req, res) => {
    try {
      const { biz, user } = await getBizForRequest(req);
      const { initialMessage } = onboardingCompleteSchema.parse(req.body);

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

      // Get onboarding progress to extract business information
      const progress = await biz.getOnboardingProgress();

      // Determine business timezone from address if available
      let businessTimezone = "America/New_York"; // Default timezone
      if (progress?.state && progress?.postalCode) {
        const { TimezoneService } = await import(
          "../../services/timezone-lookup.js"
        );
        businessTimezone = TimezoneService.getTimezoneFromAddress({
          state: progress.state,
          postalCode: progress.postalCode,
          country: progress.country || "United States",
        });

        logInfo("Business timezone determined from address", {
          businessId: (await biz.getBusiness()).id,
          state: progress.state,
          postalCode: progress.postalCode,
          timezone: businessTimezone,
        });
      } else {
        logInfo("Using default timezone - no address information available", {
          businessId: (await biz.getBusiness()).id,
          defaultTimezone: businessTimezone,
        });
      }

      // Mark onboarding as complete at business level and set initial message + timezone
      await biz.updateBusiness({
        initialMessage: finalMessage,
        onboardingComplete: true,
        timezone: businessTimezone,
      });

      // Also mark user onboarding as complete for backward compatibility
      await db
        .update(users)
        .set({ onboardingComplete: true })
        .where(eq(users.id, user.id));

      // Update business name from onboarding progress
      if (progress && progress.businessName) {
        await biz.updateBusiness({ name: progress.businessName });
      }

      const numbers = await biz.getPhoneNumbers();
      const messagingServiceSid = await biz.getMessagingServiceSid();
      const defaultNum = numbers.find((n) => n.isDefault);

      res.json({
        phoneNumber: defaultNum?.phoneNumber || null,
        serviceSid: defaultNum?.serviceSid || messagingServiceSid || null,
        initialMessage: finalMessage,
        timezone: businessTimezone,
      });
    } catch (error) {
      logError("Error completing onboarding:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  app.post(
    "/api/twilio/tfv/submit",
    requireAuth(),
    tfvRateLimiter,
    async (req, res) => {
      try {
        const { biz } = await getBizForRequest(req);

        const business = await biz.getBusiness();

        // ✅ USE TWILIOSUBACCOUNTS AS SINGLE SOURCE OF TRUTH
        const subaccount = await biz.getTwilioSubaccount();

        if (!subaccount) {
          return res.status(400).json({
            message: "No Twilio subaccount found - complete onboarding first",
          });
        }

        // Check if TFV already submitted
        if (subaccount.tfvRequestId) {
          return res.json({
            tfvSid: subaccount.tfvRequestId,
            status: subaccount.tfvStatus || "pending",
          });
        }

        const baseUrl = `${req.protocol}://${req.get("host")}`;

        // Get business email, address, and website from onboarding progress
        let businessEmail: string | undefined;
        let businessAddress: any;
        let businessWebsiteUrl: string | undefined;
        let businessContact: any;

        try {
          const onboardingProgress = await biz.getOnboardingProgress();
          businessEmail = onboardingProgress?.email || undefined;
          businessWebsiteUrl = onboardingProgress?.websiteUrl || undefined;

          // Extract contact information from onboarding progress
          if (onboardingProgress?.firstName && onboardingProgress?.lastName) {
            businessContact = {
              firstName: onboardingProgress.firstName,
              lastName: onboardingProgress.lastName,
              email: onboardingProgress.email || businessEmail,
              phoneNumber: onboardingProgress.phoneNumber,
            };
          }

          // Extract address data if available
          if (
            onboardingProgress?.address1 &&
            onboardingProgress?.city &&
            onboardingProgress?.state &&
            onboardingProgress?.postalCode
          ) {
            businessAddress = {
              address1: onboardingProgress.address1,
              address2: onboardingProgress.address2 || "",
              city: onboardingProgress.city,
              state: onboardingProgress.state,
              postalCode: onboardingProgress.postalCode,
              country: onboardingProgress.country || "US",
            };
          }
        } catch (e) {
          // No onboarding progress
        }

        // Validate required data
        if (!businessEmail || !businessAddress || !businessContact) {
          return res.status(400).json({
            message:
              "Missing required business information - complete onboarding first",
          });
        }

        const config = await biz.getTwilioA2PConfig();
        if (!config) {
          return res.status(400).json({
            message: "Missing A2P config - complete onboarding first",
          });
        }

        const result = await submitTollFreeVerification(
          subaccount.phoneNumberSid,
          business,
          config,
          business.id,
          baseUrl,
          businessEmail,
          businessAddress,
          businessWebsiteUrl,
          businessContact
        );

        // ✅ UPDATE SUBACCOUNT WITH TFV INFO
        await biz.updateTwilioSubaccount({
          tfvRequestId: result.tfvSid,
          tfvStatus: result.status,
        });

        res.json({
          tfvSid: result.tfvSid,
          status: result.status,
        });
      } catch (error) {
        logError("Error submitting TFV:", error);
        res
          .status(500)
          .json({ message: "Failed to submit TFV", error: String(error) });
      }
    }
  );

  // Phone number validation endpoint
  app.post("/api/twilio/validate-phone", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const { phoneNumber } = z
        .object({ phoneNumber: z.string() })
        .parse(req.body);

      const creds = await biz.getTwilioCredentials();
      if (!creds) {
        return res.status(400).json({ message: "Twilio not connected" });
      }

      const validation = await TwilioService.validatePhoneNumber(
        creds,
        phoneNumber
      );
      res.json(validation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Validation error", errors: error.errors });
      }
      logError("Error validating phone number:", error);
      res.status(500).json({ message: "Failed to validate phone number" });
    }
  });
}
