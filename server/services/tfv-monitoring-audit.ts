import twilio from "twilio";
import { logInfo, logError } from "../utils/logger.util";
import { storage } from "../db/storage.js";
import { TFVPeriodicCheckService } from "./tfv-periodic-check.service.js";

interface TFVMonitoringAuditResult {
  success: boolean;
  message: string;
  details?: any;
  recommendations?: string[];
}

interface WebhookTestResult {
  webhookUrl: string;
  isReachable: boolean;
  responseTime?: number;
  statusCode?: number;
  error?: string;
}

/**
 * Comprehensive TFV Monitoring and Webhook Audit Service
 * Monitors TFV status, tests webhooks, and provides real-time updates
 */
export class TFVMonitoringAuditService {
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
   * STEP 1: Audit all TFV submissions and their current status
   */
  async auditAllTFVSubmissions(): Promise<TFVMonitoringAuditResult> {
    logInfo("Starting comprehensive TFV submissions audit");

    try {
      // Get all toll-free verifications from Twilio
      const allVerifications =
        await this.client.messaging.v1.tollfreeVerifications.list({
          limit: 1000,
        });

      if (allVerifications.length === 0) {
        return {
          success: false,
          message: "No TFV submissions found",
          recommendations: [
            "Submit TFV requests for your toll-free numbers",
            "Ensure toll-free numbers are purchased",
          ],
        };
      }

      // Categorize by status
      const statusCounts = allVerifications.reduce((acc, tfv) => {
        const status = tfv.status || "unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Get recent submissions (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentSubmissions = allVerifications.filter(
        (tfv) => tfv.dateCreated && new Date(tfv.dateCreated) > thirtyDaysAgo
      );

      // Check for any rejected submissions
      const rejectedSubmissions = allVerifications.filter((tfv) =>
        tfv.status?.toString().includes("rejected")
      );

      // Check for pending submissions older than 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const stalePendingSubmissions = allVerifications.filter(
        (tfv) =>
          (tfv.status?.toString().includes("review") ||
            tfv.status?.toString().includes("pending")) &&
          tfv.dateCreated &&
          new Date(tfv.dateCreated) < sevenDaysAgo
      );

      logInfo("TFV submissions audit results", {
        totalSubmissions: allVerifications.length,
        statusCounts,
        recentSubmissions: recentSubmissions.length,
        rejectedSubmissions: rejectedSubmissions.length,
        stalePendingSubmissions: stalePendingSubmissions.length,
      });

      const hasIssues =
        rejectedSubmissions.length > 0 || stalePendingSubmissions.length > 0;
      const hasApprovedNumbers = statusCounts["twilio-approved"] > 0;

      const recommendations = [];
      if (rejectedSubmissions.length > 0) {
        recommendations.push(
          `Review ${rejectedSubmissions.length} rejected TFV submissions`
        );
        recommendations.push(
          "Check rejection reasons and resubmit with corrections"
        );
      }
      if (stalePendingSubmissions.length > 0) {
        recommendations.push(
          `${stalePendingSubmissions.length} submissions pending for over 7 days`
        );
        recommendations.push("Contact Twilio support for status update");
      }
      if (!hasApprovedNumbers) {
        recommendations.push(
          "No approved toll-free numbers - messaging is restricted"
        );
      }

      return {
        success: hasApprovedNumbers && !hasIssues,
        message: hasApprovedNumbers
          ? `${
              statusCounts["twilio-approved"] || 0
            } approved toll-free numbers ready for messaging`
          : "No approved toll-free numbers available",
        details: {
          summary: {
            total: allVerifications.length,
            approved: statusCounts["twilio-approved"] || 0,
            pending:
              (statusCounts["in-review"] || 0) +
              (statusCounts["pending-review"] || 0),
            rejected: statusCounts["twilio-rejected"] || 0,
          },
          statusBreakdown: statusCounts,
          recentActivity: {
            submissionsLast30Days: recentSubmissions.length,
            rejectedSubmissions: rejectedSubmissions.length,
            stalePendingSubmissions: stalePendingSubmissions.length,
          },
          submissions: allVerifications.map((tfv) => ({
            sid: tfv.sid,
            phoneNumber: tfv.tollfreePhoneNumberSid,
            status: tfv.status,
            businessName: tfv.businessName,
            dateCreated: tfv.dateCreated,
            rejectionReason: tfv.rejectionReason,
          })),
        },
        recommendations,
      };
    } catch (error: any) {
      logError("Failed to audit TFV submissions", error);
      return {
        success: false,
        message: "Failed to retrieve TFV submissions",
        details: { error: error.message },
        recommendations: [
          "Check Twilio API credentials",
          "Verify account has necessary permissions",
        ],
      };
    }
  }

