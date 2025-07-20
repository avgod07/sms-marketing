import twilio from "twilio";
import { logInfo, logError } from "../utils/logger.util";
import { submitTollFreeVerification } from "./tfv.js";
import { storage } from "../db/storage.js";

interface PhonePurchaseAuditResult {
  success: boolean;
  message: string;
  details?: any;
  recommendations?: string[];
}

interface BusinessData {
  businessId: number;
  businessName: string;
  websiteUrl?: string;
  address?: {
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  contact?: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  };
  useCases: string[];
  monthlyVolume: string;
}

/**
 * Comprehensive Phone Purchase and TFV Audit Service
 * Tests the complete flow from number purchase to TFV submission
 */
export class PhonePurchaseAuditService {
  private client: twilio.Twilio;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required");
    }

    this.client = twilio(accountSid, authToken);
  }

  /**
   * STEP 1: Audit available toll-free numbers for purchase
   */
  async auditAvailableNumbers(
    areaCode?: string
  ): Promise<PhonePurchaseAuditResult> {
    logInfo("Auditing available toll-free numbers", { areaCode });

    try {
      // Search for available toll-free numbers
      const availableNumbers = await this.client
        .availablePhoneNumbers("US")
        .tollFree.list({
          limit: 20,
          contains: areaCode || undefined,
        });

      if (availableNumbers.length === 0) {
        return {
          success: false,
          message: "No toll-free numbers available for purchase",
          recommendations: [
            "Try searching with different area codes",
            "Contact Twilio support if no numbers are available",
          ],
        };
      }

      logInfo("Found available toll-free numbers", {
        count: availableNumbers.length,
        examples: availableNumbers.slice(0, 3).map((n) => n.phoneNumber),
      });

      return {
        success: true,
        message: `${availableNumbers.length} toll-free numbers available for purchase`,
        details: {
          availableNumbers: availableNumbers.map((num) => ({
            phoneNumber: num.phoneNumber,
            friendlyName: num.friendlyName,
            locality: num.locality,
            region: num.region,
            capabilities: num.capabilities,
          })),
        },
      };
    } catch (error: any) {
      logError("Failed to search available numbers", error);
      return {
        success: false,
        message: "Failed to search available toll-free numbers",
        details: { error: error.message },
        recommendations: [
          "Check Twilio API credentials",
          "Verify account has phone number purchasing permissions",
        ],
      };
    }
  }

  /**
   * STEP 2: Audit business data completeness for TFV
   */
  async auditBusinessDataCompleteness(
    businessData: BusinessData
  ): Promise<PhonePurchaseAuditResult> {
    logInfo("Auditing business data completeness for TFV", {
      businessId: businessData.businessId,
    });

    const missingFields: string[] = [];
    const warnings: string[] = [];

    // Required fields for TFV
    if (!businessData.businessName) missingFields.push("Business name");
    if (!businessData.websiteUrl) missingFields.push("Website URL");
    if (!businessData.useCases || businessData.useCases.length === 0) {
      missingFields.push("Use cases");
    }
    if (!businessData.monthlyVolume) missingFields.push("Monthly volume");

    // Address validation
    if (!businessData.address) {
      missingFields.push("Business address");
    } else {
      if (!businessData.address.address1) missingFields.push("Street address");
      if (!businessData.address.city) missingFields.push("City");
      if (!businessData.address.state) missingFields.push("State");
      if (!businessData.address.postalCode) missingFields.push("Postal code");
    }

    // Contact information validation
    if (!businessData.contact) {
      missingFields.push("Contact information");
    } else {
      if (!businessData.contact.firstName)
        missingFields.push("Contact first name");
      if (!businessData.contact.lastName)
        missingFields.push("Contact last name");
      if (!businessData.contact.email) missingFields.push("Contact email");
      if (!businessData.contact.phoneNumber)
        missingFields.push("Contact phone");
    }

    // Website URL format validation
    if (
      businessData.websiteUrl &&
      !businessData.websiteUrl.match(/^https?:\/\/[^\s]+\.[^\s]+/)
    ) {
      warnings.push("Website URL should be a valid HTTP/HTTPS URL");
    }

    // Use case validation
    const validUseCases = [
      "ACCOUNT_NOTIFICATIONS",
      "MARKETING",
      "CUSTOMER_SUPPORT",
      "MIXED",
    ];
    if (
      businessData.useCases.some((useCase) => !validUseCases.includes(useCase))
    ) {
      warnings.push("Some use cases may not be valid for TFV submission");
    }

    if (missingFields.length > 0) {
      return {
        success: false,
        message: "Business data incomplete for TFV submission",
        details: {
          missingFields,
          warnings,
          dataCompleteness: {
            hasBusinessName: !!businessData.businessName,
            hasWebsite: !!businessData.websiteUrl,
            hasAddress: !!businessData.address,
            hasContact: !!businessData.contact,
            hasUseCases: businessData.useCases.length > 0,
            hasVolume: !!businessData.monthlyVolume,
          },
        },
        recommendations: [
          "Complete business onboarding process",
          "Ensure all required fields are filled",
          "Verify business information is accurate",
        ],
      };
    }

    return {
      success: true,
      message: "Business data is complete for TFV submission",
      details: {
        warnings,
        dataCompleteness: {
          businessName: businessData.businessName,
          websiteUrl: businessData.websiteUrl,
          hasCompleteAddress: true,
          hasCompleteContact: true,
          useCasesCount: businessData.useCases.length,
          monthlyVolume: businessData.monthlyVolume,
        },
      },
      recommendations:
        warnings.length > 0
          ? ["Review warnings to ensure optimal TFV approval chances"]
          : [],
    };
  }

  /**
   * STEP 3: Simulate phone number purchase (without actually purchasing)
   */
  async auditPhonePurchaseProcess(
    testMode = true
  ): Promise<PhonePurchaseAuditResult> {
    logInfo("Auditing phone purchase process", { testMode });

    try {
      // Get available numbers first
      const availableResult = await this.auditAvailableNumbers();
      if (!availableResult.success) {
        return availableResult;
      }

      const testNumber = availableResult.details?.availableNumbers[0];
      if (!testNumber) {
        return {
          success: false,
          message: "No test number available for purchase simulation",
          recommendations: [
            "Ensure toll-free numbers are available for purchase",
          ],
        };
      }

      if (testMode) {
        // Simulate purchase without actually buying
        logInfo("Simulating phone purchase", {
          phoneNumber: testNumber.phoneNumber,
        });

        return {
          success: true,
          message: "Phone purchase process validation successful",
          details: {
            simulatedPurchase: {
              phoneNumber: testNumber.phoneNumber,
              estimatedCost: "USD 1.00/month",
              capabilities: testNumber.capabilities,
              region: testNumber.region,
            },
            nextSteps: [
              "Number would be purchased",
              "Messaging service would be created/configured",
              "TFV submission would be triggered automatically",
            ],
          },
        };
      } else {
        // Actually purchase the number (use with caution!)
        logInfo("Actually purchasing phone number", {
          phoneNumber: testNumber.phoneNumber,
        });

        const purchasedNumber = await this.client.incomingPhoneNumbers.create({
          phoneNumber: testNumber.phoneNumber,
          smsUrl: process.env.TWILIO_WEBHOOK_URL || undefined,
        });

        return {
          success: true,
          message: "Phone number purchased successfully",
          details: {
            purchasedNumber: {
              sid: purchasedNumber.sid,
              phoneNumber: purchasedNumber.phoneNumber,
              friendlyName: purchasedNumber.friendlyName,
              capabilities: purchasedNumber.capabilities,
            },
          },
          recommendations: [
            "Number is now ready for TFV submission",
            "Configure messaging service if needed",
          ],
        };
      }
    } catch (error: any) {
      logError("Phone purchase audit failed", error);
      return {
        success: false,
        message: "Phone purchase process failed",
        details: {
          error: error.message,
          code: error.code,
        },
        recommendations: [
          "Check account balance and permissions",
          "Verify phone number is still available",
          "Contact Twilio support for purchase issues",
        ],
      };
    }
  }

  /**
   * STEP 4: Audit TFV auto-submission process
   */
  async auditTFVAutoSubmission(
    businessData: BusinessData,
    phoneNumberSid: string
  ): Promise<PhonePurchaseAuditResult> {
    logInfo("Auditing TFV auto-submission process", {
      businessId: businessData.businessId,
      phoneNumberSid,
    });

    try {
      // Validate business data first
      const dataValidation = await this.auditBusinessDataCompleteness(
        businessData
      );
      if (!dataValidation.success) {
        return {
          success: false,
          message: "Cannot submit TFV: business data incomplete",
          details: dataValidation.details,
          recommendations: dataValidation.recommendations,
        };
      }

      // Check if Customer Profile exists and is approved
      const profileSid = process.env.TWILIO_BUSINESS_PROFILE_SID;
      if (!profileSid) {
        return {
          success: false,
          message: "No Customer Profile configured",
          recommendations: [
            "Create Trust Hub Customer Profile first",
            "Set TWILIO_BUSINESS_PROFILE_SID environment variable",
          ],
        };
      }

      // Verify Customer Profile status
      try {
        const profile = await this.client.trusthub.v1
          .customerProfiles(profileSid)
          .fetch();
        if (profile.status !== "twilio-approved") {
          return {
            success: false,
            message: `Customer Profile not approved: ${profile.status}`,
            details: { profileStatus: profile.status },
            recommendations: [
              "Wait for Customer Profile approval",
              "Check email for approval notification",
            ],
          };
        }
      } catch (profileError: any) {
        return {
          success: false,
          message: "Customer Profile validation failed",
          details: { error: profileError.message },
          recommendations: [
            "Verify TWILIO_BUSINESS_PROFILE_SID is correct",
            "Create new Customer Profile if needed",
          ],
        };
      }

      // Get business from storage and create proper TFV config
      const business = await storage
        .forBusiness(businessData.businessId)
        .getBusiness();
      const baseUrl = process.env.BASE_URL || "https://localhost:3000";

      // Create a minimal config object with required properties
      const tfvConfig = {
        id: 0, // Temporary ID for audit
        createdAt: new Date(),
        businessId: businessData.businessId,
        useCases: businessData.useCases,
        volume: businessData.monthlyVolume,
        updatedAt: new Date(),
      };

      logInfo("Submitting TFV request", {
        businessId: businessData.businessId,
        phoneNumberSid,
        useCases: businessData.useCases,
        volume: businessData.monthlyVolume,
      });

      const tfvResult = await submitTollFreeVerification(
        phoneNumberSid,
        business,
        tfvConfig,
        businessData.businessId,
        baseUrl,
        businessData.contact?.email,
        businessData.address,
        businessData.websiteUrl,
        businessData.contact
      );

      logInfo("TFV submission successful", {
        tfvSid: tfvResult.tfvSid,
        status: tfvResult.status,
      });

      return {
        success: true,
        message: "TFV auto-submission successful",
        details: {
          tfvSid: tfvResult.tfvSid,
          status: tfvResult.status,
          phoneNumber: tfvResult.phoneNumber,
          submissionData: {
            businessName: businessData.businessName,
            websiteUrl: businessData.websiteUrl,
            useCases: businessData.useCases,
            monthlyVolume: businessData.monthlyVolume,
            hasCompleteAddress: !!businessData.address,
            hasCompleteContact: !!businessData.contact,
          },
        },
        recommendations: [
          "TFV is now pending review (typically 2-5 business days)",
          "Monitor TFV status via API or Twilio Console",
          "Check email for approval/rejection notifications",
        ],
      };
    } catch (error: any) {
      logError("TFV auto-submission failed", error);
      return {
        success: false,
        message: "TFV auto-submission failed",
        details: {
          error: error.message,
          businessId: businessData.businessId,
          phoneNumberSid,
        },
        recommendations: [
          "Check business data completeness",
          "Verify Customer Profile is approved",
          "Review TFV submission requirements",
        ],
      };
    }
  }

  /**
   * STEP 5: Comprehensive audit of entire purchase-to-TFV flow
   */
  async auditCompleteFlow(
    businessData: BusinessData,
    options: {
      testMode?: boolean;
      purchaseNumber?: boolean;
      areaCode?: string;
    } = {}
  ): Promise<{
    overall: { success: boolean; message: string };
    results: Record<string, PhonePurchaseAuditResult>;
    recommendations: string[];
  }> {
    logInfo("Starting comprehensive phone purchase audit", {
      businessId: businessData.businessId,
      options,
    });

    const results: Record<string, PhonePurchaseAuditResult> = {};

    // Step 1: Check available numbers
    results.availableNumbers = await this.auditAvailableNumbers(
      options.areaCode
    );

    // Step 2: Validate business data
    results.businessData = await this.auditBusinessDataCompleteness(
      businessData
    );

    // Step 3: Test purchase process
    results.purchaseProcess = await this.auditPhonePurchaseProcess(
      options.testMode !== false
    );

    // Step 4: If purchasing is enabled and data is complete, test TFV submission
    if (
      options.purchaseNumber &&
      results.businessData.success &&
      results.purchaseProcess.success
    ) {
      // Get a phone number SID (either from purchase or mock)
      const phoneNumberSid =
        results.purchaseProcess.details?.purchasedNumber?.sid ||
        "PN" + Math.random().toString(36).substring(2); // Mock SID for testing

      results.tfvSubmission = await this.auditTFVAutoSubmission(
        businessData,
        phoneNumberSid
      );
    }

    // Determine overall status
    const allResults = Object.values(results);
    const allPassed = allResults.every((r) => r.success);
    const criticalFailed =
      !results.businessData.success || !results.availableNumbers.success;

    // Collect all recommendations
    const allRecommendations = allResults
      .flatMap((r) => r.recommendations || [])
      .filter((rec, index, self) => self.indexOf(rec) === index);

    let overallMessage: string;
    if (allPassed) {
      overallMessage = "🎉 Complete phone purchase and TFV flow is ready!";
    } else if (criticalFailed) {
      overallMessage =
        "❌ Critical issues found - phone purchase flow not ready";
    } else {
      overallMessage =
        "⚠️ Phone purchase flow partially ready - some issues found";
    }

    logInfo("Phone purchase audit completed", {
      overallSuccess: allPassed,
      criticalIssues: criticalFailed,
      businessId: businessData.businessId,
      resultsSummary: Object.fromEntries(
        Object.entries(results).map(([key, result]) => [key, result.success])
      ),
    });

    return {
      overall: {
        success: allPassed,
        message: overallMessage,
      },
      results,
      recommendations: allRecommendations,
    };
  }
}
