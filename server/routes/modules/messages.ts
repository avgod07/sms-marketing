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
          const contact = await biz.getContact(message.contactId);
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
          const contact = await biz.getContact(message.contactId);
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

  app.post("/api/messages", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const validatedData = insertMessageSchema.parse(req.body);

      const contact = await biz.getContact(validatedData.contactId);
      if (!contact || !contact.active) {
        return res.status(400).json({ message: "Contact is inactive" });
      }

      const messagingServiceSid = await biz.getMessagingServiceSid();
      const numbers = await biz.getPhoneNumbers();
      const from = numbers.find((n) => n.isDefault)?.phoneNumber;

      // Create a minimal creds object for compatibility
      const tempCreds = {
        businessId: (await biz.getBusiness()).id,
        accountSid: process.env.TWILIO_ACCOUNT_SID!,
        messagingServiceSid: messagingServiceSid || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        id: 0,
      };

      // Use the updated credit deduction service (send-first-then-deduct)
      const result = await MessageCreditService.sendWithCreditDeduction(
        biz,
        tempCreds,
        {
          to: validatedData.phoneNumber,
          message: validatedData.content,
          from,
          messagingServiceSid: messagingServiceSid ?? undefined,
          campaignId: validatedData.campaignId ?? undefined,
          contactId: validatedData.contactId,
          messageType: "regular",
        }
      );

      // Create message record with both delivery and billing status
      const message = await biz.createMessage({
        ...validatedData,
        status: result.success ? "sent" : "failed",
        messageType: "regular",
        billingStatus: result.billingStatus,
        messageSid: result.messageSid,
      });

      // Return clean success response - user doesn't need to know about billing failures
      res.status(201).json({
        ...message,
        creditCost: result.creditCost,
        remainingCredits: result.remainingCredits,
      });
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
  });

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
