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
import { UniversalMessageService } from "../../services/universal-message.js";

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

        // Send initial message to the new contact with TCPA compliance
        try {
          if (business.initialMessage) {
            // Send via UniversalMessageService with TCPA compliance
            // UniversalMessageService will handle subaccount vs legacy credential selection
            const result = await UniversalMessageService.sendMessage(
              contactStore,
              {
                businessId: business.id,
                phoneNumber: newContact.phoneNumber,
                messageContent: business.initialMessage,
                messageType: "welcome",
                contactId: newContact.id,
              }
            );

            if (result.status === "sent") {
              // Record the immediately sent message
              await contactStore.createMessage({
                phoneNumber: newContact.phoneNumber,
                contactId: newContact.id,
                content: business.initialMessage,
                status: "sent",
                messageType: "welcome",
                billingStatus: "success",
                messageSid: result.messageId,
              });

              logInfo("Initial message sent successfully (public signup)", {
                contactId: newContact.id,
                phoneNumber: newContact.phoneNumber,
                messageSid: result.messageId,
              });
            } else if (result.status === "queued") {
              // Record the queued message
              await contactStore.createMessage({
                phoneNumber: newContact.phoneNumber,
                contactId: newContact.id,
                content: business.initialMessage,
                status: "pending",
                messageType: "welcome",
                billingStatus: "pending",
                queueId: result.queueId,
              });

              logInfo(
                "Initial message queued for business hours (public signup)",
                {
                  contactId: newContact.id,
                  phoneNumber: newContact.phoneNumber,
                  queueId: result.queueId,
                  scheduledFor: result.scheduledFor,
                }
              );
            }
          }
        } catch (messageError) {
          // Log error but don't fail contact creation
          logError(
            "Failed to send initial message to new contact (public signup)",
            {
              contactId: newContact.id,
              phoneNumber: newContact.phoneNumber,
              error:
                messageError instanceof Error
                  ? messageError.message
                  : String(messageError),
            }
          );
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
