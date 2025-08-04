import { logError, logInfo } from "./logger.util";

/**
 * Validates that all required Stripe environment variables are present.
 * This prevents runtime errors and ensures proper configuration.
 */
export function validateStripeEnvironment(): void {
  const requiredVars = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_SUBSCRIPTION_MONTHLY_PRICE_ID",
    "STRIPE_SUBSCRIPTION_YEARLY_PRICE_ID",
    "STRIPE_CREDITS_PRICE_ID",
  ];

  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    logError("Missing required Stripe environment variables", {
      missing,
      hint: "Please configure these Price IDs in your Stripe Dashboard and add them to your environment variables",
    });
    throw new Error(
      `Missing Stripe environment variables: ${missing.join(", ")}`
    );
  }

  logInfo("Stripe environment validation passed", {
    monthlyPriceId:
      process.env.STRIPE_SUBSCRIPTION_MONTHLY_PRICE_ID?.substring(0, 15) +
      "...",
    yearlyPriceId:
      process.env.STRIPE_SUBSCRIPTION_YEARLY_PRICE_ID?.substring(0, 15) + "...",
    creditsPriceId:
      process.env.STRIPE_CREDITS_PRICE_ID?.substring(0, 15) + "...",
  });
}

/**
 * Validates general environment configuration.
 * Add other environment validations here as needed.
 */
export function validateEnvironment(): void {
  // Validate Stripe configuration
  validateStripeEnvironment();

  // Add other environment validations here as the app grows
  // e.g., validateTwilioEnvironment(), validateDatabaseEnvironment(), etc.
}
