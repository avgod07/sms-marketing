import type { Request, Response, NextFunction } from "express";
import { getBizForRequest } from "../routes/modules/utils";
import { logInfo, logError } from "../utils/logger.util";

export interface TFVVerificationRequest extends Request {
  tfvStatus?: {
    isVerified: boolean;
    status: string;
    hasPhoneNumbers: boolean;
    pendingTFVs: Array<{ tfvSid: string; phoneNumber: string }>;
  };
}

/**
 * Middleware to check TFV verification status before allowing message sending
 * This enforces Twilio's new requirement that toll-free numbers must be verified
 */
export async function requireTFVVerification(
  req: TFVVerificationRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { biz } = await getBizForRequest(req);

    // Get TFV verification status for this business
    const tfvStatus = await biz.getTFVVerificationStatus();

    // Attach status to request for debugging/logging
    req.tfvStatus = tfvStatus;

    // Log TFV check for compliance tracking
    logInfo("TFV verification check", {
      businessId: (await biz.getBusiness()).id,
      isVerified: tfvStatus.isVerified,
      status: tfvStatus.status,
      hasPhoneNumbers: tfvStatus.hasPhoneNumbers,
    });

    // Check if business has verified phone numbers
    if (!tfvStatus.hasPhoneNumbers) {
      return res.status(403).json({
        message:
          "Phone number required for messaging. Please complete onboarding and purchase a toll-free number.",
        code: "NO_PHONE_NUMBERS",
        tfvStatus: {
          status: tfvStatus.status,
          hasPhoneNumbers: false,
        },
      });
    }

    if (!tfvStatus.isVerified) {
      // Determine appropriate error message based on status
      let message = "Toll-free verification required for messaging.";
      let guidance = "";

      switch (tfvStatus.status) {
        case "not_submitted":
          message =
            "Toll-free verification not submitted. Please complete your business verification.";
          guidance =
            "Complete your business information and submit verification.";
          break;
        case "pending":
          message =
            "Toll-free verification is pending approval. Messaging is restricted until verification is complete.";
          guidance =
            "Verification typically takes 2-5 business days. You'll be notified when approved.";
          break;
        case "denied":
          message =
            "Toll-free verification was denied. Please contact support to resolve verification issues.";
          guidance =
            "Contact support at support@yourapp.com for assistance with verification.";
          break;
        default:
          guidance = "Please ensure your business verification is complete.";
      }

      return res.status(403).json({
        message,
        guidance,
        code: "TFV_NOT_VERIFIED",
        tfvStatus: {
          status: tfvStatus.status,
          hasPhoneNumbers: tfvStatus.hasPhoneNumbers,
          pendingTFVs: tfvStatus.pendingTFVs,
        },
      });
    }

    // TFV is verified, allow the request to proceed
    next();
  } catch (error) {
    logError("TFV verification middleware error:", error);

    // On error, fail safely by blocking the request
    return res.status(500).json({
      message: "Unable to verify messaging permissions. Please try again.",
      code: "TFV_CHECK_FAILED",
    });
  }
}

/**
 * Optional middleware that checks TFV status but doesn't block requests
 * Useful for adding TFV status to responses without enforcement
 */
export async function checkTFVStatus(
  req: TFVVerificationRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { biz } = await getBizForRequest(req);
    const tfvStatus = await biz.getTFVVerificationStatus();
    req.tfvStatus = tfvStatus;
    next();
  } catch (error) {
    // Don't block request on error, just log and continue
    logError("TFV status check error:", error);
    next();
  }
}
