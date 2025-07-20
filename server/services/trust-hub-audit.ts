import twilio from "twilio";
import { logInfo, logError } from "../utils/logger.util";

interface TrustHubAuditResult {
  success: boolean;
  message: string;
  details?: any;
  recommendations?: string[];
}

interface CustomerProfileData {
  businessName: string;
  websiteUrl: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  businessType: "CORPORATION" | "LLC" | "PARTNERSHIP" | "SOLE_PROPRIETORSHIP";
  industryType: string;
  regionsOfOperation: string[];
}

/**
 * Comprehensive Trust Hub and TFV Audit Service
 * Follows Twilio's official documentation for toll-free verification
 */
export class TrustHubAuditService {
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
   * STEP 1: Verify environment configuration
   */
  async auditEnvironmentConfig(): Promise<TrustHubAuditResult> {
    logInfo("Starting environment configuration audit");

    const requiredVars = [
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN",
      "TWILIO_BUSINESS_PROFILE_SID",
      "TWILIO_PHONE_NUMBER",
    ];

    const missing = requiredVars.filter((varName) => !process.env[varName]);

    if (missing.length > 0) {
      return {
        success: false,
        message: "Missing required environment variables",
        details: { missingVariables: missing },
        recommendations: [
          "Set up all required Twilio environment variables",
          "Create a Trust Hub Primary Customer Profile first",
          "Get the Customer Profile SID from Twilio Console",
        ],
      };
    }

    // Test Twilio connection
    try {
      const account = await this.client.api
        .accounts(process.env.TWILIO_ACCOUNT_SID!)
        .fetch();
      logInfo("Twilio connection successful", {
        accountType: account.type,
        status: account.status,
      });

      return {
        success: true,
        message: "Environment configuration is valid",
        details: {
          accountType: account.type,
          status: account.status,
          configuredVariables: requiredVars,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: "Failed to connect to Twilio",
        details: { error: error.message },
        recommendations: [
          "Verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are correct",
          "Check Twilio account status",
        ],
      };
    }
  }

  /**
   * STEP 2: Audit existing Customer Profile
   */
  async auditCustomerProfile(): Promise<TrustHubAuditResult> {
    logInfo("Starting Customer Profile audit");

    const profileSid = process.env.TWILIO_BUSINESS_PROFILE_SID;
    if (!profileSid) {
      return {
        success: false,
        message: "No Customer Profile SID configured",
        recommendations: [
          "Create a Trust Hub Primary Customer Profile",
          "Set TWILIO_BUSINESS_PROFILE_SID environment variable",
        ],
      };
    }

    try {
      const profile = await this.client.trusthub.v1
        .customerProfiles(profileSid)
        .fetch();

      logInfo("Customer Profile audit result", {
        sid: profile.sid,
        status: profile.status,
        friendlyName: profile.friendlyName,
      });

      if (profile.status !== "twilio-approved") {
        return {
          success: false,
          message: `Customer Profile not approved: ${profile.status}`,
          details: {
            status: profile.status,
            sid: profile.sid,
            friendlyName: profile.friendlyName,
          },
          recommendations: [
            "Wait for Twilio to approve your Customer Profile (typically 24-48 hours)",
            "Check your email for approval notification",
            "Review submitted information for accuracy",
          ],
        };
      }

      return {
        success: true,
        message: "Customer Profile is approved and ready",
        details: {
          status: profile.status,
          sid: profile.sid,
          friendlyName: profile.friendlyName,
          dateCreated: profile.dateCreated,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: "Failed to fetch Customer Profile",
        details: {
          error: error.message,
          profileSid,
        },
        recommendations: [
          "Verify TWILIO_BUSINESS_PROFILE_SID is correct",
          "Create a new Customer Profile if this one doesn't exist",
        ],
      };
    }
  }

  /**
   * STEP 3: Create Customer Profile if needed
   */
  async createCustomerProfile(
    data: CustomerProfileData
  ): Promise<TrustHubAuditResult> {
    logInfo("Creating new Customer Profile", {
      businessName: data.businessName,
    });

    try {
      // First, create the Primary Customer Profile
      const profile = await this.client.trusthub.v1.customerProfiles.create({
        friendlyName: `${data.businessName} - Primary Profile`,
        email: data.contact.email,
        statusCallback: undefined, // Optional webhook URL
        policySid: "RNaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", // Primary Customer Profile policy
      });

      logInfo("Customer Profile created", { sid: profile.sid });

      // Now we need to create EndUser records for business and contact info
      const businessEndUser = await this.client.trusthub.v1.endUsers.create({
        friendlyName: `${data.businessName} - Business Info`,
        type: "business",
        attributes: {
          business_name: data.businessName,
          business_registration_number: "", // You'll need to collect this
          business_type: data.businessType,
          business_industry: data.industryType,
          business_regions_of_operation: data.regionsOfOperation,
          business_address: {
            street: data.address.street,
            city: data.address.city,
            state: data.address.state,
            postal_code: data.address.postalCode,
            country: data.address.country,
          },
          website: data.websiteUrl,
        },
      });

      const contactEndUser = await this.client.trusthub.v1.endUsers.create({
        friendlyName: `${data.contact.firstName} ${data.contact.lastName} - Contact`,
        type: "individual",
        attributes: {
          first_name: data.contact.firstName,
          last_name: data.contact.lastName,
          email: data.contact.email,
          phone_number: data.contact.phone,
        },
      });

      // Assign EndUsers to Customer Profile
      await this.client.trusthub.v1
        .customerProfiles(profile.sid)
        .customerProfilesEntityAssignments.create({
          objectSid: businessEndUser.sid,
        });

      await this.client.trusthub.v1
        .customerProfiles(profile.sid)
        .customerProfilesEntityAssignments.create({
          objectSid: contactEndUser.sid,
        });

      // Submit for review
      await this.client.trusthub.v1
        .customerProfiles(profile.sid)
        .customerProfilesEvaluations.create({
          policySid: "RNaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        });

      return {
        success: true,
        message: "Customer Profile created and submitted for review",
        details: {
          profileSid: profile.sid,
          businessEndUserSid: businessEndUser.sid,
          contactEndUserSid: contactEndUser.sid,
          status: "pending_review",
        },
        recommendations: [
          `Set TWILIO_BUSINESS_PROFILE_SID=${profile.sid} in your environment`,
          "Wait 24-48 hours for Twilio approval",
          "Check your email for approval notification",
        ],
      };
    } catch (error: any) {
      logError("Failed to create Customer Profile", error);
      return {
        success: false,
        message: "Failed to create Customer Profile",
        details: { error: error.message },
        recommendations: [
          "Check that all required business information is provided",
          "Ensure business registration details are accurate",
          "Contact Twilio support if issues persist",
        ],
      };
    }
  }

  /**
   * STEP 4: Audit toll-free numbers and TFV status
   */
  async auditTollFreeNumbers(): Promise<TrustHubAuditResult> {
    logInfo("Starting toll-free number audit");

    try {
      // Get all phone numbers
      const phoneNumbers = await this.client.incomingPhoneNumbers.list({
        limit: 1000,
      });
      const tollFreeNumbers = phoneNumbers.filter((num) =>
        num.phoneNumber.match(/^\+1(800|833|844|855|866|877|888)/)
      );

      if (tollFreeNumbers.length === 0) {
        return {
          success: false,
          message: "No toll-free numbers found",
          recommendations: [
            "Purchase a toll-free number from Twilio",
            "Toll-free numbers are required for TFV compliance",
          ],
        };
      }

      // Check TFV status for each toll-free number
      const tfvStatuses = [];
      for (const number of tollFreeNumbers) {
        try {
          const verifications =
            await this.client.messaging.v1.tollfreeVerifications.list({
              tollfreePhoneNumberSid: number.sid,
              limit: 20,
            });

          const latestVerification = verifications[0];
          tfvStatuses.push({
            phoneNumber: number.phoneNumber,
            phoneSid: number.sid,
            tfvStatus: latestVerification
              ? latestVerification.status
              : "not_submitted",
            tfvSid: latestVerification?.sid,
          });
        } catch (error) {
          tfvStatuses.push({
            phoneNumber: number.phoneNumber,
            phoneSid: number.sid,
            tfvStatus: "error",
            error: error,
          });
        }
      }

      const approvedNumbers = tfvStatuses.filter(
        (n) => n.tfvStatus === "twilio-approved"
      );
      const pendingNumbers = tfvStatuses.filter(
        (n) => n.tfvStatus === "in-review" || n.tfvStatus === "pending-review"
      );
      const unverifiedNumbers = tfvStatuses.filter(
        (n) => n.tfvStatus === "not_submitted"
      );

      logInfo("TFV audit results", {
        totalTollFree: tollFreeNumbers.length,
        approved: approvedNumbers.length,
        pending: pendingNumbers.length,
        unverified: unverifiedNumbers.length,
      });

      const hasApprovedNumbers = approvedNumbers.length > 0;

      return {
        success: hasApprovedNumbers,
        message: hasApprovedNumbers
          ? `${approvedNumbers.length} toll-free numbers approved for messaging`
          : "No approved toll-free numbers for messaging",
        details: {
          tollFreeNumbers: tfvStatuses,
          summary: {
            total: tollFreeNumbers.length,
            approved: approvedNumbers.length,
            pending: pendingNumbers.length,
            unverified: unverifiedNumbers.length,
          },
        },
        recommendations: hasApprovedNumbers
          ? []
          : [
              "Submit TFV requests for unverified numbers",
              "Wait for pending verifications to be approved",
              "Ensure business information is complete and accurate",
            ],
      };
    } catch (error: any) {
      return {
        success: false,
        message: "Failed to audit toll-free numbers",
        details: { error: error.message },
        recommendations: [
          "Check Twilio API credentials",
          "Verify account has necessary permissions",
        ],
      };
    }
  }

  /**
   * STEP 5: Test message sending capability
   */
  async auditMessageSending(
    testPhoneNumber: string
  ): Promise<TrustHubAuditResult> {
    logInfo("Starting message sending audit", { testPhoneNumber });

    try {
      // Get approved toll-free numbers
      const auditResult = await this.auditTollFreeNumbers();
      if (!auditResult.success) {
        return {
          success: false,
          message: "Cannot test messaging: no approved toll-free numbers",
          recommendations: [
            "Complete TFV process first",
            "Wait for toll-free verification approval",
          ],
        };
      }

      const approvedNumber = auditResult.details?.tollFreeNumbers.find(
        (n: any) => n.tfvStatus === "twilio-approved"
      );

      if (!approvedNumber) {
        return {
          success: false,
          message: "No approved toll-free numbers available for testing",
          recommendations: [
            "Wait for TFV approval",
            "Check TFV status in Twilio Console",
          ],
        };
      }

      // Send test message
      const message = await this.client.messages.create({
        body: "Test message from Twilio TFV audit system. Reply STOP to unsubscribe.",
        from: approvedNumber.phoneNumber,
        to: testPhoneNumber,
      });

      logInfo("Test message sent successfully", {
        messageSid: message.sid,
        from: approvedNumber.phoneNumber,
        to: testPhoneNumber,
      });

      return {
        success: true,
        message: "Message sending is working correctly",
        details: {
          messageSid: message.sid,
          from: approvedNumber.phoneNumber,
          to: testPhoneNumber,
          status: message.status,
        },
      };
    } catch (error: any) {
      logError("Message sending test failed", error);
      return {
        success: false,
        message: "Message sending failed",
        details: {
          error: error.message,
          code: error.code,
        },
        recommendations: [
          "Check if toll-free number is properly verified",
          "Verify recipient phone number is valid",
          "Check account balance and permissions",
        ],
      };
    }
  }

  /**
   * STEP 6: Comprehensive audit of entire pipeline
   */
  async auditComplete(testPhoneNumber?: string): Promise<{
    overall: { success: boolean; message: string };
    results: Record<string, TrustHubAuditResult>;
    recommendations: string[];
  }> {
    logInfo("Starting comprehensive TFV pipeline audit");

    const results: Record<string, TrustHubAuditResult> = {};

    // Step 1: Environment
    results.environment = await this.auditEnvironmentConfig();

    // Step 2: Customer Profile
    results.customerProfile = await this.auditCustomerProfile();

    // Step 3: Toll-free numbers
    results.tollFreeNumbers = await this.auditTollFreeNumbers();

    // Step 4: Message sending (if test number provided)
    if (testPhoneNumber) {
      results.messageSending = await this.auditMessageSending(testPhoneNumber);
    }

    // Determine overall status
    const allResults = Object.values(results);
    const allPassed = allResults.every((r) => r.success);
    const criticalFailed =
      !results.environment.success || !results.customerProfile.success;

    // Collect all recommendations
    const allRecommendations = allResults
      .flatMap((r) => r.recommendations || [])
      .filter((rec, index, self) => self.indexOf(rec) === index); // Deduplicate

    let overallMessage: string;
    if (allPassed) {
      overallMessage = "🎉 Complete TFV pipeline is working perfectly!";
    } else if (criticalFailed) {
      overallMessage =
        "❌ Critical setup issues found - TFV pipeline not operational";
    } else {
      overallMessage = "⚠️ TFV pipeline partially working - some issues found";
    }

    logInfo("Comprehensive audit completed", {
      overallSuccess: allPassed,
      criticalIssues: criticalFailed,
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
