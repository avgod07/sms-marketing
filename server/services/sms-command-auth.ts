import { db } from "../config/db.config.js";
import { smsCommandSenders } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { normalizePhoneNumber } from "../utils/normalize.util.js";
import type { SmsCommandSender, InsertSmsCommandSender } from "@shared/schema";

export class SMSCommandAuth {
  /**
   * Check if a phone number is authorized to send commands for a business
   */
  static async isAuthorizedSender(
    businessId: number,
    phoneNumber: string
  ): Promise<boolean> {
    try {
      const normalizedPhone = normalizePhoneNumber(phoneNumber);

      const [sender] = await db
        .select()
        .from(smsCommandSenders)
        .where(
          and(
            eq(smsCommandSenders.businessId, businessId),
            eq(smsCommandSenders.phoneNumber, normalizedPhone),
            eq(smsCommandSenders.isActive, true)
          )
        );

      return !!sender;
    } catch (error) {
      console.error("Error checking SMS command authorization:", error);
      return false;
    }
  }

  /**
   * Get all authorized senders for a business
   */
  static async getAuthorizedSenders(
    businessId: number
  ): Promise<SmsCommandSender[]> {
    try {
      return await db
        .select()
        .from(smsCommandSenders)
        .where(
          and(
            eq(smsCommandSenders.businessId, businessId),
            eq(smsCommandSenders.isActive, true)
          )
        );
    } catch (error) {
      console.error("Error fetching authorized senders:", error);
      return [];
    }
  }

  /**
   * Add an authorized sender for a business
   */
  static async addAuthorizedSender(
    businessId: number,
    phoneNumber: string,
    addedByUserId: number
  ): Promise<SmsCommandSender> {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // First, check if this phone number is already authorized
    const existing = await db
      .select()
      .from(smsCommandSenders)
      .where(
        and(
          eq(smsCommandSenders.businessId, businessId),
          eq(smsCommandSenders.phoneNumber, normalizedPhone)
        )
      );

    if (existing.length > 0) {
      // If exists but inactive, reactivate it
      if (!existing[0].isActive) {
        const [updated] = await db
          .update(smsCommandSenders)
          .set({
            isActive: true,
            addedByUserId,
            updatedAt: new Date(),
          })
          .where(eq(smsCommandSenders.id, existing[0].id))
          .returning();
        return updated;
      } else {
        throw new Error("Phone number is already authorized");
      }
    }

    // Create new authorized sender
    const [sender] = await db
      .insert(smsCommandSenders)
      .values({
        businessId,
        phoneNumber: normalizedPhone,
        isActive: true,
        addedByUserId,
      })
      .returning();

    return sender;
  }

  /**
   * Remove an authorized sender (soft delete)
   */
  static async removeAuthorizedSender(
    businessId: number,
    phoneNumber: string
  ): Promise<void> {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    await db
      .update(smsCommandSenders)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(smsCommandSenders.businessId, businessId),
          eq(smsCommandSenders.phoneNumber, normalizedPhone)
        )
      );
  }

  /**
   * Remove an authorized sender by ID
   */
  static async removeAuthorizedSenderById(
    businessId: number,
    senderId: number
  ): Promise<void> {
    await db
      .update(smsCommandSenders)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(smsCommandSenders.businessId, businessId),
          eq(smsCommandSenders.id, senderId)
        )
      );
  }
}
