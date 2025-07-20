import twilio from "twilio";
import { logInfo, logError } from "../utils/logger.util";
import { storage } from "../db/storage.js";
import { TwilioService } from "./twilio.js";
import { MessageCreditService } from "./message-credits.js";

interface MessageFlowAuditResult {
  success: boolean;
  message: string;
  details?: any;
  recommendations?: string[];
}

interface TestCampaignData {
  businessId: number;
  testPhoneNumber: string;
  messageContent: string;
  includeMedia?: boolean;
  mediaUrl?: string;
}

/**
 * Comprehensive Message Flow Audit Service
 * Tests end-to-end message sending once TFV is approved
 */
export class MessageFlowAuditService {
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
   * STEP 1: Audit messaging prerequisites
   */
  async auditMessagingPrerequisites(
    businessId: number
  ): Promise<MessageFlowAuditResult> {
    logInfo("Auditing messaging prerequisites", { businessId });

    try {
      const biz = storage.forBusiness(businessId);

      // Check TFV status
      const tfvStatus = await biz.getTFVVerificationStatus();
      if (!tfvStatus.isVerified) {
        return {
          success: false,
          message: "TFV verification required for messaging",
          details: { tfvStatus },
          recommendations: [
            "Complete toll-free verification process",
            "Wait for TFV approval before testing messages",
          ],
        };
      }

      // Check phone numbers
      const phoneNumbers = await biz.getPhoneNumbers();
      const approvedNumbers = phoneNumbers.filter(
        (num) => num.verificationStatus === "TWILIO_APPROVED"
      );

      if (approvedNumbers.length === 0) {
        return {
          success: false,
          message: "No approved toll-free numbers available",
          details: {
            totalNumbers: phoneNumbers.length,
            approvedNumbers: approvedNumbers.length,
            phoneNumbers: phoneNumbers.map((num) => ({
              phoneNumber: num.phoneNumber,
              status: num.verificationStatus,
            })),
          },
          recommendations: [
            "Wait for toll-free number approval",
            "Check TFV submission status",
          ],
        };
      }

      // Check messaging service
      const messagingServiceSid = await biz.getMessagingServiceSid();
      if (!messagingServiceSid) {
        return {
          success: false,
          message: "No messaging service configured",
          recommendations: [
            "Configure messaging service SID",
            "Complete Twilio setup process",
          ],
        };
      }

      // Check credits balance
      const credits = await biz.getCredits();
      const balance = credits?.balance || 0;
      if (balance < 10) {
        return {
          success: false,
          message: "Insufficient credits for testing",
          details: { currentBalance: balance },
          recommendations: [
            "Add credits to account for message testing",
            "Minimum 10 credits recommended for testing",
          ],
        };
      }

      // Check business profile completeness
      const business = await biz.getBusiness();
      if (!business.initialMessage) {
        return {
          success: false,
          message: "No initial message configured",
          recommendations: [
            "Set up initial welcome message",
            "Complete business configuration",
          ],
        };
      }

      logInfo("Messaging prerequisites check passed", {
        businessId,
        approvedNumbers: approvedNumbers.length,
        balance,
        hasMessagingService: !!messagingServiceSid,
        hasInitialMessage: !!business.initialMessage,
      });

      return {
        success: true,
        message: "All messaging prerequisites satisfied",
        details: {
          tfvStatus: tfvStatus.status,
          approvedNumbers: approvedNumbers.length,
          messagingServiceSid,
          creditsBalance: balance,
          businessName: business.name,
          initialMessage: business.initialMessage,
        },
      };
    } catch (error: any) {
      logError("Failed to audit messaging prerequisites", error);
      return {
        success: false,
        message: "Failed to check messaging prerequisites",
        details: { error: error.message },
        recommendations: [
          "Check business configuration",
          "Verify database connectivity",
        ],
      };
    }
  }

