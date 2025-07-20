import type { Request, Response, NextFunction } from "express";
import { getBizForRequest } from "../routes/modules/utils";
import { logInfo, logError } from "../utils/logger.util";

/**
 * Middleware to check if business has required information for TFV submission
 * before allowing phone number purchases. This prevents purchases that would
 * fail TFV submission.
 */
export async function requireTFVPreCheck(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { biz } = await getBizForRequest(req);

    // Get business and onboarding progress
    const business = await biz.getBusiness();
    const onboardingProgress = await biz.getOnboardingProgress();

    // Log TFV pre-check
    logInfo("TFV pre-check for phone purchase", {
      businessId: business.id,
      businessName: business.name,
      hasOnboardingProgress: !!onboardingProgress,
    });

    // Check if business has minimum required information for TFV
    if (!onboardingProgress) {
      return res.status(400).json({
        message:
          "Business information required before purchasing toll-free numbers.",
        code: "MISSING_BUSINESS_INFO",
        guidance:
          "Please complete the business information form in onboarding.",
        required: [
          "Business name",
          "Business website",
          "Business address",
          "Contact information",
          "Use cases",
          "Expected monthly volume",
        ],
      });
    }

    // Check for required business information
    const missingFields = [];

    if (!onboardingProgress.businessName) {
      missingFields.push("Business name");
    }

    if (!onboardingProgress.websiteUrl) {
      missingFields.push("Business website URL");
    }

    if (
      !onboardingProgress.address1 ||
      !onboardingProgress.city ||
      !onboardingProgress.state ||
      !onboardingProgress.postalCode
    ) {
      missingFields.push("Complete business address");
    }

    if (!onboardingProgress.email) {
      missingFields.push("Business email");
    }

    if (
      !onboardingProgress.useCases ||
      onboardingProgress.useCases.length === 0
    ) {
      missingFields.push("Business use cases");
    }

    if (!onboardingProgress.monthlyVolume) {
      missingFields.push("Expected monthly message volume");
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        message:
          "Additional business information required for toll-free verification.",
        code: "INCOMPLETE_BUSINESS_INFO",
        guidance:
          "Complete your business profile to purchase toll-free numbers and ensure successful verification.",
        missingFields,
        details:
          "Toll-free numbers require verification with complete business information. This ensures faster approval and compliance with Twilio's requirements.",
      });
    }

    // Check if business website is valid (basic URL validation)
    if (
      onboardingProgress.websiteUrl &&
      !onboardingProgress.websiteUrl.match(/^https?:\/\/[^\s]+\.[^\s]+/)
    ) {
      return res.status(400).json({
        message:
          "Valid business website URL required for toll-free verification.",
        code: "INVALID_WEBSITE_URL",
        guidance:
          "Please provide a valid website URL (e.g., https://yourcompany.com) for verification purposes.",
      });
    }

    // All checks passed - business information is sufficient for TFV
    logInfo("TFV pre-check passed", {
      businessId: business.id,
      businessName: business.name,
      websiteUrl: onboardingProgress.websiteUrl,
      hasCompleteAddress: !!(
        onboardingProgress.address1 &&
        onboardingProgress.city &&
        onboardingProgress.state &&
        onboardingProgress.postalCode
      ),
      useCaseCount: onboardingProgress.useCases?.length || 0,
      monthlyVolume: onboardingProgress.monthlyVolume,
    });

    next();
  } catch (error) {
    logError("TFV pre-check middleware error:", error);

    // On error, fail safely by blocking the request
    return res.status(500).json({
      message:
        "Unable to verify business information for phone number purchase.",
      code: "TFV_PRECHECK_FAILED",
      guidance: "Please try again or contact support if the issue persists.",
    });
  }
}
