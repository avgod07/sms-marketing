import type { Express, Request } from "express";
import { z } from "zod";
import { requireAuth } from "@clerk/express";
import {
  simpleCampaignSchema,
  getBizForRequest,
  logDetailedError,
} from "./utils";
import { logError } from "../../utils/logger.util";
import {
  executeCampaign,
  InsufficientCreditsError,
} from "../../services/campaign.js";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomBytes } from "crypto";
import { TwilioService } from "../../services/twilio.js";
import { MessageCreditService } from "../../services/message-credits.js";
import { requireTFVVerification } from "../../middlewares/tfv-verification.middleware";
import { requireActiveSubscription } from "../../middlewares/subscription-verification.middleware";
import {
  CampaignSendSummary,
  CampaignScheduleRequest,
  CampaignScheduleResponse,
} from "@shared/api-types";
import { CampaignSchedulingService } from "../../services/campaign-scheduling.js";
import { QuietHoursCompliance } from "../../services/quiet-hours-compliance.js";
import { UniversalMessageService } from "../../services/universal-message.js";

const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) => {
    if (!file.mimetype.match(/^image\/(jpeg|png|gif)$/)) {
      return cb(new Error("Only JPG, PNG, and GIF images are allowed"));
    }
    cb(null, true);
  },
});

