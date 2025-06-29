import { z } from "zod";

/**
 * Simple phone number validation schema
 * Validates basic format and uses existing normalization
 */
export const phoneNumberSchema = z
  .string()
  .min(1, "Phone number is required")
  .refine(
    (val) => {
      const digits = val.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 11;
    },
    {
      message: "Please enter a valid 10-11 digit phone number",
    }
  );

/**
 * Contact phone number schema
 */
export const contactPhoneNumberSchema = phoneNumberSchema;

/**
 * Business phone number schema
 */
export const businessPhoneNumberSchema = phoneNumberSchema;

/**
 * Optional phone number schema
 */
export const optionalPhoneNumberSchema = z
  .string()
  .optional()
  .or(z.literal(""))
  .refine(
    (val) => {
      if (!val || val.trim() === "") return true;
      const digits = val.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 11;
    },
    {
      message: "Please enter a valid 10-11 digit phone number",
    }
  );
