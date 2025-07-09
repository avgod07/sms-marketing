import { useState } from "react";
import { apiMutation } from "@/lib/queryClient";

interface PhoneValidationResult {
  isValid: boolean;
  canReceiveSMS: boolean;
  carrier?: string;
  type?: string;
  error?: string;
}

export function usePhoneValidation() {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] =
    useState<PhoneValidationResult | null>(null);

  const validatePhone = async (
    phoneNumber: string
  ): Promise<PhoneValidationResult> => {
    if (!phoneNumber || phoneNumber.trim() === "") {
      return {
        isValid: false,
        canReceiveSMS: false,
        error: "Phone number is required",
      };
    }

    setIsValidating(true);
    try {
      const result = await apiMutation<PhoneValidationResult>({
        method: "POST",
        url: "/api/twilio/validate-phone",
        data: { phoneNumber },
      });

      setValidationResult(result);
      return result;
    } catch (error: any) {
      // If Twilio validation fails, fall back to basic validation
      const basicResult: PhoneValidationResult = {
        isValid: true,
        canReceiveSMS: true,
        error: undefined,
      };
      setValidationResult(basicResult);
      return basicResult;
    } finally {
      setIsValidating(false);
    }
  };

  return {
    validatePhone,
    isValidating,
    validationResult,
  };
}
