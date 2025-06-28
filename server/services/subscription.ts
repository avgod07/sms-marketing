import Stripe from "stripe";
import { getStripe } from "./stripe";
import { storage } from "../db/storage";
import { logError, logInfo } from "../utils/logger.util";

export interface CreateSubscriptionOptions {
  businessId: number;
  planName: string;
  billingCycle: "monthly" | "yearly";
  successUrl: string;
  cancelUrl: string;
}

export interface SubscriptionPlan {
  name: string;
  displayName: string;
  priceId: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
}

/**
 * Create a Stripe Checkout Session for subscription upgrade.
 */
export async function createSubscriptionCheckout({
  businessId,
  planName,
  billingCycle,
  successUrl,
  cancelUrl,
}: CreateSubscriptionOptions): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();

  // Define plan pricing
  const planPricing = {
    starter: {
      monthly: 2000, // $20.00 in cents
      yearly: 18000, // $180.00 in cents (billed annually)
    },
  };

  const priceAmount =
    planPricing[planName as keyof typeof planPricing]?.[billingCycle];

  if (!priceAmount) {
    throw new Error(
      `Invalid plan or billing cycle: ${planName} ${billingCycle}`
    );
  }

  // Create checkout session with dynamic pricing
  return await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Starter Plan",
            description: "SMS marketing platform subscription",
          },
          unit_amount: priceAmount, // Use the calculated price amount
          recurring: {
            interval: billingCycle === "yearly" ? "year" : "month",
            interval_count: 1,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      businessId: String(businessId),
      planName,
      billingCycle,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
  });
}

/**
 * Create or get a Stripe customer for a business.
 */
export async function getOrCreateCustomer(
  businessId: number,
  email?: string
): Promise<Stripe.Customer> {
  const stripe = getStripe();

  // First, try to find existing customer by business ID in metadata
  const customers = await stripe.customers.list({
    limit: 100,
  });

  const existingCustomer = customers.data.find(
    (customer) => customer.metadata?.businessId === String(businessId)
  );

  if (existingCustomer) {
    return existingCustomer;
  }

  // Create new customer if not found
  return await stripe.customers.create({
    email,
    metadata: {
      businessId: String(businessId),
    },
  });
}

/**
 * Handle subscription webhook events.
 */
export async function handleSubscriptionWebhook(
  event: Stripe.Event
): Promise<void> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await handleSubscriptionChange(event.data.object as Stripe.Subscription);
      break;
    case "invoice.payment_succeeded":
      await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;
  }
}

async function handleSubscriptionChange(
  subscription: Stripe.Subscription
): Promise<void> {
  const businessId = Number(subscription.metadata?.businessId);
  if (!businessId) {
    throw new Error("No business ID in subscription metadata");
  }

  const biz = storage.forBusiness(businessId);

  try {
    // Update business plan based on subscription status
    const plan = subscription.status === "active" ? "starter" : "trial";

    await biz.updateBusinessPlan(
      plan,
      subscription.customer as string,
      subscription.id
    );

    // Record the subscription event
    await biz.recordSubscriptionEvent(
      `subscription_${subscription.status}`,
      subscription.id,
      {
        status: subscription.status,
        planName: subscription.metadata?.planName,
        billingCycle: subscription.metadata?.billingCycle,
      }
    );

    logInfo("Subscription updated", {
      businessId,
      subscriptionId: subscription.id,
      status: subscription.status,
      plan,
    });
  } catch (err) {
    logError("Failed to update business subscription", err);
    throw err;
  }
}

async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice
): Promise<void> {
  // Handle successful payment
  logInfo("Payment succeeded", {
    invoiceId: invoice.id,
    amount: invoice.amount_paid,
  });
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  // Handle failed payment
  logError("Payment failed", {
    invoiceId: invoice.id,
    amount: invoice.amount_due,
  });
}