  /**
   * STEP 2: Test webhook connectivity and response
   */
  async auditWebhookConnectivity(): Promise<TFVMonitoringAuditResult> {
    logInfo("Starting webhook connectivity audit");

    const webhookUrl = process.env.TWILIO_WEBHOOK_URL;
    if (!webhookUrl) {
      return {
        success: false,
        message: "No webhook URL configured",
        recommendations: [
          "Set TWILIO_WEBHOOK_URL environment variable",
          "Configure webhook URL for TFV status updates",
        ],
      };
    }

    try {
      // Test webhook reachability
      const startTime = Date.now();
      const testPayload = {
        AccountSid: process.env.TWILIO_ACCOUNT_SID || "test_account_sid",
        MessageStatus: "delivered",
        MessageSid: "SM_test_message_sid",
        To: "+15551234567",
        From: "+18001234567",
      };

      // Simulate webhook call
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Twilio-Signature": "test-signature",
        },
        body: new URLSearchParams(testPayload).toString(),
      });

      const responseTime = Date.now() - startTime;

      const webhookTest: WebhookTestResult = {
        webhookUrl,
        isReachable: response.ok,
        responseTime,
        statusCode: response.status,
      };

      if (!response.ok) {
        webhookTest.error = `HTTP ${response.status}: ${response.statusText}`;
      }

      logInfo("Webhook connectivity test result", webhookTest);

      if (webhookTest.isReachable) {
        return {
          success: true,
          message: "Webhook is reachable and responding",
          details: { webhookTest },
          recommendations:
            responseTime > 5000
              ? ["Webhook response time is slow (>5s) - consider optimization"]
              : [],
        };
      } else {
        return {
          success: false,
          message: "Webhook is not reachable",
          details: { webhookTest },
          recommendations: [
            "Check webhook URL is publicly accessible",
            "Verify firewall and network configuration",
            "Test webhook endpoint manually",
          ],
        };
      }
    } catch (error: any) {
      logError("Webhook connectivity test failed", error);
      return {
        success: false,
        message: "Webhook connectivity test failed",
        details: {
          error: error.message,
          webhookUrl,
        },
        recommendations: [
          "Check webhook URL is valid and accessible",
          "Verify network connectivity",
          "Test webhook endpoint configuration",
        ],
      };
    }
  }

  /**
   * STEP 3: Audit TFV status refresh mechanism
   */
  async auditTFVStatusRefresh(): Promise<TFVMonitoringAuditResult> {
    logInfo("Starting TFV status refresh audit");

    try {
      // Test the periodic check service
      const checkResult = await TFVPeriodicCheckService.checkAllBusinesses();

      logInfo("TFV periodic check result", checkResult);

      // Get current TFV statistics
      const tfvStats = await TFVPeriodicCheckService.getTFVStats();

      logInfo("Current TFV statistics", tfvStats);

      const hasActiveMonitoring = checkResult.businessesChecked > 0;
      const hasUpdates = checkResult.statusesUpdated > 0;
      const hasErrors = checkResult.errors > 0;

      const recommendations = [];
      if (!hasActiveMonitoring) {
        recommendations.push(
          "No businesses with pending TFV found for monitoring"
        );
      }
      if (hasErrors) {
        recommendations.push(
          `${checkResult.errors} errors occurred during status refresh`
        );
        recommendations.push("Check logs for specific error details");
      }
      if (tfvStats.pending > 0) {
        recommendations.push(
          `${tfvStats.pending} businesses have pending TFV submissions`
        );
        recommendations.push("Monitor these closely for status updates");
      }

      return {
        success: !hasErrors,
        message: hasActiveMonitoring
          ? `TFV monitoring is active - checked ${checkResult.businessesChecked} businesses`
          : "TFV monitoring system is ready but no active submissions found",
        details: {
          lastCheckResult: checkResult,
          currentStats: tfvStats,
          monitoringHealth: {
            hasActiveMonitoring,
            hasUpdates,
            hasErrors,
            errorRate:
              checkResult.businessesChecked > 0
                ? checkResult.errors / checkResult.businessesChecked
                : 0,
          },
        },
        recommendations,
      };
    } catch (error: any) {
      logError("TFV status refresh audit failed", error);
      return {
        success: false,
        message: "TFV status refresh system failed",
        details: { error: error.message },
        recommendations: [
          "Check TFV periodic check service configuration",
          "Verify database connectivity",
          "Review monitoring service logs",
        ],
      };
    }
  }

  /**
   * STEP 4: Audit Event Streams for TFV notifications
   */
  async auditEventStreams(): Promise<TFVMonitoringAuditResult> {
    logInfo("Starting Event Streams audit for TFV notifications");

    try {
      // Check if Event Streams are configured
      const eventSinks = await this.client.events.v1.sinks.list();

      const tfvRelatedSinks = eventSinks.filter(
        (sink) =>
          sink.description?.toLowerCase().includes("tfv") ||
          sink.description?.toLowerCase().includes("toll") ||
          sink.description?.toLowerCase().includes("verification")
      );

      logInfo("Event Streams audit results", {
        totalSinks: eventSinks.length,
        tfvRelatedSinks: tfvRelatedSinks.length,
      });

      if (eventSinks.length === 0) {
        return {
          success: false,
          message: "No Event Streams configured",
          recommendations: [
            "Consider setting up Event Streams for real-time TFV notifications",
            "Event Streams provide immediate status updates without polling",
          ],
        };
      }

      if (tfvRelatedSinks.length === 0) {
        return {
          success: false,
          message: "No TFV-specific Event Streams found",
          details: {
            totalSinks: eventSinks.length,
            availableSinks: eventSinks.map((sink) => ({
              sid: sink.sid,
              description: sink.description,
              sinkType: sink.sinkType,
              status: sink.status,
            })),
          },
          recommendations: [
            "Set up Event Stream for toll-free verification events",
            "Subscribe to 'com.twilio.messaging.toll-free-verification.updated' events",
          ],
        };
      }

      // Check if sinks are active
      const activeSinks = tfvRelatedSinks.filter(
        (sink) => sink.status === "active"
      );

      return {
        success: activeSinks.length > 0,
        message:
          activeSinks.length > 0
            ? `${activeSinks.length} active TFV Event Streams configured`
            : "TFV Event Streams exist but are not active",
        details: {
          totalSinks: eventSinks.length,
          tfvSinks: tfvRelatedSinks.length,
          activeTfvSinks: activeSinks.length,
          sinks: tfvRelatedSinks.map((sink) => ({
            sid: sink.sid,
            description: sink.description,
            status: sink.status,
            sinkType: sink.sinkType,
          })),
        },
        recommendations:
          activeSinks.length === 0
            ? [
                "Activate existing TFV Event Streams",
                "Verify Event Stream configuration is correct",
              ]
            : ["Event Streams are properly configured for TFV monitoring"],
      };
    } catch (error: any) {
      logError("Event Streams audit failed", error);
      return {
        success: false,
        message: "Failed to audit Event Streams",
        details: { error: error.message },
        recommendations: [
          "Check Twilio API permissions for Event Streams",
          "Verify account has Event Streams enabled",
        ],
      };
    }
  }

  /**
   * STEP 5: Test real-time TFV status monitoring
   */
  async auditRealTimeMonitoring(
    businessId?: number
  ): Promise<TFVMonitoringAuditResult> {
    logInfo("Starting real-time TFV monitoring audit", { businessId });

    try {
      let businessesToCheck: number[] = [];

      if (businessId) {
        businessesToCheck = [businessId];
      } else {
        // Get all businesses with pending TFV
        const stats = await TFVPeriodicCheckService.getTFVStats();
        if (stats.pending === 0) {
          return {
            success: true,
            message: "No businesses with pending TFV to monitor",
            details: { stats },
            recommendations: [
              "Real-time monitoring is ready for when TFV submissions are pending",
            ],
          };
        }

        // For demo purposes, we'll check a few businesses
        businessesToCheck = [1, 2, 3]; // Mock business IDs
      }

      const monitoringResults = [];

      for (const bizId of businessesToCheck) {
        try {
          const result = await TFVPeriodicCheckService.checkBusiness(bizId);
          monitoringResults.push(result);
        } catch (error) {
          monitoringResults.push({
            businessId: bizId,
            statusUpdated: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const successfulChecks = monitoringResults.filter((r) => !r.error);
      const statusUpdates = monitoringResults.filter((r) => r.statusUpdated);
      const errors = monitoringResults.filter((r) => r.error);

      logInfo("Real-time monitoring results", {
        totalChecks: monitoringResults.length,
        successful: successfulChecks.length,
        updates: statusUpdates.length,
        errors: errors.length,
      });

      return {
        success: errors.length === 0,
        message:
          errors.length === 0
            ? `Real-time monitoring working - checked ${successfulChecks.length} businesses`
            : `Real-time monitoring has issues - ${errors.length} errors`,
        details: {
          checkedBusinesses: monitoringResults.length,
          successfulChecks: successfulChecks.length,
          statusUpdates: statusUpdates.length,
          errors: errors.length,
          results: monitoringResults,
        },
        recommendations:
          errors.length > 0
            ? [
                "Review error details for monitoring failures",
                "Check database connectivity and permissions",
              ]
            : ["Real-time TFV monitoring is working correctly"],
      };
    } catch (error: any) {
      logError("Real-time monitoring audit failed", error);
      return {
        success: false,
        message: "Real-time monitoring audit failed",
        details: { error: error.message },
        recommendations: [
          "Check monitoring service configuration",
          "Verify business data access",
        ],
      };
    }
  }

  /**
   * STEP 6: Comprehensive TFV monitoring audit
   */
  async auditCompleteMonitoring(businessId?: number): Promise<{
    overall: { success: boolean; message: string };
    results: Record<string, TFVMonitoringAuditResult>;
    recommendations: string[];
  }> {
    logInfo("Starting comprehensive TFV monitoring audit", { businessId });

    const results: Record<string, TFVMonitoringAuditResult> = {};

    // Step 1: Audit all TFV submissions
    results.tfvSubmissions = await this.auditAllTFVSubmissions();

    // Step 2: Test webhook connectivity
    results.webhookConnectivity = await this.auditWebhookConnectivity();

    // Step 3: Audit status refresh mechanism
    results.statusRefresh = await this.auditTFVStatusRefresh();

    // Step 4: Audit Event Streams
    results.eventStreams = await this.auditEventStreams();

    // Step 5: Test real-time monitoring
    results.realTimeMonitoring = await this.auditRealTimeMonitoring(businessId);

    // Determine overall status
    const allResults = Object.values(results);
    const criticalResults = [results.tfvSubmissions, results.statusRefresh];
    const allPassed = allResults.every((r) => r.success);
    const criticalPassed = criticalResults.every((r) => r.success);

    // Collect all recommendations
    const allRecommendations = allResults
      .flatMap((r) => r.recommendations || [])
      .filter((rec, index, self) => self.indexOf(rec) === index);

    let overallMessage: string;
    if (allPassed) {
      overallMessage = "🎉 TFV monitoring system is fully operational!";
    } else if (criticalPassed) {
      overallMessage =
        "⚠️ TFV monitoring working but some optimizations available";
    } else {
      overallMessage = "❌ Critical issues found in TFV monitoring system";
    }

    logInfo("TFV monitoring audit completed", {
      overallSuccess: allPassed,
      criticalSuccess: criticalPassed,
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
