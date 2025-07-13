import { z } from "zod";
import { storage } from "../db/storage";
import { TwilioService } from "./twilio";
import { logError } from "../utils/logger.util";
import { normalizePhoneNumber } from "../utils/normalize.util";
import type {
  Keyword,
  InsertKeyword,
  KeywordOptIn,
  InsertKeywordOptIn,
} from "@shared/schema";

// Validation schemas
export const keywordValidationSchema = z.object({
  keyword: z
    .string()
    .min(1, "Keyword is required")
    .max(20, "Keyword must be 20 characters or less")
    .regex(
      /^[A-Z0-9]+$/,
      "Keyword must contain only uppercase letters and numbers"
    ),
  welcomeMessage: z
    .string()
    .min(1, "Welcome message is required")
    .max(160, "Welcome message must be 160 characters or less (SMS limit)"),
  isActive: z.boolean().default(true),
});

export const testMessageSchema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
});

export class KeywordService {
  /**
   * Validate and create a keyword
   */
  static async createKeyword(
    businessId: number,
    data: z.infer<typeof keywordValidationSchema>
  ): Promise<Keyword> {
    const biz = storage.forBusiness(businessId);

    // Check if keyword already exists
    const existing = await biz.getKeywordByText(data.keyword);
    if (existing) {
      throw new Error("Keyword already exists");
    }

    return await biz.createKeyword({
      keyword: data.keyword.toUpperCase(),
      welcomeMessage: data.welcomeMessage,
      isActive: data.isActive,
    });
  }

  /**
   * Update a keyword
   */
  static async updateKeyword(
    businessId: number,
    keywordId: number,
    data: Partial<z.infer<typeof keywordValidationSchema>>
  ): Promise<Keyword> {
    const biz = storage.forBusiness(businessId);

    // Check if keyword exists
    const existing = await biz.getKeyword(keywordId);
    if (!existing) {
      throw new Error("Keyword not found");
    }

    // If keyword text is being changed, check for duplicates
    if (data.keyword && data.keyword !== existing.keyword) {
      const duplicate = await biz.getKeywordByText(data.keyword);
      if (duplicate) {
        throw new Error("Keyword already exists");
      }
    }

    return await biz.updateKeyword(keywordId, {
      keyword: data.keyword?.toUpperCase(),
      welcomeMessage: data.welcomeMessage,
      isActive: data.isActive,
    });
  }

  /**
   * Delete a keyword
   */
  static async deleteKeyword(
    businessId: number,
    keywordId: number
  ): Promise<void> {
    const biz = storage.forBusiness(businessId);

    // Check if keyword exists
    const existing = await biz.getKeyword(keywordId);
    if (!existing) {
      throw new Error("Keyword not found");
    }

    await biz.deleteKeyword(keywordId);
  }

