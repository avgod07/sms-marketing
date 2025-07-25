import { db } from "../config/db.config.js";
import { smsCommandPending } from "@shared/schema";
import { eq, lt } from "drizzle-orm";
import type {
  SmsCommandPending,
  InsertSmsCommandPending,
} from "@shared/schema";
import { logInfo, logError } from "../utils/logger.util.js";

export class SMSCommandPending {
  /**
   * Store pending command (replaces any existing for business)
   */
  static async storePendingCommand(
    businessId: number,
    data: Omit<InsertSmsCommandPending, "businessId">
  ): Promise<SmsCommandPending> {
    try {
      // Use UPSERT to ensure only one pending command per business
      const [pending] = await db
        .insert(smsCommandPending)
        .values({
          businessId,
          ...data,
        })
        .onConflictDoUpdate({
          target: smsCommandPending.businessId,
          set: {
            senderPhone: data.senderPhone,
            messageContent: data.messageContent,
            contactCount: data.contactCount,
            creditCost: data.creditCost,
            expiresAt: data.expiresAt,
            createdAt: new Date(),
          },
        })
        .returning();

      logInfo("Stored pending SMS command", {
        businessId,
        pendingId: pending.id,
        senderPhone: data.senderPhone,
        contactCount: data.contactCount,
        creditCost: data.creditCost,
        expiresAt: data.expiresAt.toISOString(),
      });

      return pending;
    } catch (error) {
      logError("Error storing pending SMS command:", error);
      throw error;
    }
  }

  /**
   * Get pending command for business
   */
  static async getPendingCommand(
    businessId: number
  ): Promise<SmsCommandPending | null> {
    try {
      const [pending] = await db
        .select()
        .from(smsCommandPending)
        .where(eq(smsCommandPending.businessId, businessId));

      // Check if expired
      if (pending && new Date() > new Date(pending.expiresAt)) {
        await this.clearPendingCommand(businessId);
        logInfo("Cleared expired pending command", {
          businessId,
          pendingId: pending.id,
          expiredAt: pending.expiresAt,
        });
        return null;
      }

      return pending || null;
    } catch (error) {
      logError("Error getting pending SMS command:", error);
      return null;
    }
  }

  /**
   * Clear pending command for business
   */
  static async clearPendingCommand(businessId: number): Promise<void> {
    try {
      await db
        .delete(smsCommandPending)
        .where(eq(smsCommandPending.businessId, businessId));

      logInfo("Cleared pending SMS command", { businessId });
    } catch (error) {
      logError("Error clearing pending SMS command:", error);
      throw error;
    }
  }

  /**
   * Cleanup expired commands (called periodically)
   */
  static async cleanupExpiredCommands(): Promise<number> {
    try {
      const now = new Date();
      const deleted = await db
        .delete(smsCommandPending)
        .where(lt(smsCommandPending.expiresAt, now))
        .returning({ id: smsCommandPending.id });

      const count = deleted.length;
      if (count > 0) {
        logInfo(`Cleaned up ${count} expired SMS commands`, {
          expiredBefore: now.toISOString(),
        });
      }

      return count;
    } catch (error) {
      logError("Error cleaning up expired SMS commands:", error);
      return 0;
    }
  }
}
