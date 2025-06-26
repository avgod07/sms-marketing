import type { Express } from "express";
import { z } from "zod";
import { insertMessageSchema } from "@shared/schema";
import { TwilioService } from "../../services/twilio.js";
import { getBizForRequest } from "./utils";
import { logError } from "../../utils/logger.util";

export function registerMessageRoutes(app: Express) {
  app.get("/api/conversations", async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const convs = await biz.getConversationSummaries();
      res.json(convs);
    } catch (error) {
      logError("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:contactId/messages", async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const contactId = parseInt(req.params.contactId);
      const msgs = await biz.getMessagesByContact(contactId);
      res.json(msgs);
    } catch (error) {
      logError("Error fetching messages by contact:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.get("/api/messages", async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const { campaignId } = req.query;

      let messages;
      if (campaignId) {
        messages = await biz.getMessagesByCampaign(parseInt(campaignId as string));
      } else {
        messages = await biz.getMessages();
      }

      res.json(messages);
    } catch (error) {
      logError("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const validatedData = insertMessageSchema.parse(req.body);

      const contact = await biz.getContact(validatedData.contactId);
      if (!contact || !contact.active) {
        return res.status(400).json({ message: "Contact is inactive" });
      }

      const creds = await biz.getTwilioCredentials();
      const numbers = await biz.getPhoneNumbers();
      const from = numbers.find((n) => n.isDefault)?.phoneNumber;

      const result = await TwilioService.sendSMS(creds, {
        to: validatedData.phoneNumber,
        message: validatedData.content,
        from,
        messagingServiceSid: creds?.messagingServiceSid || undefined,
        campaignId: validatedData.campaignId ?? undefined,
        contactId: validatedData.contactId,
      });

      const message = await biz.createMessage({
        ...validatedData,
        status: result.success ? "sent" : "failed",
        messageSid: result.messageSid,
      });

      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      logError("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  app.patch("/api/messages/:id/status", async (req, res) => {
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
