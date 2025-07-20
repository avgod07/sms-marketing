import { logInfo, logError } from "../utils/logger.util";
import { storage } from "../db/storage.js";

interface ComplianceAuditResult {
  success: boolean;
  message: string;
  details?: any;
  recommendations?: string[];
}

/**
 * Comprehensive Compliance Audit Service
 * Verifies TCPA compliance, opt-in/opt-out flows, and messaging best practices
 */
export class ComplianceAuditService {
  /**
   * STEP 1: Audit opt-in collection and storage
   */
  async auditOptInCollection(
    businessId: number
  ): Promise<ComplianceAuditResult> {
    logInfo("Auditing opt-in collection process", { businessId });

    try {
      const biz = storage.forBusiness(businessId);
      const business = await biz.getBusiness();

      // Check if business has join page configured
      const baseUrl = process.env.BASE_URL || "http://localhost:3000";
      const joinPageUrl = `${baseUrl}/join/${businessId}`;

      // Check initial message compliance
      const initialMessage = business.initialMessage;
      if (!initialMessage) {
        return {
          success: false,
          message: "No initial message configured",
          recommendations: [
            "Configure initial welcome message",
            "Include opt-out instructions in initial message",
          ],
        };
      }

      // Verify STOP instructions are present
      const hasStopInstructions = initialMessage.toLowerCase().includes("stop");
      if (!hasStopInstructions) {
        return {
          success: false,
          message: "Initial message missing STOP instructions",
          details: { initialMessage },
          recommendations: [
            "Add 'Text STOP to unsubscribe' to initial message",
            "TCPA compliance requires clear opt-out instructions",
          ],
        };
      }

      // Check message length (SMS should be ≤160 characters for single segment)
      const messageLength = initialMessage.length;
      const isLongMessage = messageLength > 160;

      // Verify business information completeness for compliance
      const onboarding = await biz.getOnboardingProgress();
      const missingComplianceInfo = [];

      if (!onboarding?.websiteUrl)
        missingComplianceInfo.push("Business website");
      if (!onboarding?.address1) missingComplianceInfo.push("Business address");
      if (!onboarding?.email) missingComplianceInfo.push("Business email");
      if (!onboarding?.phoneNumber)
        missingComplianceInfo.push("Business phone");

      const warnings = [];
      if (isLongMessage) {
        warnings.push(
          `Initial message is ${messageLength} characters (>160 may split into multiple SMS)`
        );
      }
      if (missingComplianceInfo.length > 0) {
        warnings.push(
          `Missing compliance info: ${missingComplianceInfo.join(", ")}`
        );
      }

      logInfo("Opt-in collection audit results", {
        businessId,
        hasStopInstructions,
        messageLength,
        missingComplianceInfo: missingComplianceInfo.length,
        joinPageUrl,
      });

      return {
        success: hasStopInstructions && missingComplianceInfo.length === 0,
        message: hasStopInstructions
          ? "Opt-in collection properly configured"
          : "Opt-in collection needs improvement",
        details: {
          joinPageUrl,
          initialMessage,
          messageLength,
          hasStopInstructions,
          missingComplianceInfo,
          businessInfo: {
            websiteUrl: onboarding?.websiteUrl,
            hasAddress: !!onboarding?.address1,
            hasEmail: !!onboarding?.email,
            hasPhone: !!onboarding?.phoneNumber,
          },
        },
        recommendations: [
          ...(hasStopInstructions
            ? []
            : ["Add STOP instructions to initial message"]),
          ...(missingComplianceInfo.length > 0
            ? ["Complete business information for compliance"]
            : []),
          ...(warnings.length > 0 ? warnings : []),
          "Ensure join page clearly explains consent to receive SMS",
          "Keep records of opt-in consent for compliance",
        ],
      };
    } catch (error: any) {
      logError("Failed to audit opt-in collection", error);
      return {
        success: false,
        message: "Failed to audit opt-in collection",
        details: { error: error.message },
        recommendations: [
          "Check business configuration",
          "Verify onboarding data",
        ],
      };
    }
  }

