import Stripe from "stripe";
import { logError } from "../utils/logger.util";

function getStripe() {
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
  // You may want to price credits dynamically or use a fixed price per credit
  const pricePerCredit = 1; // in cents (e.g., $0.01 per credit)
  const totalAmount = amount * pricePerCredit;

  return await getStripe().checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${amount} SMS Credits`,
          },
          unit_amount: pricePerCredit,
        },
        quantity: amount,
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