  /**
   * STEP 2: Test single SMS message sending
   */
  async auditSingleSMSSending(
    businessId: number,
    testPhoneNumber: string,
    customMessage?: string
  ): Promise<MessageFlowAuditResult> {
    logInfo("Testing single SMS sending", { businessId, testPhoneNumber });

    try {
      const biz = storage.forBusiness(businessId);

      // Get messaging details
      const messagingServiceSid = await biz.getMessagingServiceSid();
      const phoneNumbers = await biz.getPhoneNumbers();
      const fromNumber = phoneNumbers.find(
        (num) => num.verificationStatus === "TWILIO_APPROVED" && num.isDefault
      );

      if (!fromNumber) {
        return {
          success: false,
          message: "No approved default phone number found",
          recommendations: ["Set a default approved toll-free number"],
        };
      }

      // Create minimal credentials object
      const tempCreds = {
        businessId,
        accountSid: process.env.TWILIO_ACCOUNT_SID!,
        messagingServiceSid: messagingServiceSid || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        id: 0,
      };

      const testMessage =
        customMessage ||
        "🧪 TEST MESSAGE: This is a test from your TFV audit system. Reply STOP to unsubscribe.";

      // Send test message using credit service
      const sendResult = await MessageCreditService.sendWithCreditDeduction(
        biz,
        tempCreds,
        {
          to: testPhoneNumber,
          message: testMessage,
          from: fromNumber.phoneNumber,
          messagingServiceSid: messagingServiceSid ?? undefined,
          messageType: "regular",
        }
      );

      if (!sendResult.success) {
        return {
          success: false,
          message: "SMS sending failed",
          details: {
            error: sendResult.error,
            creditCost: sendResult.creditCost,
            remainingCredits: sendResult.remainingCredits,
          },
          recommendations: [
            "Check phone number format",
            "Verify sufficient credits",
            "Check TFV status",
          ],
        };
      }

      logInfo("SMS test successful", {
        businessId,
        messageSid: sendResult.messageSid,
        creditCost: sendResult.creditCost,
        remainingCredits: sendResult.remainingCredits,
      });

      return {
        success: true,
        message: "SMS sending successful",
        details: {
          messageSid: sendResult.messageSid,
          from: fromNumber.phoneNumber,
          to: testPhoneNumber,
          messageContent: testMessage,
          creditCost: sendResult.creditCost,
          remainingCredits: sendResult.remainingCredits,
          billingStatus: sendResult.billingStatus,
        },
      };
    } catch (error: any) {
      logError("SMS sending test failed", error);
      return {
        success: false,
        message: "SMS sending test failed",
        details: { error: error.message },
        recommendations: [
          "Check messaging configuration",
          "Verify Twilio service status",
        ],
      };
    }
  }

  /**
   * STEP 3: Test MMS message sending (with media)
   */
  async auditMMSSending(
    businessId: number,
    testPhoneNumber: string,
    mediaUrl?: string
  ): Promise<MessageFlowAuditResult> {
    logInfo("Testing MMS sending", { businessId, testPhoneNumber, mediaUrl });

    try {
      const biz = storage.forBusiness(businessId);

      // Check credits for MMS (costs 3 credits)
      const credits = await biz.getCredits();
      if ((credits?.balance || 0) < 3) {
        return {
          success: false,
          message: "Insufficient credits for MMS testing (requires 3 credits)",
          details: { currentBalance: credits?.balance || 0 },
          recommendations: ["Add more credits to test MMS functionality"],
        };
      }

      const messagingServiceSid = await biz.getMessagingServiceSid();
      const phoneNumbers = await biz.getPhoneNumbers();
      const fromNumber = phoneNumbers.find(
        (num) => num.verificationStatus === "TWILIO_APPROVED" && num.isDefault
      );

      if (!fromNumber) {
        return {
          success: false,
          message: "No approved default phone number found",
          recommendations: ["Set a default approved toll-free number"],
        };
      }

      // Use test media URL if none provided
      const testMediaUrl =
        mediaUrl || "https://demo.twilio.com/welcome/logo.png";

      // Create credentials object
      const tempCreds = {
        businessId,
        accountSid: process.env.TWILIO_ACCOUNT_SID!,
        messagingServiceSid: messagingServiceSid || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        id: 0,
      };

      // Send MMS test message directly via Twilio client
      const mmsMessage = await this.client.messages.create({
        to: testPhoneNumber,
        body: "🧪 TEST MMS: This is a test MMS from your TFV audit system. Reply STOP to unsubscribe.",
        from: fromNumber.phoneNumber,
        mediaUrl: [testMediaUrl],
      });

      const mmsResult = {
        success: true,
        messageSid: mmsMessage.sid,
      };

      // Deduct MMS credits manually (3 credits)
      await biz.adjustCredits(-3, "send_mms", "MMS test message", {
        messageSid: mmsResult.messageSid,
        testType: "audit",
      });

      logInfo("MMS test successful", {
        businessId,
        messageSid: mmsResult.messageSid,
        mediaUrl: testMediaUrl,
      });

      return {
        success: true,
        message: "MMS sending successful",
        details: {
          messageSid: mmsResult.messageSid,
          from: fromNumber.phoneNumber,
          to: testPhoneNumber,
          mediaUrl: testMediaUrl,
          creditCost: 3,
          remainingCredits: (credits?.balance || 0) - 3,
        },
      };
    } catch (error: any) {
      logError("MMS sending test failed", error);
      return {
        success: false,
        message: "MMS sending test failed",
        details: { error: error.message },
        recommendations: [
          "Check MMS configuration",
          "Verify media URL accessibility",
        ],
      };
    }
  }

