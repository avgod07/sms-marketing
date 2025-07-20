import type { Request, Response, NextFunction } from "express";
import { getBizForRequest } from "../routes/modules/utils";
import { logInfo, logError } from "../utils/logger.util";

/**
 * Middleware to check if business has an active subscription before allowing message sending
 * This prevents the subscription bypass issue where users could cancel subscription
 * but still use purchased credits
 */
export async function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { biz } = await getBizForRequest(req);
    const business = await biz.getBusiness();

    // Log subscription check for monitoring
    logInfo("Subscription verification check", {
      businessId: business.id,
      businessName: business.name,
      currentPlan: business.plan,
      trialUsed: business.trialUsed,
      endpoint: req.path,
    });

    // Allow if user has active subscription
    if (business.plan === "starter") {
      return next();
    }

    // Allow if user is on free trial and hasn't used it yet
    if (business.plan === "free_trial" && !business.trialUsed) {
      return next();
    }

    // Block if user is cancelled or trial is voided
    let message = "Active subscription required for messaging.";
    let guidance = "Please upgrade to continue sending messages.";

    if (business.plan === "cancelled") {
      message =
        "Your subscription has been cancelled. Please reactivate to continue messaging.";
      guidance = "Upgrade to a paid plan to resume sending messages.";
    } else if (business.plan === "free_trial" && business.trialUsed) {
      message =
        "Your free trial has ended. Please upgrade to continue messaging.";
      guidance =
        "Upgrade to a paid plan to continue sending unlimited messages.";
    }

    return res.status(403).json({
      message,
      guidance,
      code: "SUBSCRIPTION_REQUIRED",
      currentPlan: business.plan,
      trialUsed: business.trialUsed,
      upgradeUrl: "/pricing", // Frontend can use this to redirect
    });
  } catch (error) {
    logError("Subscription verification middleware error:", error);

    // On error, fail safely by blocking the request
    return res.status(500).json({
      message: "Unable to verify subscription. Please try again.",
      code: "SUBSCRIPTION_CHECK_FAILED",
    });
  }
}

/**
 * Middleware for public endpoints (like join forms) that need subscription verification
 * but don't have user authentication context
 */
export async function requirePublicSubscriptionVerification(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { businessId } = req.params;

    if (!businessId || isNaN(parseInt(businessId))) {
      return res.status(400).json({
        message: "Invalid business ID",
        code: "INVALID_BUSINESS_ID",
      });
    }

    // Import storage here to avoid circular dependency
    const { storage } = await import("../db/storage");
    const biz = storage.forBusiness(parseInt(businessId));

    // Check if business exists
    let business;
    try {
      business = await biz.getBusiness();
    } catch (error) {
      return res.status(404).json({
        message: "Business not found",
        code: "BUSINESS_NOT_FOUND",
      });
    }

    // Log public subscription check
    logInfo("Public subscription verification check", {
      businessId: parseInt(businessId),
      businessName: business.name,
      currentPlan: business.plan,
      trialUsed: business.trialUsed,
      endpoint: req.path,
    });

    // Allow if business has active subscription
    if (business.plan === "starter") {
      return next();
    }

    // Allow if business is on free trial and hasn't used it yet
    if (business.plan === "free_trial" && !business.trialUsed) {
      return next();
    }

    // Block if subscription required
    return res.status(503).json({
      message: "This signup form is temporarily unavailable.",
      code: "SUBSCRIPTION_REQUIRED",
      guidance:
        "The business needs to activate their subscription to accept new signups.",
    });
  } catch (error) {
    logError("Public subscription verification error:", error);
    return res.status(500).json({
      message: "Service temporarily unavailable.",
      code: "SUBSCRIPTION_CHECK_FAILED",
    });
  }
}

/**
 * Helper function to check subscription status without middleware overhead
 * Useful for conditional logic within routes
 */
export async function checkSubscriptionStatus(biz: any): Promise<{
  allowed: boolean;
  reason?: string;
  plan: string;
  trialUsed: boolean;
}> {
  try {
    const business = await biz.getBusiness();

    // Active subscription
    if (business.plan === "starter") {
      return {
        allowed: true,
        plan: business.plan,
        trialUsed: business.trialUsed,
      };
    }

    // Free trial not yet used
    if (business.plan === "free_trial" && !business.trialUsed) {
      return {
        allowed: true,
        plan: business.plan,
        trialUsed: business.trialUsed,
      };
    }

    // Subscription required
    return {
      allowed: false,
      reason:
        business.plan === "cancelled"
          ? "Subscription cancelled"
          : "Free trial expired",
      plan: business.plan,
      trialUsed: business.trialUsed,
    };
  } catch (error) {
    return {
      allowed: false,
      reason: "Subscription check failed",
      plan: "unknown",
      trialUsed: false,
    };
  }
}
