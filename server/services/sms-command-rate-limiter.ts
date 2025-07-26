import { db } from "../config/db.config.js";
import { smsCommandRateLimits } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { SmsCommandRateLimit } from "@shared/schema";

export class SMSCommandRateLimiter {
  static readonly RATE_LIMIT_HOURS = 1;
  static readonly RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hour in milliseconds

  /**
   * Check if a business can send a command (rate limit check)
   */
  static async checkRateLimit(businessId: number): Promise<{
    allowed: boolean;
    nextAvailableAt?: Date;
    minutesUntilNext?: number;
  }> {
    try {
      const [rateLimit] = await db
        .select()
        .from(smsCommandRateLimits)
        .where(eq(smsCommandRateLimits.businessId, businessId));

      // No previous command, allow
      if (!rateLimit || !rateLimit.lastCommandAt) {
        return { allowed: true };
      }

      const now = new Date();
      const lastCommandTime = new Date(rateLimit.lastCommandAt);
      const nextAvailableTime = new Date(
        lastCommandTime.getTime() + this.RATE_LIMIT_MS
      );

      // Check if enough time has passed
      if (now >= nextAvailableTime) {
        return { allowed: true };
      }

      // Rate limited
      const minutesUntilNext = Math.ceil(
        (nextAvailableTime.getTime() - now.getTime()) / (1000 * 60)
      );

      return {
        allowed: false,
        nextAvailableAt: nextAvailableTime,
        minutesUntilNext,
      };
    } catch (error) {
      console.error("Error checking rate limit:", error);
      // Default to allowing on error to prevent system lockup
      return { allowed: true };
    }
  }

  /**
   * Record that a command was sent and update rate limit
   */
  static async recordCommandSent(businessId: number): Promise<Date> {
    const now = new Date();
    const nextAvailable = new Date(now.getTime() + this.RATE_LIMIT_MS);

    try {
      // Try to update existing record
      const [existing] = await db
        .select()
        .from(smsCommandRateLimits)
        .where(eq(smsCommandRateLimits.businessId, businessId));

      if (existing) {
        await db
          .update(smsCommandRateLimits)
          .set({
            lastCommandAt: now,
            nextAvailableAt: nextAvailable,
            updatedAt: now,
          })
          .where(eq(smsCommandRateLimits.businessId, businessId));
      } else {
        // Create new rate limit record
        await db.insert(smsCommandRateLimits).values({
          businessId,
          lastCommandAt: now,
          nextAvailableAt: nextAvailable,
        });
      }

      return nextAvailable;
    } catch (error) {
      console.error("Error recording command sent:", error);
      return nextAvailable;
    }
  }

  /**
   * Get current rate limit status for a business
   */
  static async getRateLimitStatus(businessId: number): Promise<{
    hasRateLimit: boolean;
    lastCommandAt?: Date;
    nextAvailableAt?: Date;
    canSendNow: boolean;
    minutesUntilNext?: number;
  }> {
    try {
      const [rateLimit] = await db
        .select()
        .from(smsCommandRateLimits)
        .where(eq(smsCommandRateLimits.businessId, businessId));

      if (!rateLimit || !rateLimit.lastCommandAt) {
        return {
          hasRateLimit: false,
          canSendNow: true,
        };
      }

      const now = new Date();
      const nextAvailable = rateLimit.nextAvailableAt
        ? new Date(rateLimit.nextAvailableAt)
        : null;
      const canSendNow = !nextAvailable || now >= nextAvailable;
      const minutesUntilNext =
        nextAvailable && !canSendNow
          ? Math.ceil((nextAvailable.getTime() - now.getTime()) / (1000 * 60))
          : undefined;

      return {
        hasRateLimit: true,
        lastCommandAt: new Date(rateLimit.lastCommandAt),
        nextAvailableAt: nextAvailable || undefined,
        canSendNow,
        minutesUntilNext,
      };
    } catch (error) {
      console.error("Error getting rate limit status:", error);
      return {
        hasRateLimit: false,
        canSendNow: true,
      };
    }
  }
}
