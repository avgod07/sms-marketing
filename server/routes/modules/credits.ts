import type { Express, Request, Response } from "express";
import express from "express";
import {
  createCheckoutSession,
  verifyWebhookSignature,
} from "../../services/stripe";
import { storage } from "../../db/storage";
import { logError } from "../../utils/logger.util";
import { getBizForRequest } from "./utils";

export function registerCreditsRoutes(app: Express) {
  // GET /api/credits - Get current credit balance
  app.get("/api/credits", async (req: Request, res: Response) => {
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
  });

  // POST /api/credits/checkout
  app.post("/api/credits/checkout", async (req: Request, res: Response) => {
    try {
      const { biz, user } = await getBizForRequest(req);
      const { amount, successUrl, cancelUrl } = req.body;
      if (!amount || !successUrl || !cancelUrl) {
        return res.status(400).json({ message: "Missing required fields" });
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
  });

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

      // Handle successful payment
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as any;
        const businessId = Number(session.metadata?.businessId);
        const credits = Number(session.metadata?.credits);
        if (businessId && credits) {
          try {
            const biz = storage.forBusiness(businessId);
            await biz.adjustCredits(credits, "purchase", "Stripe purchase", {
              stripeSessionId: session.id,
            });
          } catch (err) {
            logError("Failed to adjust credits after Stripe payment", err);
          }
        }
      }
      res.json({ received: true });
    }
  );
}
