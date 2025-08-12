import type { Request, Response, NextFunction } from "express";
import { storage } from "../db/storage";
import { logInfo, logError } from "../utils/logger.util";

/**
 * Middleware to check TFV verification status for public endpoints
 * This is for unauthenticated routes that still send messages (like join forms)
 */
export async function requirePublicTFVVerification(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    // Extract businessId from request body (public endpoints include this)
    const { businessId } = req.body;

    if (!businessId || typeof businessId !== "number") {
      return res.status(400).json({
        message: "Invalid business ID",
        code: "INVALID_BUSINESS_ID",
      });
    }

    // Get business storage and TFV status
    const biz = storage.forBusiness(businessId);

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

    // Get TFV verification status for this business
    const tfvStatus = await biz.getTFVVerificationStatus();

    // Log TFV check for compliance tracking
    logInfo("Public TFV verification check", {
      businessId,
      businessName: business.name,
      isVerified: tfvStatus.isVerified,
      status: tfvStatus.status,
      hasPhoneNumbers: tfvStatus.hasPhoneNumbers,
      endpoint: req.path,
    });

    // Check if business has verified phone numbers
    if (!tfvStatus.hasPhoneNumbers) {
      return res.status(503).json({
        message:
          "This business is not currently accepting new contacts. Please try again later.",
        code: "NO_PHONE_NUMBERS",
        guidance: "The business needs to complete phone number setup.",
      });
    }

    if (!tfvStatus.isVerified) {
      // Determine appropriate error message based on status
      let message =
        "This business is temporarily unable to accept new contacts.";
      let guidance = "Please try again later.";

      switch (tfvStatus.status) {
        case "not_submitted":
          message =
            "This business is not currently accepting new contacts. Setup is in progress.";
          guidance = "The business owner needs to complete verification setup.";
          break;
        case "PENDING_REVIEW": // ✅ CORRECT TWILIO STATUS
          message =
            "This business is temporarily unable to accept new contacts while verification is being processed.";
          guidance =
            "Verification typically takes 2-5 business days. Please check back later.";
          break;
        case "IN_REVIEW": // ✅ NEW TWILIO STATUS - ACTIVELY BEING REVIEWED
          message =
            "This business is temporarily unable to accept new contacts while verification is actively being reviewed.";
          guidance =
            "Verification typically completes within 1-3 business days. Please check back later.";
          break;
        case "TWILIO_REJECTED": // ✅ CORRECT TWILIO STATUS
          message = "This business is currently unable to accept new contacts.";
          guidance = "Please contact the business directly for assistance.";
          break;
        default:
          guidance = "Please try again later or contact the business directly.";
      }

      return res.status(503).json({
        message,
        guidance,
        code: "SERVICE_UNAVAILABLE",
        tfvStatus: {
          status: tfvStatus.status,
          hasPhoneNumbers: tfvStatus.hasPhoneNumbers,
        },
      });
    }

    // TFV is verified, allow the request to proceed
    next();
  } catch (error) {
    logError("Public TFV verification middleware error:", error);

    // On error, fail safely by blocking the request
    return res.status(503).json({
      message: "Service temporarily unavailable. Please try again later.",
      code: "SERVICE_UNAVAILABLE",
      guidance: "If this issue persists, please contact the business directly.",
    });
  }
}

/**
 * Optional middleware that checks TFV status for public endpoints but doesn't block
 * Useful for providing warnings without preventing signup
 */
export async function checkPublicTFVStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { businessId } = req.body;

    if (businessId && typeof businessId === "number") {
      const biz = storage.forBusiness(businessId);
      const tfvStatus = await biz.getTFVVerificationStatus();

      // Attach status to request for use in the route handler
      (req as any).tfvStatus = tfvStatus;

      logInfo("Public TFV status check (non-blocking)", {
        businessId,
        isVerified: tfvStatus.isVerified,
        status: tfvStatus.status,
        endpoint: req.path,
      });
    }

    next();
  } catch (error) {
    // Don't block request on error, just log and continue
    logError("Public TFV status check error:", error);
    next();
  }
}
