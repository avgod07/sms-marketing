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

  // Note: Subscription webhook route has been moved to webhook-routes.ts
  // to ensure it runs before express.json() middleware for raw body access.

  // POST /api/subscriptions/cancel - Cancel the current subscription
  app.post(
    "/api/subscriptions/cancel",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { biz, user } = await getBizForRequest(req);
        const business = await biz.getBusiness();
        const stripeSubscriptionId = business.stripeSubscriptionId;
        if (!stripeSubscriptionId) {
          return res
            .status(400)
            .json({ message: "No active subscription to cancel." });
        }
        // Cancel the subscription in Stripe
        const { getStripe } = await import("../../services/stripe");
        const stripe = getStripe();
        await stripe.subscriptions.update(stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
        // Update business plan to 'cancelled' and clear subscription ID
        await biz.updateBusinessPlan("cancelled", undefined, undefined);
        await biz.recordSubscriptionEvent(
          "subscription_cancelled",
          stripeSubscriptionId,
          {
            userId: user.id,
            cancelledAt: new Date().toISOString(),
          }
        );
        res.json({ success: true });
      } catch (err) {
        logError("Failed to cancel subscription", err);
        res.status(500).json({ message: "Failed to cancel subscription" });
      }
    }
  );
}
