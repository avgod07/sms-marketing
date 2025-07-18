import type { Express, Request, Response } from "express";
import express from "express";
import { requireAuth } from "@clerk/express";
import {
  createCheckoutSession,
  verifyWebhookSignature,
} from "../../services/stripe";
import { storage } from "../../db/storage";
import { logError, logInfo } from "../../utils/logger.util";
import { getBizForRequest } from "./utils";

export function registerCreditsRoutes(app: Express) {
  // GET /api/credits - Get current credit balance
  app.get(
    "/api/credits",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { biz } = await getBizForRequest(req);
        const credits = await biz.getCredits();

        // Return 0 if no credits record exists yet
        const balance = credits?.balance || 0;
        res.json({ balance });
      } catch (err) {
        logError("Failed to fetch credits", err);
        res.status(500).json({ message: "Failed to fetch credits" });
      }
    }
  );

  // POST /api/credits/checkout
  app.post(
    "/api/credits/checkout",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { biz, user } = await getBizForRequest(req);
        const { amount, successUrl, cancelUrl } = req.body;

        if (!amount || !successUrl || !cancelUrl) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        // Check if user is on a paid plan or has an active trial
        const business = await biz.getBusiness();
        const isTrialExpired = business.trialEndsAt
          ? new Date(business.trialEndsAt) < new Date()
          : false;

        if (business.plan === "trial" || isTrialExpired) {
          return res.status(403).json({
            message:
              "Credit purchases require a paid plan. Please upgrade to continue.",
            code: "UPGRADE_REQUIRED",
          });
        }

        const session = await createCheckoutSession({
          businessId: user.businessId,
          amount,
          successUrl,
          cancelUrl,
        });
        res.json({ url: session.url });
      } catch (err) {
        logError("Failed to create Stripe checkout session", err);
        res.status(500).json({ message: "Failed to create checkout session" });
      }
    }
  );

  // Stripe requires the raw body for webhook signature verification.
  // This must come BEFORE express.json() is applied globally.
  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const signature = req.headers["stripe-signature"] as string;
      const payload = req.body; // Buffer
      let event;
      try {
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
        const credits = Number(session.metadata?.credits);

        // Validate session data
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
            "../../services/subscription"
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
}