  /**
   * STEP 2: Audit opt-out processing (STOP responses)
   */
  async auditOptOutProcessing(
    businessId: number
  ): Promise<ComplianceAuditResult> {
    logInfo("Auditing opt-out processing", { businessId });

    try {
      const biz = storage.forBusiness(businessId);

      // Check contacts with opt-out history
      const allContacts = await biz.getContacts();
      const activeContacts = allContacts.filter((c) => c.active);
      const inactiveContacts = allContacts.filter((c) => !c.active);

      // Verify inactive contacts are properly excluded
      const totalContacts = allContacts.length;
      const optOutRate =
        totalContacts > 0 ? inactiveContacts.length / totalContacts : 0;

      // Check if there are recent messages to inactive contacts (compliance violation)
      const messages = await biz.getMessages();
      const recentMessages = messages.filter((msg) => {
        const messageDate = new Date(msg.createdAt);
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        return messageDate > oneDayAgo;
      });

      const messagestoInactiveContacts = recentMessages.filter((msg) => {
        const contact = allContacts.find(
          (c) => c.phoneNumber === msg.phoneNumber
        );
        return contact && !contact.active;
      });

      // Check campaign filtering
      const campaigns = await biz.getCampaigns();
      const recentCampaigns = campaigns.filter((campaign) => {
        const campaignDate = new Date(campaign.createdAt);
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        return campaignDate > oneWeekAgo;
      });

      logInfo("Opt-out processing audit results", {
        businessId,
        totalContacts,
        activeContacts: activeContacts.length,
        inactiveContacts: inactiveContacts.length,
        optOutRate,
        messagestoInactiveContacts: messagestoInactiveContacts.length,
        recentCampaigns: recentCampaigns.length,
      });

      const hasViolations = messagestoInactiveContacts.length > 0;

      return {
        success: !hasViolations,
        message: hasViolations
          ? "COMPLIANCE VIOLATION: Messages sent to opted-out contacts"
          : "Opt-out processing working correctly",
        details: {
          contactStats: {
            total: totalContacts,
            active: activeContacts.length,
            inactive: inactiveContacts.length,
            optOutRate: Math.round(optOutRate * 100),
          },
          complianceCheck: {
            messagestoInactiveContacts: messagestoInactiveContacts.length,
            recentCampaigns: recentCampaigns.length,
            hasViolations,
          },
          violations: messagestoInactiveContacts.map((msg) => ({
            messageId: msg.id,
            phoneNumber: msg.phoneNumber,
            content: msg.content,
            date: msg.createdAt,
          })),
        },
        recommendations: hasViolations
          ? [
              "URGENT: Stop sending to opted-out contacts immediately",
              "Review campaign targeting logic",
              "Implement stricter opt-out filtering",
            ]
          : [
              "Opt-out processing is compliant",
              "Continue monitoring for compliance violations",
              "Document opt-out procedures for audit trail",
            ],
      };
    } catch (error: any) {
      logError("Failed to audit opt-out processing", error);
      return {
        success: false,
        message: "Failed to audit opt-out processing",
        details: { error: error.message },
        recommendations: [
          "Check contact management system",
          "Verify message filtering logic",
        ],
      };
    }
  }

  /**
   * STEP 3: Audit message content compliance
   */
  async auditMessageContent(
    businessId: number
  ): Promise<ComplianceAuditResult> {
    logInfo("Auditing message content compliance", { businessId });

    try {
      const biz = storage.forBusiness(businessId);

      // Get recent messages for content analysis
      const messages = await biz.getMessages();
      const outboundMessages = messages.filter(
        (msg) =>
          msg.messageType === "regular" ||
          msg.messageType === "campaign" ||
          msg.messageType === "initial"
      );

      const recentMessages = outboundMessages.slice(0, 50); // Analyze last 50 messages

      // Content compliance checks
      const contentIssues = [];
      const forbiddenPatterns = [
        {
          pattern: /\bfree\b/gi,
          issue: "Potentially misleading 'free' claims",
        },
        {
          pattern: /\burgent\b|\bemergency\b/gi,
          issue: "False urgency indicators",
        },
        {
          pattern: /\bclick here\b/gi,
          issue: "Generic link text (phishing indicator)",
        },
        {
          pattern: /\bwinner\b|\bprize\b/gi,
          issue: "Potentially fraudulent prize claims",
        },
      ];

      const suspiciousMessages = [];
      const missingStopInstructions = [];

      for (const message of recentMessages) {
        const content = message.content.toLowerCase();

        // Check for forbidden patterns
        for (const { pattern, issue } of forbiddenPatterns) {
          if (pattern.test(message.content)) {
            suspiciousMessages.push({
              messageId: message.id,
              phoneNumber: message.phoneNumber,
              issue,
              content: message.content.substring(0, 100) + "...",
            });
          }
        }

        // Check for STOP instructions in campaign messages
        if (message.messageType === "campaign" && !content.includes("stop")) {
          missingStopInstructions.push({
            messageId: message.id,
            phoneNumber: message.phoneNumber,
            content: message.content.substring(0, 100) + "...",
          });
        }
      }

      // Check business initial message
      const business = await biz.getBusiness();
      const initialMessage = business.initialMessage;
      let initialMessageCompliant = true;
      let initialMessageIssues = [];

      if (initialMessage) {
        if (!initialMessage.toLowerCase().includes("stop")) {
          initialMessageCompliant = false;
          initialMessageIssues.push("Missing STOP instructions");
        }
        if (initialMessage.length > 160) {
          initialMessageIssues.push("Message may be split (>160 characters)");
        }
      }

      logInfo("Message content audit results", {
        businessId,
        messagesAnalyzed: recentMessages.length,
        suspiciousMessages: suspiciousMessages.length,
        missingStopInstructions: missingStopInstructions.length,
        initialMessageCompliant,
      });

      const hasComplianceIssues =
        suspiciousMessages.length > 0 ||
        missingStopInstructions.length > 0 ||
        !initialMessageCompliant;

      return {
        success: !hasComplianceIssues,
        message: hasComplianceIssues
          ? "Message content compliance issues found"
          : "Message content is compliant",
        details: {
          analysis: {
            messagesAnalyzed: recentMessages.length,
            suspiciousMessages: suspiciousMessages.length,
            missingStopInstructions: missingStopInstructions.length,
          },
          initialMessage: {
            compliant: initialMessageCompliant,
            issues: initialMessageIssues,
            content: initialMessage,
          },
          issues: {
            suspicious: suspiciousMessages,
            missingStop: missingStopInstructions,
          },
        },
        recommendations: [
          ...(suspiciousMessages.length > 0
            ? ["Review flagged messages for compliance"]
            : []),
          ...(missingStopInstructions.length > 0
            ? ["Add STOP instructions to campaign messages"]
            : []),
          ...(initialMessageIssues.length > 0
            ? initialMessageIssues.map((issue) => `Initial message: ${issue}`)
            : []),
          "Train content creators on compliance requirements",
          "Implement content review process for campaigns",
          "Use clear, honest language in all communications",
        ],
      };
    } catch (error: any) {
      logError("Failed to audit message content", error);
      return {
        success: false,
        message: "Failed to audit message content",
        details: { error: error.message },
        recommendations: [
          "Check message storage system",
          "Verify content analysis logic",
        ],
      };
    }
  }