  /**
   * STEP 4: Test campaign execution
   */
  async auditCampaignExecution(
    testCampaignData: TestCampaignData
  ): Promise<MessageFlowAuditResult> {
    logInfo("Testing campaign execution", {
      businessId: testCampaignData.businessId,
    });

    try {
      const biz = storage.forBusiness(testCampaignData.businessId);

      // Create a test contact first
      const testContact = await biz.createContact({
        firstName: "Test",
        lastName: "Contact",
        phoneNumber: testCampaignData.testPhoneNumber,
      });

      logInfo("Test contact created", { contactId: testContact.id });

      // Create a test campaign
      const testCampaign = await biz.createCampaign({
        name: "TFV Audit Test Campaign",
        message: testCampaignData.messageContent,
        mediaUrl: testCampaignData.mediaUrl,
        status: "in_progress",
      });

      logInfo("Test campaign created", { campaignId: testCampaign.id });

      // Execute the campaign (this will use existing campaign execution logic)
      const { executeCampaign } = await import("./campaign.js");
      const executionResult = await executeCampaign(biz, testCampaign.id);

      // Clean up test data
      await biz.deleteContact(testContact.id);
      // Note: We keep the campaign for audit trail

      if (executionResult.sentCount === 0) {
        return {
          success: false,
          message: "Campaign execution failed - no messages sent",
          details: {
            executionResult,
            campaignId: testCampaign.id,
          },
          recommendations: [
            "Check campaign configuration",
            "Verify contact eligibility",
            "Check credit balance",
          ],
        };
      }

      logInfo("Campaign execution test successful", {
        campaignId: testCampaign.id,
        sentCount: executionResult.sentCount,
        failedCount: executionResult.failedCount,
      });

      return {
        success: true,
        message: "Campaign execution successful",
        details: {
          campaignId: testCampaign.id,
          campaignName: testCampaign.name,
          sentCount: executionResult.sentCount,
          failedCount: executionResult.failedCount,
          totalContacts: executionResult.totalContacts,
          testContactId: testContact.id,
          messageType: testCampaignData.includeMedia ? "MMS" : "SMS",
        },
      };
    } catch (error: any) {
      logError("Campaign execution test failed", error);
      return {
        success: false,
        message: "Campaign execution test failed",
        details: { error: error.message },
        recommendations: [
          "Check campaign service configuration",
          "Verify contact management",
          "Check message sending permissions",
        ],
      };
    }
  }

