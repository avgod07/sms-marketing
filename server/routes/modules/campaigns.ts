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

        res.status(201).json({
          campaign,
          sentCount: results.sentCount,
          failedCount: results.failedCount,
          totalContacts: results.totalContacts,
        });
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

        res.json({
          message: "Campaign sent successfully",
          sentCount: results.sentCount,
          failedCount: results.failedCount,
          totalContacts: results.totalContacts,
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
              .min(1, "Message is required")
              .max(1600, "Message must be 1600 characters or less"),
            mediaUrl: z.string().url().optional().or(z.literal("")).optional(),
            phoneNumber: z.string().min(1, "Phone number is required"),
          })
          .parse(req.body);

        // Get messaging service SID and phone numbers
        const messagingServiceSid = await biz.getMessagingServiceSid();
        const numbers = await biz.getPhoneNumbers();
        const from = numbers.find((n) => n.isDefault)?.phoneNumber;

        if (!from || !process.env.TWILIO_ACCOUNT_SID) {
          return res.status(400).json({
            message: "Twilio not configured or no default phone number",
          });
        }

        // Create a minimal creds object for compatibility
        const tempCreds = {
          businessId: (await biz.getBusiness()).id,
          accountSid: process.env.TWILIO_ACCOUNT_SID,
          messagingServiceSid: messagingServiceSid || null,
          createdAt: new Date(),
          updatedAt: new Date(),
          id: 0,
        };

        // Use MessageCreditService for consistent send-first-then-deduct approach
        const result = await MessageCreditService.sendWithCreditDeduction(
          biz,
          tempCreds,
          {
            to: phoneNumber,
            message: message,
            from,
            messagingServiceSid: messagingServiceSid ?? undefined,
            mediaUrl: mediaUrl || undefined,
            messageType: "campaign",
          }
        );

        if (result.success) {
          // Create database record for test message to ensure credit-message alignment
          const testMessage = await biz.createMessage({
            phoneNumber: phoneNumber,
            content: message,
            status: result.success ? "sent" : "failed",
            messageType: "test", // Use 'test' messageType for test messages
            billingStatus: result.billingStatus,
            messageSid: result.messageSid,
            contactId: null, // Test messages don't need a real contact
          });

          res.status(200).json({
            success: true,
            message: "Test message sent successfully",
            creditCost: result.creditCost,
            remainingCredits: result.remainingCredits,
            messageId: testMessage.id,
          });
        } else {
          res.status(400).json({
            success: false,
            error: result.error || "Failed to send test message",
          });
        }
      } catch (error) {
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
}
