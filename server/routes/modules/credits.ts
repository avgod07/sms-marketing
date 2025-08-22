import type { Express, Request, Response } from "express";
import express from "express";
import { requireAuth } from "@clerk/express";
import { createCheckoutSession } from "../../services/stripe";
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

        // Block credit purchases for free trial or cancelled users
        if (business.plan === "free_trial" || business.plan === "cancelled") {
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

  // Note: Stripe webhook route has been moved to webhook-routes.ts
  // to ensure it runs before express.json() middleware for raw body access.
}
