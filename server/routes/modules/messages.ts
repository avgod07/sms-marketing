import type { Express } from "express";
import { z } from "zod";
import { requireAuth } from "@clerk/express";
import { insertMessageSchema } from "@shared/schema";
import { TwilioService } from "../../services/twilio.js";
import {
  MessageCreditService,
  InsufficientCreditsError,
} from "../../services/message-credits.js";
import { getBizForRequest } from "./utils";
import { logError } from "../../utils/logger.util";
import { requireTFVVerification } from "../../middlewares/tfv-verification.middleware";
import { requireActiveSubscription } from "../../middlewares/subscription-verification.middleware";
import { UniversalMessageService } from "../../services/universal-message.js";

export function registerMessageRoutes(app: Express) {
  app.get("/api/conversations", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const convs = await biz.getConversationSummaries();
      res.json(convs);
    } catch (error) {
      logError("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get(
    "/api/conversations/:contactId/messages",
    requireAuth(),
    async (req, res) => {
      try {
        const { biz } = await getBizForRequest(req);
        const contactId = parseInt(req.params.contactId);
        const msgs = await biz.getMessagesByContact(contactId);
        res.json(msgs);
      } catch (error) {
        logError("Error fetching messages by contact:", error);
        res.status(500).json({ message: "Failed to fetch messages" });
      }
    }
  );

  app.get("/api/messages", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const { campaignId } = req.query;

      let messages;
      if (campaignId) {
        messages = await biz.getMessagesByCampaign(
          parseInt(campaignId as string)
        );
      } else {
        messages = await biz.getMessages();
      }

      res.json(messages);
    } catch (error) {
      logError("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.get("/api/messages/recent", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 3;
      const messages = await biz.getRecentMessages(limit);

      // Get contact names for the messages
      const messagesWithContactNames = await Promise.all(
        messages.map(async (message) => {
          const contact = message.contactId
            ? await biz.getContact(message.contactId)
            : null;
          return {
            ...message,
            contactName: contact
              ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim() ||
                contact.phoneNumber
              : message.phoneNumber,
          };
        })
      );

      res.json(messagesWithContactNames);
    } catch (error) {
      logError("Error fetching recent messages", { error });
      res.status(500).json({ message: "Failed to fetch recent messages" });
    }
  });

  app.get("/api/messages/inbox/recent", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 3;
      const messages = await biz.getRecentInboxMessages(limit);

      // Get contact names for the messages
      const messagesWithContactNames = await Promise.all(
        messages.map(async (message) => {
          const contact = message.contactId
            ? await biz.getContact(message.contactId)
            : null;
          return {
            ...message,
            contactName: contact
              ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim() ||
                contact.phoneNumber
              : message.phoneNumber,
          };
        })
      );

      res.json(messagesWithContactNames);
    } catch (error) {
      logError("Error fetching recent inbox messages", { error });
      res
        .status(500)
        .json({ message: "Failed to fetch recent inbox messages" });
    }
  });

  app.post(
    "/api/messages",
    requireAuth(),
    requireTFVVerification,
    requireActiveSubscription,
    async (req, res) => {
      try {
        const { biz } = await getBizForRequest(req);
        const validatedData = insertMessageSchema.parse(req.body);

        if (!validatedData.contactId) {
          return res.status(400).json({ message: "Contact ID is required" });
        }

        const contact = await biz.getContact(validatedData.contactId);
        if (!contact || !contact.active) {
          return res.status(400).json({ message: "Contact is inactive" });
        }

        // Send message using UniversalMessageService with TCPA compliance
        // UniversalMessageService will handle subaccount vs legacy credential selection
        const result = await UniversalMessageService.sendMessage(biz, {
          businessId: (await biz.getBusiness()).id,
          phoneNumber: validatedData.phoneNumber,
          messageContent: validatedData.content,
          messageType: "individual",
          contactId: validatedData.contactId,
          campaignId: validatedData.campaignId ?? undefined,
        });

        if (result.status === "sent") {
          // Retrieve the message record that UniversalMessageService created
          if (result.messageId) {
            const createdMessage = await biz.getMessageBySid(result.messageId);
            if (createdMessage) {
              res.status(201).json(createdMessage);
            } else {
              // This should never happen, but fallback just in case
              throw new Error("Message sent but record not found");
            }
          } else {
            throw new Error("Message sent but no messageId returned");
          }
        } else if (result.status === "queued") {
          // Get the queue record that was created to build a proper response
          const { MessageQueueService } = await import(
            "../../services/message-queue.js"
          );

          if (!result.queueId) {
            throw new Error("Message queued but no queueId returned");
          }

          const queueRecord = await MessageQueueService.getQueuedMessage(
            result.queueId
          );

          // Create a response that matches the original message format
          // but doesn't create a duplicate database record
          res.status(201).json({
            id: result.queueId, // Use queueId as the ID (matches original behavior)
            businessId: (await biz.getBusiness()).id,
            contactId: validatedData.contactId,
            phoneNumber: validatedData.phoneNumber,
            content: validatedData.content,
            status: "pending",
            messageType: "individual",
            billingStatus: "billed", // Changed to "billed" since credits were deducted upfront
            messageSid: null,
            queueId: result.queueId,
            campaignId: validatedData.campaignId || null,
            errorCode: null,
            sentAt: null,
            deliveredAt: null,
            createdAt:
              queueRecord?.createdAt?.toString() || new Date().toISOString(),
            scheduledFor: result.scheduledFor,
            message: "Message queued for business hours compliance",
          });
        }
      } catch (error) {
        if (error instanceof InsufficientCreditsError) {
          return res.status(402).json({
            message: "Insufficient credits",
            error: error.message,
            code: "INSUFFICIENT_CREDITS",
          });
        }
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Validation error", errors: error.errors });
        }
        logError("Error creating message:", error);
        res.status(500).json({ message: "Failed to create message" });
      }
    }
  );

  app.patch("/api/messages/:id/status", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const id = parseInt(req.params.id);
      const { status, deliveredAt, errorCode } = req.body;
      const message = await biz.updateMessageStatus(
        id,
        status,
        deliveredAt ? new Date(deliveredAt) : undefined,
        errorCode
      );
      res.json(message);
    } catch (error) {
      logError("Error updating message status:", error);
      res.status(500).json({ message: "Failed to update message status" });
    }
  });
}