  /**
   * Process incoming SMS for keyword matching
   */
  static async processIncomingSMS(
    businessId: number,
    fromPhoneNumber: string,
    messageBody: string
  ): Promise<{
    success: boolean;
    responseMessage: string;
    contactCreated: boolean;
    keywordMatched: boolean;
  }> {
    const biz = storage.forBusiness(businessId);
    const normalizedPhone = normalizePhoneNumber(fromPhoneNumber);
    const messageText = messageBody.trim().toUpperCase();

    // Handle STOP/UNSUBSCRIBE
    if (messageText === "STOP" || messageText === "UNSUBSCRIBE") {
      const contact = await biz.getContactByPhoneNumber(normalizedPhone);
      if (contact && contact.active) {
        await biz.updateContact(contact.id, { active: false });
        return {
          success: true,
          responseMessage:
            "You've been removed from our list. You will no longer receive messages from us.",
          contactCreated: false,
          keywordMatched: false,
        };
      }
      return {
        success: true,
        responseMessage: "You're not currently subscribed to our messages.",
        contactCreated: false,
        keywordMatched: false,
      };
    }

    // Try to match keyword
    const keyword = await biz.getKeywordByText(messageText);
    if (!keyword) {
      return {
        success: false,
        responseMessage:
          "Sorry, we didn't recognize that keyword. Please try again or contact us for help.",
        contactCreated: false,
        keywordMatched: false,
      };
    }

    // Get or create contact
    let contact = await biz.getContactByPhoneNumber(normalizedPhone);
    let contactCreated = false;

    if (!contact) {
      contact = await biz.createContact({
        firstName: "SMS",
        lastName: "Contact",
        phoneNumber: normalizedPhone,
      });
      contactCreated = true;
    }

    // Check if already opted in to this keyword
    const alreadyOptedIn = await biz.hasContactOptedInToKeyword(
      contact.id,
      keyword.id
    );
    if (alreadyOptedIn) {
      const business = await biz.getBusiness();
      return {
        success: true,
        responseMessage: `You're already subscribed to updates from ${business.name}.`,
        contactCreated: false,
        keywordMatched: true,
      };
    }

    // Create opt-in record
    await biz.createKeywordOptIn({
      keywordId: keyword.id,
      contactId: contact.id,
      phoneNumber: normalizedPhone,
    });

    // Increment keyword opt-in count
    await biz.incrementKeywordOptInCount(keyword.id);

    // Activate contact if not already active
    if (!contact.active) {
      await biz.updateContact(contact.id, { active: true });
    }

    // Generate welcome message with variable substitution
    const welcomeMessage = this.substituteVariables(
      keyword.welcomeMessage,
      contact,
      await biz.getBusiness()
    );

    // Append compliance message
    const fullMessage = `${welcomeMessage} Text STOP to unsubscribe.`;

    return {
      success: true,
      responseMessage: fullMessage,
      contactCreated,
      keywordMatched: true,
    };
  }

  /**
   * Send test message for a keyword
   */
  static async sendTestMessage(
    businessId: number,
    keywordId: number,
    phoneNumber: string
  ): Promise<{ success: boolean; messageSid?: string; error?: string }> {
    const biz = storage.forBusiness(businessId);

    // Get keyword
    const keyword = await biz.getKeyword(keywordId);
    if (!keyword) {
      return { success: false, error: "Keyword not found" };
    }

    // Get business info for variable substitution
    const business = await biz.getBusiness();

    // Create a mock contact for variable substitution
    const mockContact = {
      firstName: "Test",
      lastName: "User",
      phoneNumber: normalizePhoneNumber(phoneNumber),
    };

    // Generate test message
    const welcomeMessage = this.substituteVariables(
      keyword.welcomeMessage,
      mockContact,
      business
    );
    const fullMessage = `${welcomeMessage} Text STOP to unsubscribe.`;

    // Get Twilio credentials and phone numbers
    const creds = await biz.getTwilioCredentials();
    const numbers = await biz.getPhoneNumbers();
    const from = numbers.find((n) => n.isDefault)?.phoneNumber;

    if (!creds || !from) {
      return {
        success: false,
        error: "Twilio not configured or no default phone number",
      };
    }

    try {
      const result = await TwilioService.sendSMS(creds, {
        to: normalizePhoneNumber(phoneNumber),
        message: fullMessage,
        from,
        messagingServiceSid: creds?.messagingServiceSid || undefined,
      });

      if (result.success) {
        return { success: true, messageSid: result.messageSid };
      } else {
        return {
          success: false,
          error: result.error || "Failed to send test message",
        };
      }
    } catch (error) {
      logError("Error sending test keyword message:", error);
      return { success: false, error: "Failed to send test message" };
    }
  }

  /**
   * Substitute variables in welcome message
   */
  private static substituteVariables(
    message: string,
    contact: { firstName: string; lastName: string; phoneNumber: string },
    business: { name: string }
  ): string {
    return message
      .replace(/{firstName}/g, contact.firstName)
      .replace(/{businessName}/g, business.name);
  }
}
