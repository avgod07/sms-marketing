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

  // Get Price ID based on billing cycle
  const priceId =
    billingCycle === "yearly"
      ? process.env.STRIPE_SUBSCRIPTION_YEARLY_PRICE_ID
      : process.env.STRIPE_SUBSCRIPTION_MONTHLY_PRICE_ID;

  if (!priceId) {
    throw new Error(
      `Missing Stripe Price ID for ${billingCycle} billing cycle. Please set STRIPE_SUBSCRIPTION_${billingCycle.toUpperCase()}_PRICE_ID environment variable.`
    );
  }

  // Create checkout session with Price ID
  return await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      businessId: String(businessId),
      planName,
      billingCycle,
    },
    subscription_data: {
      metadata: {
        businessId: String(businessId),
        planName,
        billingCycle,
      },
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
  const currentBusiness = await biz.getBusiness();

  try {
    // Determine new plan based on subscription status
    // Initialize to current plan - will be overwritten if we need to change
    let newPlan: string = currentBusiness.plan;
    let trialVoidedAt: Date | undefined;
    let shouldUpdatePlan = true;

    // Log the incoming webhook for debugging
    logInfo("Processing subscription webhook", {
      businessId,
      subscriptionId: subscription.id,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      cancelAt: subscription.cancel_at,
      currentPlan: currentBusiness.plan,
    });

    switch (subscription.status) {
      case "active":
        // Subscription is active and being billed
        newPlan = "starter";
        // If upgrading from free trial, void it permanently
        if (currentBusiness.plan === "free_trial" && !currentBusiness.trialUsed) {
          trialVoidedAt = new Date();
        }
        break;

      case "canceled":
        // Subscription has been fully canceled (period ended or immediate cancel)
        // This is the final state - mark as cancelled
        newPlan = "cancelled";
        break;

      case "past_due":
      case "unpaid":
        // Payment failed - don't immediately cancel, give them a chance to fix it
        // Keep current plan but log the issue
        logInfo("Subscription payment issue", {
          businessId,
          subscriptionId: subscription.id,
          status: subscription.status,
        });
        shouldUpdatePlan = false;
        break;

      case "incomplete":
      case "incomplete_expired":
        // Initial payment failed - mark as cancelled
        newPlan = "cancelled";
        break;

      case "trialing":
        // In Stripe trial (if using Stripe's trial feature)
        newPlan = "starter";
        break;

      case "paused":
        // Subscription paused - keep plan but log
        logInfo("Subscription paused", {
          businessId,
          subscriptionId: subscription.id,
        });
        shouldUpdatePlan = false;
        break;

      default:
        // Unknown status - log and don't change
        logInfo("Unknown subscription status", {
          businessId,
          subscriptionId: subscription.id,
          status: subscription.status,
        });
        shouldUpdatePlan = false;
        break;
    }

    if (shouldUpdatePlan) {
      await biz.updateBusinessPlan(
        newPlan,
        subscription.customer as string,
        subscription.id,
        trialVoidedAt
      );
    }

    // Record the subscription event with detailed info
    await biz.recordSubscriptionEvent(
      `subscription_${subscription.status}`,
      subscription.id,
      {
        status: subscription.status,
        planName: subscription.metadata?.planName,
        billingCycle: subscription.metadata?.billingCycle,
        trialVoided: !!trialVoidedAt,
        previousPlan: currentBusiness.plan,
        newPlan: shouldUpdatePlan ? newPlan : currentBusiness.plan,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        cancelAt: subscription.cancel_at 
          ? new Date(subscription.cancel_at * 1000).toISOString() 
          : null,
      }
    );

    logInfo("Subscription webhook processed", {
      businessId,
      subscriptionId: subscription.id,
      status: subscription.status,
      planUpdated: shouldUpdatePlan,
      newPlan: shouldUpdatePlan ? newPlan : currentBusiness.plan,
      previousPlan: currentBusiness.plan,
      trialVoided: !!trialVoidedAt,
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