const s3 = new S3Client({
  region: process.env.AWS_S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME!;
const S3_PUBLIC_URL_BASE =
  process.env.AWS_S3_PUBLIC_URL_BASE || `https://${S3_BUCKET}.s3.amazonaws.com`;

export function registerCampaignRoutes(app: Express) {
  app.get("/api/campaigns", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const campaigns = await biz.getCampaigns();
      res.json(campaigns);
    } catch (error) {
      logDetailedError("Error fetching campaigns", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.get("/api/campaigns/stats", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const stats = await biz.getCampaignStats();
      res.json(stats);
    } catch (error) {
      logError("Error fetching campaign stats:", error);
      res.status(500).json({ message: "Failed to fetch campaign stats" });
    }
  });

  app.get("/api/campaigns/recent", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 3;
      const campaigns = await biz.getRecentCampaigns(limit);
      res.json(campaigns);
    } catch (error) {
      logDetailedError("Error fetching recent campaigns", error);
      res.status(500).json({ message: "Failed to fetch recent campaigns" });
    }
  });

  app.get("/api/campaigns/:id", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const id = parseInt(req.params.id);
      const campaign = await biz.getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      logError("Error fetching campaign:", error);
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });

  app.post(
    "/api/campaigns",
    requireAuth(),
    requireTFVVerification,
    requireActiveSubscription,
    async (req, res) => {
      try {
        const { biz } = await getBizForRequest(req);

        // TCPA COMPLIANCE: Block immediate campaign creation outside business hours
        const business = await biz.getBusiness();
        if (
          !QuietHoursCompliance.canSendImmediately(
            business.timezone,
            "campaign"
          )
        ) {
          const nextSendTime = QuietHoursCompliance.getNextSendTime(
            business.timezone
          );
          const currentBusinessTime = new Date().toLocaleString("en-US", {
            timeZone: business.timezone,
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZoneName: "short",
          });
          const nextAvailable = nextSendTime.toLocaleString("en-US", {
            timeZone: business.timezone,
            weekday: "short",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });

          return res.status(400).json({
            message:
              "Immediate campaigns are only available during business hours (8:00 AM - 8:00 PM).",
            businessHours: "8:00 AM - 8:00 PM",
            currentBusinessTime,
            nextAvailable,
            businessTimezone: business.timezone,
          });
        }

        // Check if user has sufficient credits for campaign
        const contacts = (await biz.getContacts()).filter((c) => c.active);
        if (contacts.length === 0) {
          return res.status(400).json({
            message:
              "No active contacts found. Please add contacts before creating a campaign.",
          });
        }

        const validatedData = simpleCampaignSchema.parse(req.body);
        const creditCost = MessageCreditService.calculateCreditCost(
          validatedData.message,
          !!validatedData.mediaUrl
        );
        const totalCreditsNeeded = contacts.length * creditCost;

        const credits = await biz.getCredits();
        const balance = credits?.balance || 0;

        if (balance < totalCreditsNeeded) {
          const messageType = validatedData.mediaUrl
            ? "MMS"
            : creditCost > 1
            ? `${creditCost} SMS segments`
            : "SMS";
          return res.status(400).json({
            message: `Insufficient credits. Need ${totalCreditsNeeded} credit${
              totalCreditsNeeded > 1 ? "s" : ""
            } for ${contacts.length} contact${
              contacts.length > 1 ? "s" : ""
            } (${messageType} costs ${creditCost} credit${
              creditCost > 1 ? "s" : ""
            } each).`,
          });
        }

        const campaign = await biz.createCampaign({
          name: validatedData.name,
          message: validatedData.message,
          mediaUrl: validatedData.mediaUrl,
        });

        const results = await executeCampaign(biz, campaign.id);

        // Map execution result to API response format
        const response: CampaignSendSummary & { campaign: any } = {
          campaign,
          sentCount: results.totalProcessed, // Total successfully processed (for compatibility)
          failedCount: results.failedCount,
          totalContacts: results.totalContacts,
          queuedCount: results.queuedCount,
          hasQueuedMessages: results.hasQueuedMessages,
          nextSendTime: results.nextSendTime?.toISOString(),
          queueInfo: results.hasQueuedMessages
            ? {
                scheduledFor: results.nextSendTime?.toISOString() || "",
                businessTimezone: (await biz.getBusiness()).timezone,
                businessHours: "8 AM - 8 PM",
              }
            : undefined,
        };

        res.status(201).json(response);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Validation error", errors: error.errors });
        }
        if (error instanceof InsufficientCreditsError) {
          return res
            .status(400)
            .json({ message: "Insufficient credits to send campaign" });
        }
        logError("Error creating campaign:", error);
        res.status(500).json({ message: "Failed to create campaign" });
      }
    }
  );

  /**
   * Create a new scheduled campaign (without executing immediately)
   */
  app.post(
    "/api/campaigns/scheduled",
    requireAuth(),
    requireTFVVerification,
    requireActiveSubscription,
    async (req, res) => {
      try {
        const { biz, user } = await getBizForRequest(req);

        const scheduleRequestSchema = z.object({
          name: z.string().min(1, "Campaign name is required"),
          message: z.string().min(1, "Message is required"),
          mediaUrl: z.string().optional(),
          scheduledSendTime: z
            .string()
            .refine((val) => !isNaN(Date.parse(val)), {
              message: "Invalid date format",
            }),
          scheduleNotes: z.string().optional(),
        });

        const validatedData = scheduleRequestSchema.parse(req.body);
        const scheduledDate = new Date(validatedData.scheduledSendTime);

        const result = await CampaignSchedulingService.createScheduledCampaign(
          biz,
          {
            name: validatedData.name,
            message: validatedData.message,
            mediaUrl: validatedData.mediaUrl,
          },
          {
            scheduledSendTime: scheduledDate,
            scheduledBy: user.clerkId || undefined,
            scheduleNotes: validatedData.scheduleNotes,
          }
        );

        if (!result.success) {
          return res.status(400).json({
            message: result.errors?.[0] || "Failed to schedule campaign",
            errors: result.errors,
            warnings: result.warnings,
          });
        }

        const business = await biz.getBusiness();
        const response: CampaignScheduleResponse = {
          campaign: result.campaign,
          scheduledFor: result.scheduledFor!.toISOString(),
          businessTimezone: business.timezone,
          businessHours: "8 AM - 8 PM",
        };

        res.status(201).json(response);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            message: "Validation error",
            errors: error.errors.map((e) => e.message),
          });
        }
        logError("Error creating scheduled campaign:", error);
        res
          .status(500)
          .json({ message: "Failed to create scheduled campaign" });
      }
    }
  );

  app.patch("/api/campaigns/:id", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const id = parseInt(req.params.id);
      const existing = await biz.getCampaign(id);
      if (!existing) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      if (existing.status === "completed") {
        return res
          .status(400)
          .json({ message: "Completed campaigns cannot be edited" });
      }
      const validatedData = simpleCampaignSchema.partial().parse(req.body);
      const campaign = await biz.updateCampaign(id, validatedData);
      res.json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Validation error", errors: error.errors });
      }
      logError("Error updating campaign:", error);
      res.status(500).json({ message: "Failed to update campaign" });
    }
  });

  app.delete("/api/campaigns/:id", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const id = parseInt(req.params.id);
      await biz.deleteCampaign(id);
      res.status(204).send();
    } catch (error) {
      logError("Error deleting campaign:", error);
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });

  app.post(
    "/api/campaigns/:id/send",
    requireAuth(),
    requireTFVVerification,
    requireActiveSubscription,
    async (req, res) => {
      try {
        const { biz } = await getBizForRequest(req);

        const id = parseInt(req.params.id);
        const campaign = await biz.getCampaign(id);

        if (!campaign) {
          return res.status(404).json({ message: "Campaign not found" });
        }

        // Check if user has sufficient credits for campaign
        const contacts = (await biz.getContacts()).filter((c) => c.active);
        if (contacts.length === 0) {
          return res.status(400).json({
            message:
              "No active contacts found. Please add contacts before sending a campaign.",
          });
        }

        const creditCost = MessageCreditService.calculateCreditCost(
          campaign.message,
          !!campaign.mediaUrl
        );
        const totalCreditsNeeded = contacts.length * creditCost;

        const credits = await biz.getCredits();
        const balance = credits?.balance || 0;

        if (balance < totalCreditsNeeded) {
          const messageType = campaign.mediaUrl
            ? "MMS"
            : creditCost > 1
            ? `${creditCost} SMS segments`
            : "SMS";
          return res.status(400).json({
            message: `Insufficient credits. Need ${totalCreditsNeeded} credit${
              totalCreditsNeeded > 1 ? "s" : ""
            } for ${contacts.length} contact${
              contacts.length > 1 ? "s" : ""
            } (${messageType} costs ${creditCost} credit${
              creditCost > 1 ? "s" : ""
            } each).`,
          });
        }

        const results = await executeCampaign(biz, id);

        // Map execution result to API response format
        const response: CampaignSendSummary = {
          sentCount: results.totalProcessed, // Total successfully processed (for compatibility)
          failedCount: results.failedCount,
          totalContacts: results.totalContacts,
          queuedCount: results.queuedCount,
          hasQueuedMessages: results.hasQueuedMessages,
          nextSendTime: results.nextSendTime?.toISOString(),
          queueInfo: results.hasQueuedMessages
            ? {
                scheduledFor: results.nextSendTime?.toISOString() || "",
                businessTimezone: (await biz.getBusiness()).timezone,
                businessHours: "8 AM - 8 PM",
              }
            : undefined,
        };

        res.json({
          message: results.hasQueuedMessages
            ? "Campaign scheduled for business hours"
            : "Campaign sent successfully",
          ...response,
        });
      } catch (error) {
        if (error instanceof InsufficientCreditsError) {
          return res
            .status(400)
            .json({ message: "Insufficient credits to send campaign" });
        }
        logError("Error sending campaign:", error);
        res.status(500).json({ message: "Failed to send campaign" });
      }
    }
  );

  // Test campaign message endpoint - sends test message without creating campaign record
  app.post(
    "/api/campaigns/test",
    requireAuth(),
    requireTFVVerification,
    requireActiveSubscription,
    async (req, res) => {
      try {
        const { biz, user } = await getBizForRequest(req);
        const { message, mediaUrl, phoneNumber } = z
          .object({
            message: z
              .string()
              .trim()
              .min(1, "Message cannot be empty")
              .max(1600, "Message must be 1600 characters or less"),
            mediaUrl: z.string().url().optional().or(z.literal("")).optional(),
            phoneNumber: z.string().min(1, "Phone number is required"),
          })
          .parse(req.body);

        // Send test message using UniversalMessageService with TCPA compliance and subaccount support
        const result = await UniversalMessageService.sendMessage(biz, {
          businessId: (await biz.getBusiness()).id,
          phoneNumber: phoneNumber,
          messageContent: message,
          messageType: "test",
          mediaUrl: mediaUrl || undefined,
        });

        if (result.status === "sent") {
          // For test messages, we need to extract credit information from the message record
          // Since UniversalMessageService doesn't return credit details directly
          const credits = await biz.getCredits();
          const creditCost = MessageCreditService.calculateCreditCost(
            message,
            !!mediaUrl
          );

          res.status(200).json({
            success: true,
            message: "Test message sent successfully",
            creditCost: creditCost,
            remainingCredits: credits?.balance || 0,
            messageId: result.messageId,
          });
        } else if (result.status === "queued") {
          // Test message was queued due to quiet hours
          const credits = await biz.getCredits();
          const creditCost = MessageCreditService.calculateCreditCost(
            message,
            !!mediaUrl
          );

          res.status(200).json({
            success: true,
            message: "Test message queued for business hours compliance",
            creditCost: creditCost,
            remainingCredits: credits?.balance || 0,
            messageId: result.messageId,
            scheduledFor: result.scheduledFor,
            queueId: result.queueId,
          });
        } else {
          res.status(400).json({
            success: false,
            error: "Failed to send test message",
          });
        }
      } catch (error) {
        if (error instanceof InsufficientCreditsError) {
          return res.status(402).json({
            success: false,
            error: error.message,
            code: "INSUFFICIENT_CREDITS",
          });
        }
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Validation error", errors: error.errors });
        }
        logError("Error sending test campaign message:", error);
        res.status(500).json({ message: "Failed to send test message" });
      }
    }
  );

  app.post(
    "/api/campaigns/upload-image",
    requireAuth(),
    upload.single("image"),
    async (req: Request & { file?: Express.Multer.File }, res) => {
      try {
        const file = req.file as Express.Multer.File | undefined;
        if (!file) {
          return res.status(400).json({ message: "No file uploaded" });
        }
        const ext = file.originalname.split(".").pop();
        const key = `campaign-images/${randomBytes(16).toString("hex")}.${ext}`;
        await s3.send(
          new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
          })
        );
        const url = `${S3_PUBLIC_URL_BASE}/${key}`;
        res.json({ url });
      } catch (error: any) {
        res
          .status(500)
          .json({ message: error.message || "Failed to upload image" });
      }
    }
  );

  // ================================
  // CAMPAIGN SCHEDULING ENDPOINTS
  // ================================

  /**
   * Schedule a campaign for future delivery
   */
  app.post(
    "/api/campaigns/:id/schedule",
    requireAuth(),
    requireTFVVerification,
    requireActiveSubscription,
    async (req, res) => {
      try {
        const { biz, user } = await getBizForRequest(req);
        const campaignId = parseInt(req.params.id);

        const scheduleRequestSchema = z.object({
          scheduledSendTime: z
            .string()
            .refine((val) => !isNaN(Date.parse(val)), {
              message: "Invalid date format",
            }),
          scheduleNotes: z.string().optional(),
        });

        const { scheduledSendTime, scheduleNotes } =
          scheduleRequestSchema.parse(req.body);
        const scheduledDate = new Date(scheduledSendTime);

        const result = await CampaignSchedulingService.scheduleCampaign(
          biz,
          campaignId,
          {
            scheduledSendTime: scheduledDate,
            scheduledBy: user.clerkId || undefined,
            scheduleNotes,
          }
        );

        if (!result.success) {
          return res.status(400).json({
            message: result.errors?.[0] || "Failed to schedule campaign",
            errors: result.errors,
            warnings: result.warnings,
          });
        }

        const business = await biz.getBusiness();
        const response: CampaignScheduleResponse = {
          campaign: result.campaign,
          scheduledFor: result.scheduledFor!.toISOString(),
          businessTimezone: business.timezone,
          businessHours: "8 AM - 8 PM",
        };

        res.status(200).json(response);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            message: "Validation error",
            errors: error.errors.map((e) => e.message),
          });
        }
        logError("Error scheduling campaign:", error);
        res.status(500).json({ message: "Failed to schedule campaign" });
      }
    }
  );

  /**
   * Reschedule an existing scheduled campaign
   */
  app.put(
    "/api/campaigns/:id/schedule",
    requireAuth(),
    requireTFVVerification,
    async (req, res) => {
      try {
        const { biz, user } = await getBizForRequest(req);
        const campaignId = parseInt(req.params.id);

        const rescheduleRequestSchema = z.object({
          scheduledSendTime: z
            .string()
            .refine((val) => !isNaN(Date.parse(val)), {
              message: "Invalid date format",
            }),
          scheduleNotes: z.string().optional(),
        });

        const { scheduledSendTime, scheduleNotes } =
          rescheduleRequestSchema.parse(req.body);
        const newScheduledDate = new Date(scheduledSendTime);

        const result = await CampaignSchedulingService.rescheduleCampaign(
          biz,
          campaignId,
          newScheduledDate,
          user.clerkId || undefined,
          scheduleNotes
        );

        if (!result.success) {
          return res.status(400).json({
            message: result.errors?.[0] || "Failed to reschedule campaign",
            errors: result.errors,
            warnings: result.warnings,
          });
        }

        const business = await biz.getBusiness();
        const response: CampaignScheduleResponse = {
          campaign: result.campaign,
          scheduledFor: result.scheduledFor!.toISOString(),
          businessTimezone: business.timezone,
          businessHours: "8 AM - 8 PM",
        };

        res.status(200).json(response);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            message: "Validation error",
            errors: error.errors.map((e) => e.message),
          });
        }
        logError("Error rescheduling campaign:", error);
        res.status(500).json({ message: "Failed to reschedule campaign" });
      }
    }
  );

  /**
   * Cancel a scheduled campaign
   */
  app.delete("/api/campaigns/:id/schedule", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const campaignId = parseInt(req.params.id);

      const result = await CampaignSchedulingService.cancelScheduledCampaign(
        biz,
        campaignId
      );

      if (!result.success) {
        return res.status(400).json({
          message: result.errors?.[0] || "Failed to cancel scheduled campaign",
          errors: result.errors,
        });
      }

      res.status(200).json({
        message: "Campaign scheduling cancelled successfully",
        campaign: result.campaign,
      });
    } catch (error) {
      logError("Error cancelling scheduled campaign:", error);
      res.status(500).json({ message: "Failed to cancel scheduled campaign" });
    }
  });

  /**
   * Validate scheduling time for a campaign
   */
  app.post(
    "/api/campaigns/validate-schedule",
    requireAuth(),
    requireTFVVerification,
    requireActiveSubscription,
    async (req, res) => {
      try {
        const validateRequestSchema = z.object({
          scheduledSendTime: z
            .string()
            .refine((val) => !isNaN(Date.parse(val)), {
              message: "Invalid date format",
            }),
        });

        const { scheduledSendTime } = validateRequestSchema.parse(req.body);
        const scheduledDate = new Date(scheduledSendTime);
        const { biz } = await getBizForRequest(req);
        const business = await biz.getBusiness();

        const validation = CampaignSchedulingService.validateScheduleTime(
          scheduledDate,
          business.timezone
        );

        res.json(validation);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            message: "Validation error",
            errors: error.errors.map((e) => e.message),
          });
        }
        logError("Error validating schedule time:", error);
        res.status(500).json({ message: "Failed to validate schedule time" });
      }
    }
  );
}
