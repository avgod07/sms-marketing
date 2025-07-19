import type { Express } from "express";
import { z } from "zod";
import { requireAuth } from "@clerk/express";
import { insertContactSchema } from "@shared/schema";
import {
  MessageCreditService,
  InsufficientCreditsError,
} from "../../services/message-credits.js";
import { getBizForRequest, logDetailedError } from "./utils";
import { logError } from "../../utils/logger.util";

export function registerContactRoutes(app: Express) {
  app.get("/api/contacts", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const { search } = req.query as { search?: string };

      let contacts;
      if (search) {
        contacts = await biz.searchContacts(search);
      } else {
        contacts = await biz.getContacts();
      }

      res.json(contacts);
    } catch (error) {
      logDetailedError("Error fetching contacts", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.get("/api/contacts/stats", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const stats = await biz.getContactStats();
      res.json(stats);
    } catch (error) {
      logError("Error fetching contact stats:", error);
      res.status(500).json({ message: "Failed to fetch contact stats" });
    }
  });

  app.get("/api/contacts/recent", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 3;
      const contacts = await biz.getRecentContacts(limit);
      res.json(contacts);
    } catch (error) {
      logDetailedError("Error fetching recent contacts", error);
      res.status(500).json({ message: "Failed to fetch recent contacts" });
    }
  });

  app.get("/api/contacts/:id", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const id = parseInt(req.params.id);
      const contact = await biz.getContact(id);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      logError("Error fetching contact:", error);
      res.status(500).json({ message: "Failed to fetch contact" });
    }
  });

  app.get("/api/contacts/:id/redemptions", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const id = parseInt(req.params.id);
      const contact = await biz.getContact(id);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      const redemptions = await biz.getContactRedemptions(id);
      res.json(redemptions);
    } catch (error) {
      logError("Error fetching contact redemptions:", error);
      res.status(500).json({ message: "Failed to fetch contact redemptions" });
    }
  });

  app.post("/api/contacts", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);

      // Check if onboarding is complete
      const business = await biz.getBusiness();
      if (!business.onboardingComplete || !business.initialMessage) {
        return res.status(400).json({
          message:
            "Please complete onboarding and set an initial message before adding contacts.",
          code: "ONBOARDING_INCOMPLETE",
        });
      }

      const validatedData = insertContactSchema.parse(req.body);

      // Check if user has sufficient credits for initial message (SMS = 1 credit)
      const credits = await biz.getCredits();
      const balance = credits?.balance || 0;
      const creditsNeeded = 1; // Initial message is always SMS

      if (balance < creditsNeeded) {
        return res.status(400).json({
          message: `Insufficient credits. Need ${creditsNeeded} credit for initial message.`,
        });
      }

      const contact = await biz.createContact(validatedData);

      // Send initial message to the new contact with credit deduction
      try {
        const messagingServiceSid = await biz.getMessagingServiceSid();
        const numbers = await biz.getPhoneNumbers();
        const from = numbers.find((n) => n.isDefault)?.phoneNumber;

        if (from && process.env.TWILIO_ACCOUNT_SID) {
          // Create a minimal creds object for compatibility
          const tempCreds = {
            businessId: business.id,
            accountSid: process.env.TWILIO_ACCOUNT_SID,
            messagingServiceSid: messagingServiceSid || null,
            createdAt: new Date(),
            updatedAt: new Date(),
            id: 0,
          };

          // Use the new credit deduction service
          const result = await MessageCreditService.sendWithCreditDeduction(
            biz,
            tempCreds,
            {
              to: contact.phoneNumber,
              message: business.initialMessage,
              from,
              messagingServiceSid: messagingServiceSid ?? undefined,
              contactId: contact.id,
              messageType: "initial",
            }
          );

          // Record the sent message in the database
          await biz.createMessage({
            phoneNumber: contact.phoneNumber,
            contactId: contact.id,
            content: business.initialMessage,
            status: result.success ? "sent" : "failed",
            messageType: "initial",
            messageSid: result.messageSid,
          });

          // Log credit usage for initial message
          if (result.success) {
            logError("Initial message sent with credit deduction", {
              contactId: contact.id,
              phoneNumber: contact.phoneNumber,
              creditCost: result.creditCost,
              remainingCredits: result.remainingCredits,
            });
          }
        }
      } catch (smsError) {
        // If SMS fails, we should still return the contact but log the error
        // The credit deduction is handled by MessageCreditService
        if (smsError instanceof InsufficientCreditsError) {
          logError("Insufficient credits for initial message", {
            contactId: contact.id,
            phoneNumber: contact.phoneNumber,
            error: smsError.message,
          });
        } else {
          logError("Error sending initial message:", smsError);
        }
      }

      res.status(201).json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Validation error", errors: error.errors });
      }
      logError("Error creating contact:", error);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  app.patch("/api/contacts/:id", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const id = parseInt(req.params.id);
      const validatedData = insertContactSchema.partial().parse(req.body);
      const contact = await biz.updateContact(id, validatedData);
      res.json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Validation error", errors: error.errors });
      }
      logError("Error updating contact:", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:id", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const id = parseInt(req.params.id);
      await biz.deleteContact(id);
      res.status(204).send();
    } catch (error) {
      logError("Error deleting contact:", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });
}
