import type { IStorage } from "../db/storage.js";
import { logError, logInfo } from "./logger.util.js";

export interface SubaccountValidationResult {
  isValid: boolean;
  error?: string;
  phoneNumber?: string;
  subaccountSid?: string;
}

/**
 * Utility for validating subaccount setup and configuration
 * Used across services that require subaccount-only operation
 */
export class SubaccountValidationUtil {
  /**
   * Validate that business has proper subaccount setup with phone number
   * @param bizStore - Business storage instance
   * @returns Validation result with details
   */
  static async validateSubaccountSetup(
    bizStore: IStorage
  ): Promise<SubaccountValidationResult> {
    try {
      const business = await bizStore.getBusiness();

      // Check if business has subaccount provisioning
      if (!business.subaccountProvisioned) {
        logError("Business validation failed - no subaccount provisioning", {
          businessId: business.id,
          subaccountProvisioned: false,
        });

        return {
          isValid: false,
          error:
            "Business requires subaccount provisioning. Please complete your business setup.",
        };
      }

      // Check if subaccount has phone number configured
      const subaccountCreds = await bizStore.getSubaccountCredentials();
      if (!subaccountCreds?.phoneNumber) {
        logError("Business validation failed - no subaccount phone number", {
          businessId: business.id,
          subaccountProvisioned: true,
          hasSubaccountCreds: !!subaccountCreds,
          hasPhoneNumber: !!subaccountCreds?.phoneNumber,
        });

        return {
          isValid: false,
          error:
            "No phone number configured in subaccount. Please complete your phone setup.",
        };
      }

      logInfo("Business subaccount validation passed", {
        businessId: business.id,
        phoneNumber: subaccountCreds.phoneNumber,
        subaccountSid: subaccountCreds.subaccountSid,
      });

      return {
        isValid: true,
        phoneNumber: subaccountCreds.phoneNumber,
        subaccountSid: subaccountCreds.subaccountSid,
      };
    } catch (error) {
      logError("Error validating subaccount setup", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        isValid: false,
        error: "System error validating subaccount configuration",
      };
    }
  }

  /**
   * Quick check if business is ready for subaccount operations
   * @param bizStore - Business storage instance
   * @returns boolean indicating readiness
   */
  static async isSubaccountReady(bizStore: IStorage): Promise<boolean> {
    const result = await this.validateSubaccountSetup(bizStore);
    return result.isValid;
  }
}
