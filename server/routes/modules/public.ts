import type { Express } from "express";
import { z } from "zod";
import { insertContactSchema } from "@shared/schema";
import { storage } from "../../db/storage";
import {
  MessageCreditService,
  InsufficientCreditsError,
} from "../../services/message-credits.js";
import { logError } from "../../utils/logger.util";
import { createRateLimiter } from "../../middlewares/rate-limit.middleware";
import { logInfo } from "../../utils/logger.util";
import { requirePublicTFVVerification } from "../../middlewares/tfv-public-verification.middleware";
import { requirePublicSubscriptionVerification } from "../../middlewares/subscription-verification.middleware";

export function registerPublicRoutes(app: Express) {
  const publicContactRateLimiter = createRateLimiter({
    windowMs: 60_000,
    max: 5,
  }); // 5 contacts per minute per IP

  const publicContactSchema = insertContactSchema.extend({
    businessId: z.number().positive("Business ID must be a positive number"),
  });

  // New endpoint: Get business info for public join form
  app.get("/business/:businessId", async (req, res) => {
    try {
      const businessId = parseInt(req.params.businessId);
      if (isNaN(businessId)) {
        return res.status(400).json({ message: "Invalid business ID" });
      }

      const contactStore = storage.forBusiness(businessId);
      let business;
      try {
        business = await contactStore.getBusiness();
      } catch (error) {
        return res.status(404).json({ message: "Business not found" });
      }

      // Check if onboarding is complete
      if (!business.onboardingComplete || !business.initialMessage) {
        return res.status(400).json({
          message: "This business is not currently accepting new contacts.",
          code: "ONBOARDING_INCOMPLETE",
        });
      }

      // Get onboarding progress for additional business info
      const progress = await contactStore.getOnboardingProgress();

      res.json({
        businessName:
          business.name || progress?.businessName || "This Business",
        websiteUrl: progress?.websiteUrl || null,
        city: progress?.city || null,
        state: progress?.state || null,
        country: progress?.country || null,
        isAcceptingContacts: true,
      });
    } catch (error) {
      logError("Error fetching public business info:", error);
      res.status(500).json({ message: "Failed to fetch business information" });
    }
  });

  app.post(
    "/contacts",
    publicContactRateLimiter,
    requirePublicTFVVerification,
    requirePublicSubscriptionVerification,
    async (req, res) => {
      try {
        const { businessId, ...contact } = publicContactSchema.parse(req.body);

        // Validate business exists and is active
        const contactStore = storage.forBusiness(businessId);
        let business;
        try {
          business = await contactStore.getBusiness();
        } catch (error) {
          return res.status(404).json({ message: "Business not found" });
        }

        // Check if onboarding is complete
        if (!business.onboardingComplete || !business.initialMessage) {
          return res.status(400).json({
            message:
              "This business is not currently accepting new contacts. Please try again later.",
            code: "ONBOARDING_INCOMPLETE",
          });
        }

        // Check if phone number already exists for this business
        const existingContact = await contactStore.getContactByPhoneNumber(
          contact.phoneNumber
        );
        if (existingContact) {
          return res
            .status(409)
            .json({ message: "Contact with this phone number already exists" });
        }

        const newContact = await contactStore.createContact({
          ...contact,
          consentDate: new Date(),
          consentMethod: "web_form",
        });

        // Send initial message to the new contact with credit deduction
        try {
          const messagingServiceSid =
            await contactStore.getMessagingServiceSid();
          const numbers = await contactStore.getPhoneNumbers();
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

            // Use the updated credit deduction service (send-first-then-deduct)
            const result = await MessageCreditService.sendWithCreditDeduction(
              contactStore,
              tempCreds,
              {
                to: newContact.phoneNumber,
                message: business.initialMessage,
                from,
                messagingServiceSid: messagingServiceSid ?? undefined,
                contactId: newContact.id,
                messageType: "initial",
              }
            );

            // Record the sent message in the database with billing status
            await contactStore.createMessage({
              phoneNumber: newContact.phoneNumber,
              contactId: newContact.id,
              content: business.initialMessage,
              status: result.success ? "sent" : "failed",
              messageType: "initial",
              billingStatus: result.billingStatus,
              messageSid: result.messageSid,
            });

            // Log initial message result for monitoring
            if (result.success) {
              logInfo("Initial message sent successfully (public signup)", {
                contactId: newContact.id,
                phoneNumber: newContact.phoneNumber,
                creditCost: result.creditCost,
                remainingCredits: result.remainingCredits,
                billingStatus: result.billingStatus,
              });
            } else {
              logError("Initial message failed to send (public signup)", {
                contactId: newContact.id,
                phoneNumber: newContact.phoneNumber,
                error: result.error,
              });
            }
          }
        } catch (smsError) {
          // Log the SMS error but don't fail the contact creation
          logError("Error sending initial message:", smsError);
        }

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
    }
  );
}
