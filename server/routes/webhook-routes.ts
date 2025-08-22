import type { Express, Request, Response } from "express";
import express from "express";
import twilio from "twilio";
import { logError, logInfo } from "../utils/logger.util";
import { storage } from "../db/storage";

// Import webhook handlers
let socketService: any;
try {
  socketService = require("../socket").socketService;
} catch {
  // Socket service might not be available in tests
}

export function registerWebhookRoutes(app: Express) {
  // POST /api/webhooks/stripe - Handle Stripe webhooks for credit purchases
  // Stripe requires the raw body for webhook signature verification.
  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const signature = req.headers["stripe-signature"] as string;
      const payload = req.body; // Buffer
      let event;
      try {
        const { verifyWebhookSignature } = await import("../services/stripe");
        event = verifyWebhookSignature(signature, payload);
        if (!event) throw new Error("Invalid Stripe webhook signature");
      } catch (err) {
        logError("Stripe webhook error", err);
        return res.status(400).send(`Webhook Error: ${err}`);
      }

      // Handle credit purchase events (existing functionality)
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as any;
        const businessId = Number(session.metadata?.businessId);

        // Check if this is a credit purchase (has credits metadata)
        const credits = Number(session.metadata?.credits);
        const isCreditspurchase = session.metadata?.credits;

        // Check if this is a subscription purchase (has subscription object and planName)
        const isSubscriptionPurchase =
          session.subscription && session.metadata?.planName;

        // Skip processing if this is a subscription purchase (handled by subscription webhooks)
        if (isSubscriptionPurchase) {
          logInfo(
            "Checkout session for subscription - will be handled by subscription webhooks",
            {
              sessionId: session.id,
              subscriptionId: session.subscription,
              planName: session.metadata?.planName,
            }
          );
          return res.json({
            received: true,
            message: "Subscription handled by subscription webhooks",
          });
        }

        // Validate session data for credit purchases
        if (!businessId || !credits || !session.id) {
          logError("Invalid session metadata in Stripe webhook", { session });
          return res.status(400).json({ error: "Invalid session metadata" });
        }

        // Validate payment status
        if (session.payment_status !== "paid") {
          logError("Session not paid in Stripe webhook", { session });
          return res.status(400).json({ error: "Session not paid" });
        }

        // Validate amount matches expected credits (1 cent per credit)
        const expectedAmount = credits * 1; // $0.01 per credit in cents
        if (session.amount_total !== expectedAmount) {
          logError("Amount mismatch in Stripe webhook", {
            session,
            expectedAmount,
            actualAmount: session.amount_total,
          });
          return res.status(400).json({ error: "Amount mismatch" });
        }

        try {
          const biz = storage.forBusiness(businessId);

          // Check for existing transaction to prevent double-crediting
          const transactions = await biz.getCreditTransactions();
          const existingTransaction = transactions.find(
            (t) =>
              t.type === "purchase" &&
              t.metadata &&
              JSON.parse(t.metadata).stripeSessionId === session.id
          );

          if (existingTransaction) {
            logError("Duplicate Stripe webhook received", {
              sessionId: session.id,
            });
            return res
              .status(200)
              .json({ received: true, message: "Already processed" });
          }

          await biz.adjustCredits(credits, "purchase", "Stripe purchase", {
            stripeSessionId: session.id,
            amountPaid: session.amount_total,
            currency: session.currency,
          });

          logInfo("Credits added successfully from Stripe payment", {
            businessId,
            credits,
            sessionId: session.id,
            amount: session.amount_total,
          });
        } catch (err) {
          logError("Failed to adjust credits after Stripe payment", err);
          return res.status(500).json({ error: "Failed to process payment" });
        }
      }

      // Handle subscription-related events (new functionality)
      if (
        event.type.startsWith("customer.subscription.") ||
        event.type.startsWith("invoice.payment.")
      ) {
        try {
          const { handleSubscriptionWebhook } = await import(
            "../services/subscription"
          );
          await handleSubscriptionWebhook(event);

          logInfo("Subscription webhook processed successfully", {
            eventType: event.type,
            eventId: event.id,
          });
        } catch (err) {
          logError("Failed to handle subscription webhook", {
            eventType: event.type,
            eventId: event.id,
            error: err,
          });
          return res
            .status(500)
            .json({ error: "Failed to process subscription webhook" });
        }
      }

      res.json({ received: true });
    }
  );

  // POST /api/webhooks/subscriptions - Handle Stripe subscription webhooks
  // This must use express.raw() for Stripe signature verification
  app.post(
    "/api/webhooks/subscriptions",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const signature = req.headers["stripe-signature"] as string;
      const payload = req.body; // Buffer

      if (!signature || !payload) {
        return res.status(400).json({ error: "Missing signature or payload" });
      }

      try {
        const { verifyWebhookSignature } = await import("../services/stripe");
        const event = verifyWebhookSignature(signature, payload);

        if (!event) {
          return res.status(400).json({ error: "Invalid webhook signature" });
        }

        // Handle subscription-related events
        if (
          event.type.startsWith("customer.subscription.") ||
          event.type.startsWith("invoice.payment.")
        ) {
          const { handleSubscriptionWebhook } = await import(
            "../services/subscription"
          );
          await handleSubscriptionWebhook(event);
        }

        res.json({ received: true });
      } catch (err) {
        logError("Subscription webhook error", err);
        res.status(400).json({ error: "Webhook processing failed" });
      }
    }
  );

  // POST /api/webhooks/twilio/status-callback/:businessId - Twilio status callback
  // Business-specific Twilio status callback using message SID (unauthenticated - external Twilio calls)
  app.post(
    "/api/webhooks/twilio/status-callback/:businessId",
    express.urlencoded({ extended: false }), // Twilio sends application/x-www-form-urlencoded data
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
          const { getWebhookAuthToken } = await import("../services/twilio.js");
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

  // Note: Twilio inbound webhook (/webhooks/twilio-inbound/:businessId) will remain
  // in the original twilio.ts module as it doesn't need raw body parsing for signature verification
  // and is very complex (~264 lines). Only Stripe webhooks need raw body for HMAC verification.
}
