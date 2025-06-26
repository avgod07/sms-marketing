import type { Express } from "express";
import { z } from "zod";
import { insertContactSchema } from "@shared/schema";
import { storage } from "../../db/storage";
import { logError } from "../../utils/logger.util";

export function registerPublicRoutes(app: Express) {
  const publicContactSchema = insertContactSchema.extend({
    businessId: z.number(),
  });

  app.post("/public/contacts", async (req, res) => {
    try {
      const { businessId, ...contact } = publicContactSchema.parse(req.body);
      const contactStore = storage.forBusiness(businessId);
      const newContact = await contactStore.createContact(contact);
      res.status(201).json(newContact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      logError("Error creating public contact:", error);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });
}
