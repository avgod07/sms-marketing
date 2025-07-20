import { db } from "../config/db.config";
import { businesses, businessPhoneNumbers } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { storage } from "../db/storage";
import { logInfo, logError } from "../utils/logger.util";
import { sql } from "drizzle-orm";

/**
 * Service to periodically check TFV status for all businesses
 * This ensures verification statuses are kept up to date
 */
export class TFVPeriodicCheckService {
  private static isRunning = false;

  /**
   * Run TFV status check for all businesses with pending verifications
   */
  static async checkAllBusinesses(): Promise<{
    businessesChecked: number;
    statusesUpdated: number;
    errors: number;
  }> {
    if (this.isRunning) {
      logInfo("TFV periodic check already running, skipping");
      return { businessesChecked: 0, statusesUpdated: 0, errors: 0 };
    }

    this.isRunning = true;
    const startTime = Date.now();
    let businessesChecked = 0;
    let statusesUpdated = 0;
    let errors = 0;

    try {
      logInfo("Starting periodic TFV status check for all businesses");

      // Get all businesses that have phone numbers with pending TFV verifications
      const businessesWithPendingTFV = await db
        .select({
          businessId: businesses.id,
          businessName: businesses.name,
        })
        .from(businesses)
        .innerJoin(
          businessPhoneNumbers,
          eq(businesses.id, businessPhoneNumbers.businessId)
        )
        .where(
          and(
            eq(businessPhoneNumbers.verificationStatus, "PENDING_REVIEW"), // ✅ CORRECT TWILIO STATUS
            // Only check businesses with TFV SIDs
            sql`${businessPhoneNumbers.tfvSid} IS NOT NULL`
          )
        )
        .groupBy(businesses.id, businesses.name);

      logInfo(
        `Found ${businessesWithPendingTFV.length} businesses with pending TFV verifications`
      );

      for (const business of businessesWithPendingTFV) {
        try {
          businessesChecked++;

          logInfo(
            `Checking TFV status for business ${business.businessId} (${business.businessName})`
          );

          // Use the storage service to refresh TFV status
          const bizStorage = storage.forBusiness(business.businessId);

          // Get current status before refresh
          const statusBefore = await bizStorage.getTFVVerificationStatus();

          // Refresh from Twilio
          await bizStorage.refreshTFVStatusFromTwilio();

          // Get status after refresh
          const statusAfter = await bizStorage.getTFVVerificationStatus();

          // Check if status changed
          if (statusBefore.status !== statusAfter.status) {
            statusesUpdated++;
            logInfo(`TFV status updated for business ${business.businessId}`, {
              businessId: business.businessId,
              businessName: business.businessName,
              statusBefore: statusBefore.status,
              statusAfter: statusAfter.status,
              isVerified: statusAfter.isVerified,
            });
          }
        } catch (businessError) {
          errors++;
          logError(
            `Failed to check TFV status for business ${business.businessId}:`,
            {
              businessId: business.businessId,
              businessName: business.businessName,
              error:
                businessError instanceof Error
                  ? businessError.message
                  : String(businessError),
            }
          );
          // Continue with other businesses
        }
      }

      const duration = Date.now() - startTime;

      logInfo("Completed periodic TFV status check", {
        businessesChecked,
        statusesUpdated,
        errors,
        durationMs: duration,
      });

      return { businessesChecked, statusesUpdated, errors };
    } catch (error) {
      const duration = Date.now() - startTime;

      logError("Failed to complete periodic TFV status check:", {
        error: error instanceof Error ? error.message : String(error),
        businessesChecked,
        statusesUpdated,
        errors,
        durationMs: duration,
      });

      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check TFV status for a specific business
   */
  static async checkBusiness(businessId: number): Promise<{
    businessId: number;
    statusUpdated: boolean;
    newStatus?: string;
    error?: string;
  }> {
    try {
      logInfo(`Checking TFV status for business ${businessId}`);

      const bizStorage = storage.forBusiness(businessId);

      // Get current status before refresh
      const statusBefore = await bizStorage.getTFVVerificationStatus();

      // Only refresh if there are pending verifications
      if (!statusBefore.hasPhoneNumbers || statusBefore.isVerified) {
        return {
          businessId,
          statusUpdated: false,
          newStatus: statusBefore.status,
        };
      }

      // Refresh from Twilio
      await bizStorage.refreshTFVStatusFromTwilio();

      // Get status after refresh
      const statusAfter = await bizStorage.getTFVVerificationStatus();

      const statusUpdated = statusBefore.status !== statusAfter.status;

      if (statusUpdated) {
        logInfo(`TFV status updated for business ${businessId}`, {
          businessId,
          statusBefore: statusBefore.status,
          statusAfter: statusAfter.status,
          isVerified: statusAfter.isVerified,
        });
      }

      return {
        businessId,
        statusUpdated,
        newStatus: statusAfter.status,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logError(`Failed to check TFV status for business ${businessId}:`, {
        businessId,
        error: errorMessage,
      });

      return {
        businessId,
        statusUpdated: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Start periodic checking with a specified interval
   * @param intervalMs - Interval in milliseconds (default: 1 hour)
   */
  static startPeriodicCheck(
    intervalMs: number = 60 * 60 * 1000
  ): NodeJS.Timeout {
    logInfo(`Starting periodic TFV status check with ${intervalMs}ms interval`);

    return setInterval(async () => {
      try {
        await this.checkAllBusinesses();
      } catch (error) {
        logError("Periodic TFV check failed:", error);
      }
    }, intervalMs);
  }

  /**
   * Get statistics about TFV verification statuses
   */
  static async getTFVStats(): Promise<{
    totalBusinesses: number;
    businessesWithPhones: number;
    verified: number;
    pending: number;
    denied: number;
    notSubmitted: number;
  }> {
    try {
      // Get all businesses
      const allBusinesses = await db
        .select({ id: businesses.id })
        .from(businesses);

      let businessesWithPhones = 0;
      let verified = 0;
      let pending = 0;
      let denied = 0;
      let notSubmitted = 0;

      for (const business of allBusinesses) {
        try {
          const bizStorage = storage.forBusiness(business.id);
          const tfvStatus = await bizStorage.getTFVVerificationStatus();

          if (tfvStatus.hasPhoneNumbers) {
            businessesWithPhones++;

            if (tfvStatus.isVerified) {
              verified++;
            } else {
              switch (tfvStatus.status) {
                case "pending":
                  pending++;
                  break;
                case "denied":
                  denied++;
                  break;
                case "not_submitted":
                  notSubmitted++;
                  break;
              }
            }
          }
        } catch (error) {
          logError(
            `Failed to get TFV status for business ${business.id}:`,
            error
          );
        }
      }

      return {
        totalBusinesses: allBusinesses.length,
        businessesWithPhones,
        verified,
        pending,
        denied,
        notSubmitted,
      };
    } catch (error) {
      logError("Failed to get TFV stats:", error);
      throw error;
    }
  }
}
