import type { Express } from "express";
import { z } from "zod";
import { requireAuth } from "@clerk/express";
import { insertContactSchema } from "@shared/schema";
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
      const validatedData = insertContactSchema.parse(req.body);
      const contact = await biz.createContact(validatedData);
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