  /**
   * STEP 4: Audit timing and frequency compliance
   */
  async auditTimingCompliance(
    businessId: number
  ): Promise<ComplianceAuditResult> {
    logInfo("Auditing timing and frequency compliance", { businessId });

    try {
      const biz = storage.forBusiness(businessId);

      // Get messages from last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const messages = await biz.getMessages();
      const recentMessages = messages.filter((msg) => {
        const messageDate = new Date(msg.createdAt);
        return (
          messageDate > sevenDaysAgo &&
          (msg.messageType === "regular" || msg.messageType === "campaign")
        );
      });

      // Analyze by phone number for frequency
      const phoneNumberFrequency = recentMessages.reduce((acc, msg) => {
        acc[msg.phoneNumber] = (acc[msg.phoneNumber] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Find high-frequency contacts (>3 messages per week)
      const highFrequencyContacts = Object.entries(phoneNumberFrequency)
        .filter(([phone, count]) => count > 3)
        .map(([phone, count]) => ({ phoneNumber: phone, messageCount: count }));

      // Analyze timing patterns (messages sent outside business hours)
      const outsideBusinessHours = recentMessages.filter((msg) => {
        const messageDate = new Date(msg.createdAt);
        const hour = messageDate.getHours();
        const day = messageDate.getDay(); // 0 = Sunday, 6 = Saturday

        // Outside 8 AM - 8 PM or on weekends
        return hour < 8 || hour > 20 || day === 0 || day === 6;
      });

      // Check for message bursts (>10 messages in 1 hour)
      const hourlyBursts = [];
      const sortedMessages = recentMessages.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      for (let i = 0; i < sortedMessages.length - 10; i++) {
        const startTime = new Date(sortedMessages[i].createdAt);
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour later

        const messagesInHour = sortedMessages.filter((msg, index) => {
          if (index < i) return false;
          const msgTime = new Date(msg.createdAt);
          return msgTime >= startTime && msgTime <= endTime;
        });

        if (messagesInHour.length > 10) {
          hourlyBursts.push({
            startTime: startTime.toISOString(),
            messageCount: messagesInHour.length,
            phones: [...new Set(messagesInHour.map((m) => m.phoneNumber))],
          });
          i += messagesInHour.length; // Skip processed messages
        }
      }

      logInfo("Timing compliance audit results", {
        businessId,
        recentMessages: recentMessages.length,
        highFrequencyContacts: highFrequencyContacts.length,
        outsideBusinessHours: outsideBusinessHours.length,
        hourlyBursts: hourlyBursts.length,
      });

      const hasTimingIssues =
        highFrequencyContacts.length > 0 ||
        outsideBusinessHours.length > 5 ||
        hourlyBursts.length > 0;

      return {
        success: !hasTimingIssues,
        message: hasTimingIssues
          ? "Timing and frequency compliance issues found"
          : "Timing and frequency compliance looks good",
        details: {
          weeklyStats: {
            totalMessages: recentMessages.length,
            uniqueContacts: Object.keys(phoneNumberFrequency).length,
            averageFrequency:
              recentMessages.length /
              Math.max(Object.keys(phoneNumberFrequency).length, 1),
          },
          frequencyIssues: {
            highFrequencyContacts: highFrequencyContacts.length,
            details: highFrequencyContacts,
          },
          timingIssues: {
            outsideBusinessHours: outsideBusinessHours.length,
            percentage:
              recentMessages.length > 0
                ? Math.round(
                    (outsideBusinessHours.length / recentMessages.length) * 100
                  )
                : 0,
          },
          burstActivity: {
            hourlyBursts: hourlyBursts.length,
            details: hourlyBursts,
          },
        },
        recommendations: [
          ...(highFrequencyContacts.length > 0
            ? [
                `Reduce frequency for ${highFrequencyContacts.length} contacts (>3 messages/week)`,
              ]
            : []),
          ...(outsideBusinessHours.length > 5
            ? ["Limit messaging to business hours (8 AM - 8 PM, weekdays)"]
            : []),
          ...(hourlyBursts.length > 0
            ? ["Avoid sending message bursts (>10 messages/hour)"]
            : []),
          "Implement frequency capping per contact",
          "Schedule campaigns during business hours",
          "Monitor messaging patterns for compliance",
        ],
      };
    } catch (error: any) {
      logError("Failed to audit timing compliance", error);
      return {
        success: false,
        message: "Failed to audit timing compliance",
        details: { error: error.message },
        recommendations: [
          "Check message timing analysis",
          "Verify message storage and retrieval",
        ],
      };
    }
  }

  /**
   * STEP 5: Comprehensive compliance audit
   */
  async auditCompleteCompliance(businessId: number): Promise<{
    overall: {
      success: boolean;
      message: string;
      riskLevel: "LOW" | "MEDIUM" | "HIGH";
    };
    results: Record<string, ComplianceAuditResult>;
    recommendations: string[];
    urgentActions: string[];
  }> {
    logInfo("Starting comprehensive compliance audit", { businessId });

    const results: Record<string, ComplianceAuditResult> = {};

    // Step 1: Opt-in collection
    results.optInCollection = await this.auditOptInCollection(businessId);

    // Step 2: Opt-out processing
    results.optOutProcessing = await this.auditOptOutProcessing(businessId);

    // Step 3: Message content
    results.messageContent = await this.auditMessageContent(businessId);

    // Step 4: Timing compliance
    results.timingCompliance = await this.auditTimingCompliance(businessId);

    // Determine overall compliance status
    const allResults = Object.values(results);
    const allPassed = allResults.every((r) => r.success);
    const criticalResults = [results.optOutProcessing, results.optInCollection];
    const criticalPassed = criticalResults.every((r) => r.success);

    // Determine risk level
    let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";
    if (!results.optOutProcessing.success) {
      riskLevel = "HIGH"; // TCPA violations are high risk
    } else if (!criticalPassed) {
      riskLevel = "MEDIUM";
    } else if (!allPassed) {
      riskLevel = "MEDIUM";
    }

    // Collect recommendations and urgent actions
    const allRecommendations = allResults
      .flatMap((r) => r.recommendations || [])
      .filter((rec, index, self) => self.indexOf(rec) === index);

    const urgentActions = [];
    if (results.optOutProcessing.details?.complianceCheck?.hasViolations) {
      urgentActions.push("STOP sending to opted-out contacts immediately");
    }
    if (!results.optInCollection.success) {
      urgentActions.push(
        "Fix opt-in collection process before sending more messages"
      );
    }

    let overallMessage: string;
    if (allPassed) {
      overallMessage = "✅ Full TCPA compliance achieved";
    } else if (criticalPassed) {
      overallMessage = "⚠️ Basic compliance OK, some improvements needed";
    } else {
      overallMessage =
        "❌ COMPLIANCE VIOLATIONS FOUND - Immediate action required";
    }

    logInfo("Compliance audit completed", {
      overallSuccess: allPassed,
      criticalSuccess: criticalPassed,
      riskLevel,
      businessId,
      urgentActions: urgentActions.length,
      resultsSummary: Object.fromEntries(
        Object.entries(results).map(([key, result]) => [key, result.success])
      ),
    });

    return {
      overall: {
        success: criticalPassed,
        message: overallMessage,
        riskLevel,
      },
      results,
      recommendations: allRecommendations,
      urgentActions,
    };
  }
}