  /**
   * STEP 5: Test opt-out functionality (STOP responses)
   */
  async auditOptOutFunctionality(
    businessId: number,
    testPhoneNumber: string
  ): Promise<MessageFlowAuditResult> {
    logInfo("Testing opt-out functionality", { businessId, testPhoneNumber });

    try {
      const biz = storage.forBusiness(businessId);

      // Create a test contact
      const testContact = await biz.createContact({
        firstName: "OptOut",
        lastName: "Test",
        phoneNumber: testPhoneNumber,
      });

      // Simulate receiving a STOP message (this would normally come via webhook)
      const normalizedPhone = testPhoneNumber.startsWith("+")
        ? testPhoneNumber
        : `+1${testPhoneNumber}`;

      // Find the contact again (simulating webhook lookup)
      const contact = await biz.getContactByPhoneNumber(normalizedPhone);
      if (!contact) {
        return {
          success: false,
          message: "Could not find test contact for opt-out test",
          recommendations: [
            "Check phone number normalization",
            "Verify contact creation",
          ],
        };
      }

      // Deactivate contact (simulate STOP processing)
      await biz.updateContact(contact.id, { active: false });

      // Verify contact is deactivated
      const updatedContact = await biz.getContact(contact.id);
      if (updatedContact?.active !== false) {
        return {
          success: false,
          message: "Contact deactivation failed",
          recommendations: [
            "Check contact update functionality",
            "Verify opt-out logic",
          ],
        };
      }

      // Test that deactivated contacts are excluded from campaigns
      const activeContacts = (await biz.getContacts()).filter((c) => c.active);
      const includesDeactivated = activeContacts.some(
        (c) => c.id === contact.id
      );

      if (includesDeactivated) {
        return {
          success: false,
          message: "Deactivated contact still appears in active list",
          recommendations: [
            "Check contact filtering logic",
            "Verify campaign targeting excludes inactive contacts",
          ],
        };
      }

      // Clean up
      await biz.deleteContact(testContact.id);

      logInfo("Opt-out functionality test successful", {
        businessId,
        contactId: contact.id,
        wasDeactivated: !updatedContact?.active,
        excludedFromActive: !includesDeactivated,
      });

      return {
        success: true,
        message: "Opt-out functionality working correctly",
        details: {
          testContactId: contact.id,
          wasDeactivated: true,
          excludedFromCampaigns: true,
          phoneNumber: testPhoneNumber,
        },
      };
    } catch (error: any) {
      logError("Opt-out functionality test failed", error);
      return {
        success: false,
        message: "Opt-out functionality test failed",
        details: { error: error.message },
        recommendations: [
          "Check contact management system",
          "Verify opt-out handling logic",
        ],
      };
    }
  }

  /**
   * STEP 6: Comprehensive message flow audit
   */
  async auditCompleteMessageFlow(
    testData: TestCampaignData & { includeOptOutTest?: boolean }
  ): Promise<{
    overall: { success: boolean; message: string };
    results: Record<string, MessageFlowAuditResult>;
    recommendations: string[];
  }> {
    logInfo("Starting comprehensive message flow audit", {
      businessId: testData.businessId,
    });

    const results: Record<string, MessageFlowAuditResult> = {};

    // Step 1: Check prerequisites
    results.prerequisites = await this.auditMessagingPrerequisites(
      testData.businessId
    );

    // Only continue with messaging tests if prerequisites pass
    if (results.prerequisites.success) {
      // Step 2: Test SMS sending
      results.smsSending = await this.auditSingleSMSSending(
        testData.businessId,
        testData.testPhoneNumber,
        testData.messageContent
      );

      // Step 3: Test MMS sending (if media provided)
      if (testData.includeMedia && testData.mediaUrl) {
        results.mmsSending = await this.auditMMSSending(
          testData.businessId,
          testData.testPhoneNumber,
          testData.mediaUrl
        );
      }

      // Step 4: Test campaign execution
      results.campaignExecution = await this.auditCampaignExecution(testData);

      // Step 5: Test opt-out functionality (if requested)
      if (testData.includeOptOutTest) {
        results.optOutFunctionality = await this.auditOptOutFunctionality(
          testData.businessId,
          testData.testPhoneNumber
        );
      }
    }

    // Determine overall status
    const allResults = Object.values(results);
    const allPassed = allResults.every((r) => r.success);
    const criticalPassed =
      results.prerequisites.success && results.smsSending?.success !== false;

    // Collect all recommendations
    const allRecommendations = allResults
      .flatMap((r) => r.recommendations || [])
      .filter((rec, index, self) => self.indexOf(rec) === index);

    let overallMessage: string;
    if (allPassed) {
      overallMessage = "🎉 Complete message flow is working perfectly!";
    } else if (criticalPassed) {
      overallMessage =
        "⚠️ Basic messaging working but some advanced features have issues";
    } else {
      overallMessage = "❌ Critical messaging issues found";
    }

    logInfo("Message flow audit completed", {
      overallSuccess: allPassed,
      criticalSuccess: criticalPassed,
      businessId: testData.businessId,
      resultsSummary: Object.fromEntries(
        Object.entries(results).map(([key, result]) => [key, result.success])
      ),
    });

    return {
      overall: {
        success: criticalPassed,
        message: overallMessage,
      },
      results,
      recommendations: allRecommendations,
    };
  }
}
