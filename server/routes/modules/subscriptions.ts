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

        let cancelAt: string | null = null;
        let cancelAtPeriodEnd = false;

        // If there's an active subscription, check if it's scheduled for cancellation
        if (business.stripeSubscriptionId && business.plan === "starter") {
          try {
            const { getStripe } = await import("../../services/stripe");
            const stripe = getStripe();
            const subscription = await stripe.subscriptions.retrieve(
              business.stripeSubscriptionId
            );
            
            cancelAtPeriodEnd = subscription.cancel_at_period_end;
            if (subscription.cancel_at) {
              cancelAt = new Date(subscription.cancel_at * 1000).toISOString();
            }
          } catch (stripeErr) {
            // If we can't fetch from Stripe, just continue without cancel info
            logError("Failed to fetch subscription from Stripe", stripeErr);
          }
        }

        res.json({
          plan: business.plan,
          trialEndsAt: business.trialEndsAt,
          stripeCustomerId: business.stripeCustomerId,
          stripeSubscriptionId: business.stripeSubscriptionId,
          cancelAtPeriodEnd,
          cancelAt,
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
        // Cancel the subscription in Stripe at the end of the billing period
        const { getStripe } = await import("../../services/stripe");
        const stripe = getStripe();
        const updatedSubscription = await stripe.subscriptions.update(stripeSubscriptionId, {
          cancel_at_period_end: true,
        });

        // DON'T immediately mark as cancelled - let the Stripe webhook handle the actual
        // transition when the subscription period ends. The user should retain access
        // until the billing period is over.
        
        // Record that cancellation was requested (but subscription is still active)
        await biz.recordSubscriptionEvent(
          "subscription_cancel_requested",
          stripeSubscriptionId,
          {
            userId: user.id,
            cancelRequestedAt: new Date().toISOString(),
            cancelAt: updatedSubscription.cancel_at 
              ? new Date(updatedSubscription.cancel_at * 1000).toISOString() 
              : null,
          }
        );

        logInfo("Subscription cancellation scheduled", {
          businessId: business.id,
          subscriptionId: stripeSubscriptionId,
          cancelAt: updatedSubscription.cancel_at,
        });

        res.json({ 
          success: true,
          cancelAt: updatedSubscription.cancel_at 
            ? new Date(updatedSubscription.cancel_at * 1000).toISOString() 
            : null,
        });
      } catch (err) {
        logError("Failed to cancel subscription", err);
        res.status(500).json({ message: "Failed to cancel subscription" });
      }
    }
  );
}
