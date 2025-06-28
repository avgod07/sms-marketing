import type { Express, Request, Response } from "express";
import express from "express";
import { requireAuth } from "@clerk/express";
import { createSubscriptionCheckout } from "../../services/subscription";
import { storage } from "../../db/storage";
import { logError, logInfo } from "../../utils/logger.util";
import { getBizForRequest } from "./utils";

export function registerSubscriptionRoutes(app: Express) {
  // GET /api/subscriptions/plans - Get available subscription plans
  app.get(
    "/api/subscriptions/plans",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const plans = await storage.getSubscriptionPlans();
        res.json(plans);
      } catch (err) {
        logError("Failed to fetch subscription plans", err);
        res.status(500).json({ message: "Failed to fetch subscription plans" });
      }
    }
  );

  // GET /api/subscriptions/current - Get current subscription status
  app.get(
    "/api/subscriptions/current",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { biz } = await getBizForRequest(req);
        const business = await biz.getBusiness();

        res.json({
          plan: business.plan,
          trialEndsAt: business.trialEndsAt,
          stripeCustomerId: business.stripeCustomerId,
          stripeSubscriptionId: business.stripeSubscriptionId,
        });
      } catch (err) {
        logError("Failed to fetch current subscription", err);
        res
          .status(500)
          .json({ message: "Failed to fetch current subscription" });
      }
    }
  );

  // POST /api/subscriptions/checkout - Create subscription checkout session
  app.post(
    "/api/subscriptions/checkout",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { biz, user } = await getBizForRequest(req);
        const { planName, billingCycle, successUrl, cancelUrl } = req.body;

        if (!planName || !billingCycle || !successUrl || !cancelUrl) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        if (!["monthly", "yearly"].includes(billingCycle)) {
          return res.status(400).json({ message: "Invalid billing cycle" });
        }

        const session = await createSubscriptionCheckout({
          businessId: user.businessId,
          planName,
          billingCycle,
          successUrl,
          cancelUrl,
        });

        res.json({ url: session.url });
      } catch (err) {
        logError("Failed to create subscription checkout session", err);
        res.status(500).json({ message: "Failed to create checkout session" });
      }
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
        const { verifyWebhookSignature } = await import(
          "../../services/stripe"
        );
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
            "../../services/subscription"
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
}
