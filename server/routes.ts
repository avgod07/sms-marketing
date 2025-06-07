import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContactSchema, insertCampaignSchema, insertMessageSchema } from "@shared/schema";
import { z } from "zod";
import twilio from "twilio";

export async function registerRoutes(app: Express): Promise<Server> {
  // Dashboard routes
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Contact routes
  app.get("/api/contacts", async (req, res) => {
    try {
      const { segment, search } = req.query;
      
      let contacts;
      if (search) {
        contacts = await storage.searchContacts(search as string);
      } else if (segment) {
        contacts = await storage.getContactsBySegment(segment as string);
      } else {
        contacts = await storage.getContacts();
      }
      
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.get("/api/contacts/stats", async (req, res) => {
    try {
      const stats = await storage.getContactStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching contact stats:", error);
      res.status(500).json({ message: "Failed to fetch contact stats" });
    }
  });

  app.get("/api/contacts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const contact = await storage.getContact(id);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      console.error("Error fetching contact:", error);
      res.status(500).json({ message: "Failed to fetch contact" });
    }
  });

  app.post("/api/contacts", async (req, res) => {
    try {
      const validatedData = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(validatedData);
      res.status(201).json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating contact:", error);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  app.patch("/api/contacts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertContactSchema.partial().parse(req.body);
      const contact = await storage.updateContact(id, validatedData);
      res.json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating contact:", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteContact(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting contact:", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // Campaign routes
  app.get("/api/campaigns", async (req, res) => {
    try {
      const campaigns = await storage.getCampaigns();
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.get("/api/campaigns/stats", async (req, res) => {
    try {
      const stats = await storage.getCampaignStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching campaign stats:", error);
      res.status(500).json({ message: "Failed to fetch campaign stats" });
    }
  });

  app.get("/api/campaigns/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const campaign = await storage.getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      console.error("Error fetching campaign:", error);
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });

  app.post("/api/campaigns", async (req, res) => {
    try {
      const validatedData = insertCampaignSchema.parse(req.body);
      const campaign = await storage.createCampaign(validatedData);
      res.status(201).json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating campaign:", error);
      res.status(500).json({ message: "Failed to create campaign" });
    }
  });

  app.patch("/api/campaigns/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertCampaignSchema.partial().parse(req.body);
      const campaign = await storage.updateCampaign(id, validatedData);
      res.json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating campaign:", error);
      res.status(500).json({ message: "Failed to update campaign" });
    }
  });

  app.delete("/api/campaigns/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCampaign(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting campaign:", error);
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });

  // Send campaign
  app.post("/api/campaigns/:id/send", async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      // Get contacts based on campaign audience
      const contacts = await storage.getContactsBySegment(campaign.audience);
      
      if (contacts.length === 0) {
        return res.status(400).json({ message: "No contacts found for selected audience" });
      }

      // Import Twilio service
      const { TwilioService } = await import("./services/twilio.js");
      
      // Prepare SMS messages
      const smsMessages = contacts.map(contact => ({
        to: contact.phoneNumber,
        message: campaign.message,
        campaignId: campaign.id,
        contactId: contact.id,
      }));

      // Send SMS messages
      const results = await TwilioService.sendBulkSMS(smsMessages);
      
      // Create message records and update campaign stats
      let sentCount = 0;
      let deliveredCount = 0;
      
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const contact = contacts[i];
        
        const messageData = {
          phoneNumber: contact.phoneNumber,
          contactId: contact.id,
          content: campaign.message,
          status: result.success ? 'sent' : 'failed',
          campaignId: campaign.id,
        };
        
        await storage.createMessage(messageData);
        
        if (result.success) {
          sentCount++;
          deliveredCount++; // Assume delivered for now, will be updated by webhooks
        }
      }
      
      // Update campaign status (note: sentCount and deliveredCount are handled in the database layer)
      await storage.updateCampaign(campaignId, {
        status: 'completed',
      });

      res.json({ 
        message: "Campaign sent successfully",
        sentCount,
        totalContacts: contacts.length,
      });
    } catch (error) {
      console.error("Error sending campaign:", error);
      res.status(500).json({ message: "Failed to send campaign" });
    }
  });

  // Message routes
  app.get("/api/messages", async (req, res) => {
    try {
      const { campaignId } = req.query;
      
      let messages;
      if (campaignId) {
        messages = await storage.getMessagesByCampaign(parseInt(campaignId as string));
      } else {
        messages = await storage.getMessages();
      }
      
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const validatedData = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage(validatedData);
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  app.patch("/api/messages/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, deliveredAt } = req.body;
      const message = await storage.updateMessageStatus(id, status, deliveredAt ? new Date(deliveredAt) : undefined);
      res.json(message);
    } catch (error) {
      console.error("Error updating message status:", error);
      res.status(500).json({ message: "Failed to update message status" });
    }
  });

  // Twilio webhook endpoint
  app.post("/api/twilio/webhook", async (req, res) => {
    try {
      const signature = req.get("x-twilio-signature") || "";
      const authToken = process.env.TWILIO_AUTH_TOKEN || "";
      const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

      // verify signature
      const isValid = twilio.validateRequest(authToken, signature, url, req.body);
      if (!isValid) {
        return res.status(403).json({ message: "Invalid Twilio signature" });
      }

      const { MessageStatus, To } = req.body;

      // Normalize status values
      let status = "sent";
      if (MessageStatus === "delivered") status = "delivered";
      else if (MessageStatus === "failed" || MessageStatus === "undelivered") status = "failed";

      // Find latest message for the phone number
      const messages = await storage.getMessages();
      const message = messages.find(m => m.phoneNumber === To && m.status !== "delivered" && m.status !== "failed");
      if (message) {
        await storage.updateMessageStatus(message.id, status, status === "delivered" ? new Date() : undefined);
      }

      res.status(200).send("OK");
    } catch (error) {
      console.error("Error processing Twilio webhook:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
