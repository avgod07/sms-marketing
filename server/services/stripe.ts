import Stripe from "stripe";
import { logError } from "../utils/logger.util";

export function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-05-28.basil",
  });
}

function getWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET!;
}

/**
 * Create a Stripe Checkout Session for purchasing credits.
 * @param businessId - The business making the purchase
 * @param amount - The number of credits to purchase
 * @param successUrl - Where to redirect after successful payment
 * @param cancelUrl - Where to redirect if payment is cancelled
 */
export async function createCheckoutSession({
  businessId,
  amount,
  successUrl,
  cancelUrl,
}: {
  businessId: number;
  amount: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const priceId = process.env.STRIPE_CREDITS_PRICE_ID;

  if (!priceId) {
    throw new Error(
      "Missing STRIPE_CREDITS_PRICE_ID environment variable. Please configure this in your Stripe Dashboard and set the environment variable."
    );
  }

  return await getStripe().checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price: priceId, // $0.01 per credit (configured in Stripe Dashboard)
        quantity: amount, // User-specified amount (maintains flexible purchasing)
      },
    ],
    metadata: {
      businessId: String(businessId),
      credits: String(amount),
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

/**
 * Verify and parse a Stripe webhook event.
 * @param signature - The Stripe-Signature header
 * @param payload - The raw request body
 */
export function verifyWebhookSignature(
  signature: string,
  payload: Buffer
): Stripe.Event | null {
  try {
    return getStripe().webhooks.constructEvent(
      payload,
      signature,
      getWebhookSecret()
    );
  } catch (err) {
    logError("Stripe webhook signature verification failed", err);
    return null;
  }
}
