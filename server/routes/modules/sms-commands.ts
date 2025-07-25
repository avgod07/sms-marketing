import type { Express } from "express";
import { requireAuth } from "@clerk/express";
import { z } from "zod";
import { SMSCommandAuth } from "../../services/sms-command-auth.js";
import { SMSCommandRateLimiter } from "../../services/sms-command-rate-limiter.js";
import { getBizForRequest } from "./utils.js";
import { logError, logInfo } from "../../utils/logger.util.js";
import { requireTFVVerification } from "../../middlewares/tfv-verification.middleware.js";

const addSenderSchema = z.object({
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
});

export function registerSMSCommandRoutes(app: Express) {
  // Get authorized senders for business
  app.get(
    "/api/sms-commands/senders",
    requireAuth(),
    requireTFVVerification,
    async (req, res) => {
      try {
        const { biz, user } = await getBizForRequest(req);
        const business = await biz.getBusiness();

        const senders = await SMSCommandAuth.getAuthorizedSenders(business.id);

        logInfo("Retrieved SMS command senders", {
          businessId: business.id,
          sendersCount: senders.length,
          userId: user.id,
        });

        res.json(senders);
      } catch (error) {
        logError("Error fetching SMS command senders:", error);
        res.status(500).json({ message: "Failed to fetch authorized senders" });
      }
    }
  );

  // Add authorized sender
  app.post(
    "/api/sms-commands/senders",
    requireAuth(),
    requireTFVVerification,
    async (req, res) => {
      try {
        const { biz, user } = await getBizForRequest(req);
        const business = await biz.getBusiness();

        const { phoneNumber } = addSenderSchema.parse(req.body);

        const sender = await SMSCommandAuth.addAuthorizedSender(
          business.id,
          phoneNumber,
          user.id
        );

        logInfo("Added SMS command sender", {
          businessId: business.id,
          phoneNumber: sender.phoneNumber,
          addedByUserId: user.id,
          senderId: sender.id,
        });

        res.status(201).json(sender);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            message: "Invalid input",
            errors: error.errors,
          });
        }

        if (
          error instanceof Error &&
          error.message === "Phone number is already authorized"
        ) {
          return res.status(409).json({
            message: "This phone number is already authorized for SMS commands",
          });
        }

        logError("Error adding SMS command sender:", error);
        res.status(500).json({ message: "Failed to add authorized sender" });
      }
    }
  );

  // Remove authorized sender by phone number
  app.delete(
    "/api/sms-commands/senders/:phoneNumber",
    requireAuth(),
    requireTFVVerification,
    async (req, res) => {
      try {
        const { biz, user } = await getBizForRequest(req);
        const business = await biz.getBusiness();
        const { phoneNumber } = req.params;

        await SMSCommandAuth.removeAuthorizedSender(business.id, phoneNumber);

        logInfo("Removed SMS command sender", {
          businessId: business.id,
          phoneNumber,
          removedByUserId: user.id,
        });

        res.json({ success: true });
      } catch (error) {
        logError("Error removing SMS command sender:", error);
        res.status(500).json({ message: "Failed to remove authorized sender" });
      }
    }
  );

  // Remove authorized sender by ID
  app.delete(
    "/api/sms-commands/senders/:id",
    requireAuth(),
    requireTFVVerification,
    async (req, res) => {
      try {
        const { biz, user } = await getBizForRequest(req);
        const business = await biz.getBusiness();
        const senderId = parseInt(req.params.id);

        if (isNaN(senderId)) {
          return res.status(400).json({ message: "Invalid sender ID" });
        }

        await SMSCommandAuth.removeAuthorizedSenderById(business.id, senderId);

        logInfo("Removed SMS command sender by ID", {
          businessId: business.id,
          senderId,
          removedByUserId: user.id,
        });

        res.json({ success: true });
      } catch (error) {
        logError("Error removing SMS command sender by ID:", error);
        res.status(500).json({ message: "Failed to remove authorized sender" });
      }
    }
  );

  // Get rate limit status for business
  app.get(
    "/api/sms-commands/rate-limit-status",
    requireAuth(),
    requireTFVVerification,
    async (req, res) => {
      try {
        const { biz } = await getBizForRequest(req);
        const business = await biz.getBusiness();

        const status = await SMSCommandRateLimiter.getRateLimitStatus(
          business.id
        );

        res.json(status);
      } catch (error) {
        logError("Error fetching rate limit status:", error);
        res.status(500).json({ message: "Failed to fetch rate limit status" });
      }
    }
  );

  // Get SMS command feature status/info
  app.get("/api/sms-commands/info", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const business = await biz.getBusiness();

      // Get TFV verification status
      const tfvStatus = await biz.getTFVVerificationStatus();

      const senders = await SMSCommandAuth.getAuthorizedSenders(business.id);
      const rateLimitStatus = await SMSCommandRateLimiter.getRateLimitStatus(
        business.id
      );

      const phoneNumbers = await biz.getPhoneNumbers();
      const businessPhone = phoneNumbers.find((p) => p.isDefault)?.phoneNumber;

      res.json({
        isEnabled: senders.length > 0 && tfvStatus.isVerified,
        authorizedSendersCount: senders.length,
        businessPhoneNumber: businessPhone,
        rateLimitStatus,
        tfvStatus: {
          isVerified: tfvStatus.isVerified,
          status: tfvStatus.status,
          hasPhoneNumbers: tfvStatus.hasPhoneNumbers,
        },
        rateLimit: {
          intervalHours: SMSCommandRateLimiter.RATE_LIMIT_HOURS,
          description: "1 command per hour",
        },
        usage: {
          description: "Send 'SEND: your message' to your business number",
          example:
            "SEND: Flash sale today! 50% off everything. Reply STOP to opt out.",
        },
      });
    } catch (error) {
      logError("Error fetching SMS command info:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch SMS command information" });
    }
  });
}
