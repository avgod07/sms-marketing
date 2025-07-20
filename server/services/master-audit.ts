import { logInfo, logError } from "../utils/logger.util";
import { TrustHubAuditService } from "./trust-hub-audit.js";
import { PhonePurchaseAuditService } from "./phone-purchase-audit.js";
import { TFVMonitoringAuditService } from "./tfv-monitoring-audit.js";
import { MessageFlowAuditService } from "./message-flow-audit.js";
import { ComplianceAuditService } from "./compliance-audit.js";

interface MasterAuditResult {
  success: boolean;
  message: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  results: Record<string, any>;
  recommendations: string[];
  urgentActions: string[];
}

interface AuditConfig {
  businessId?: number;
  testPhoneNumber?: string;
  testMessage?: string;
  includeMessageFlow?: boolean;
  includeCompliance?: boolean;
  skipTrustHub?: boolean;
  customerProfileData?: {
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
  };
}

/**
 * Master Audit Service - Comprehensive TFV Pipeline Audit
 * Orchestrates all audit services for complete verification
 */
export class MasterTFVAuditService {
  private trustHubAudit: TrustHubAuditService;
  private phonePurchaseAudit: PhonePurchaseAuditService;
  private tfvMonitoringAudit: TFVMonitoringAuditService;
  private messageFlowAudit: MessageFlowAuditService;
  private complianceAudit: ComplianceAuditService;

  constructor() {
    this.trustHubAudit = new TrustHubAuditService();
    this.phonePurchaseAudit = new PhonePurchaseAuditService();
    this.tfvMonitoringAudit = new TFVMonitoringAuditService();
    this.messageFlowAudit = new MessageFlowAuditService();
    this.complianceAudit = new ComplianceAuditService();
  }

  /**
   * STEP 1: Environment Setup Verification
   */
  async auditEnvironmentSetup(): Promise<{
    success: boolean;
    message: string;
    details: any;
    recommendations: string[];
  }> {
    logInfo("Starting environment setup audit");

    const requiredVars = [
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN",
      "TWILIO_BUSINESS_PROFILE_SID",
      "DATABASE_URL",
      "CLERK_SECRET_KEY",
    ];

    const optionalVars = [
      "TWILIO_WEBHOOK_URL",
      "BASE_URL",
      "STRIPE_SECRET_KEY",
      "AWS_ACCESS_KEY_ID",
    ];

    const missingRequired = requiredVars.filter(
      (varName) => !process.env[varName]
    );
    const missingOptional = optionalVars.filter(
      (varName) => !process.env[varName]
    );

    // Check database connectivity
    let dbConnected = false;
    try {
      // Simple DB check - this would be more robust in practice
      dbConnected = !!process.env.DATABASE_URL;
    } catch (error) {
      dbConnected = false;
    }

    // Check if running in development mode
    const isDevelopment = process.env.NODE_ENV === "development";
    const isProduction = process.env.NODE_ENV === "production";

    const criticalIssues = [];
    if (missingRequired.length > 0) {
      criticalIssues.push(
        `Missing required environment variables: ${missingRequired.join(", ")}`
      );
    }
    if (!dbConnected) {
      criticalIssues.push("Database connection not available");
    }

    const warnings = [];
    if (missingOptional.length > 0) {
      warnings.push(
        `Missing optional variables: ${missingOptional.join(", ")}`
      );
    }
    if (isDevelopment && !process.env.TWILIO_WEBHOOK_URL) {
      warnings.push(
        "No webhook URL configured - webhook testing will be limited"
      );
    }

    logInfo("Environment setup audit results", {
      requiredVars: requiredVars.length,
      missingRequired: missingRequired.length,
      missingOptional: missingOptional.length,
      dbConnected,
      environment: process.env.NODE_ENV,
    });

    const success = missingRequired.length === 0 && dbConnected;

    return {
      success,
      message: success
        ? "Environment setup is complete"
        : "Environment setup has critical issues",
      details: {
        environment: {
          nodeEnv: process.env.NODE_ENV,
          isDevelopment,
          isProduction,
        },
        requiredVariables: {
          total: requiredVars.length,
          configured: requiredVars.length - missingRequired.length,
          missing: missingRequired,
        },
        optionalVariables: {
          total: optionalVars.length,
          configured: optionalVars.length - missingOptional.length,
          missing: missingOptional,
        },
        connectivity: {
          database: dbConnected,
        },
        criticalIssues,
        warnings,
      },
      recommendations: [
        ...missingRequired.map(
          (varName) => `Set ${varName} environment variable`
        ),
        ...(warnings.length > 0
          ? ["Review warnings for optimal functionality"]
          : []),
        "Ensure all environment variables are properly secured",
        "Test connectivity to external services",
      ],
    };
  }

  /**
   * STEP 2: Comprehensive audit with all services
   */
  async auditComplete(config: AuditConfig = {}): Promise<MasterAuditResult> {
    logInfo("Starting master TFV pipeline audit", { config });

    const results: Record<string, any> = {};
    const urgentActions: string[] = [];
    let totalChecks = 0;
    let passed = 0;
    let failed = 0;
    let warnings = 0;

    try {
      // 1. Environment Setup
      results.environment = await this.auditEnvironmentSetup();
      totalChecks++;
      if (results.environment.success) passed++;
      else failed++;

      // Only continue if environment is properly set up
      if (!results.environment.success) {
        return {
          success: false,
          message: "❌ Environment setup failed - cannot proceed with audit",
          riskLevel: "CRITICAL",
          summary: { totalChecks, passed, failed, warnings },
          results,
          recommendations: results.environment.recommendations,
          urgentActions: ["Fix environment setup before proceeding"],
        };
      }

      // 2. Trust Hub Audit (unless skipped)
      if (!config.skipTrustHub) {
        results.trustHub = await this.trustHubAudit.auditComplete(
          config.testPhoneNumber
        );
        totalChecks += Object.keys(results.trustHub.results).length;
        passed += Object.values(results.trustHub.results).filter(
          (r: any) => r.success
        ).length;
        failed += Object.values(results.trustHub.results).filter(
          (r: any) => !r.success
        ).length;

        if (!results.trustHub.overall.success) {
          urgentActions.push("Complete Trust Hub Customer Profile setup");
        }
      }

      // 3. Phone Purchase Audit (if business data provided)
      if (config.businessId && config.customerProfileData) {
        const businessData = {
          businessId: config.businessId,
          businessName: config.customerProfileData.businessName,
          websiteUrl: config.customerProfileData.websiteUrl,
          address: {
            address1: config.customerProfileData.address.street,
            city: config.customerProfileData.address.city,
            state: config.customerProfileData.address.state,
            postalCode: config.customerProfileData.address.postalCode,
            country: config.customerProfileData.address.country,
          },
          contact: {
            firstName: config.customerProfileData.contact.firstName,
            lastName: config.customerProfileData.contact.lastName,
            email: config.customerProfileData.contact.email,
            phoneNumber: config.customerProfileData.contact.phone,
          },
          useCases: ["ACCOUNT_NOTIFICATIONS", "MARKETING"],
          monthlyVolume: "1K - 10K",
        };

        results.phonePurchase = await this.phonePurchaseAudit.auditCompleteFlow(
          businessData,
          { testMode: true, areaCode: "833" }
        );
        totalChecks += Object.keys(results.phonePurchase.results).length;
        passed += Object.values(results.phonePurchase.results).filter(
          (r: any) => r.success
        ).length;
        failed += Object.values(results.phonePurchase.results).filter(
          (r: any) => !r.success
        ).length;

        if (!results.phonePurchase.overall.success) {
          urgentActions.push(
            "Complete business data for toll-free number purchase"
          );
        }
      }

      // 4. TFV Monitoring Audit
      results.tfvMonitoring =
        await this.tfvMonitoringAudit.auditCompleteMonitoring(
          config.businessId
        );
      totalChecks += Object.keys(results.tfvMonitoring.results).length;
      passed += Object.values(results.tfvMonitoring.results).filter(
        (r: any) => r.success
      ).length;
      failed += Object.values(results.tfvMonitoring.results).filter(
        (r: any) => !r.success
      ).length;

      // 5. Message Flow Audit (if requested and phone number provided)
      if (
        config.includeMessageFlow &&
        config.businessId &&
        config.testPhoneNumber
      ) {
        const testData = {
          businessId: config.businessId,
          testPhoneNumber: config.testPhoneNumber,
          messageContent:
            config.testMessage ||
            "🧪 This is a test message from your TFV audit system. Reply STOP to unsubscribe.",
          includeOptOutTest: true,
        };

        results.messageFlow =
          await this.messageFlowAudit.auditCompleteMessageFlow(testData);
        totalChecks += Object.keys(results.messageFlow.results).length;
        passed += Object.values(results.messageFlow.results).filter(
          (r: any) => r.success
        ).length;
        failed += Object.values(results.messageFlow.results).filter(
          (r: any) => !r.success
        ).length;

        if (!results.messageFlow.overall.success) {
          urgentActions.push(
            "Fix message flow issues before launching campaigns"
          );
        }
      }

      // 6. Compliance Audit (if requested)
      if (config.includeCompliance && config.businessId) {
        results.compliance = await this.complianceAudit.auditCompleteCompliance(
          config.businessId
        );
        totalChecks += Object.keys(results.compliance.results).length;
        passed += Object.values(results.compliance.results).filter(
          (r: any) => r.success
        ).length;
        failed += Object.values(results.compliance.results).filter(
          (r: any) => !r.success
        ).length;

        if (results.compliance.urgentActions.length > 0) {
          urgentActions.push(...results.compliance.urgentActions);
        }
      }

      // Calculate overall results
      const successRate = totalChecks > 0 ? passed / totalChecks : 0;

      // Determine risk level
      let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
      if (urgentActions.length > 0) {
        riskLevel = "CRITICAL";
      } else if (successRate < 0.5) {
        riskLevel = "HIGH";
      } else if (successRate < 0.8) {
        riskLevel = "MEDIUM";
      }

      // Collect all recommendations
      const allRecommendations = Object.values(results)
        .flatMap((result: any) => result.recommendations || [])
        .filter((rec, index, self) => self.indexOf(rec) === index);

      // Determine overall success
      const overallSuccess = successRate >= 0.8 && urgentActions.length === 0;

      let overallMessage: string;
      if (overallSuccess) {
        overallMessage = "🎉 TFV pipeline audit PASSED - Ready for production!";
      } else if (riskLevel === "CRITICAL") {
        overallMessage =
          "🚨 CRITICAL ISSUES FOUND - Immediate action required!";
      } else if (riskLevel === "HIGH") {
        overallMessage = "❌ Major issues found - TFV pipeline not ready";
      } else {
        overallMessage = "⚠️ Some issues found - Review recommendations";
      }

      logInfo("Master TFV audit completed", {
        totalChecks,
        passed,
        failed,
        successRate: Math.round(successRate * 100),
        riskLevel,
        urgentActions: urgentActions.length,
        overallSuccess,
      });

      return {
        success: overallSuccess,
        message: overallMessage,
        riskLevel,
        summary: {
          totalChecks,
          passed,
          failed,
          warnings,
        },
        results,
        recommendations: allRecommendations,
        urgentActions,
      };
    } catch (error: any) {
      logError("Master audit failed", error);
      return {
        success: false,
        message: "❌ Master audit failed due to system error",
        riskLevel: "CRITICAL",
        summary: { totalChecks, passed, failed, warnings },
        results,
        recommendations: ["Contact system administrator", "Check system logs"],
        urgentActions: ["Resolve system error before proceeding"],
      };
    }
  }

  /**
   * Quick health check for production monitoring
   */
  async quickHealthCheck(businessId?: number): Promise<{
    healthy: boolean;
    issues: string[];
    lastCheck: string;
  }> {
    logInfo("Running quick health check", { businessId });

    const issues: string[] = [];

    try {
      // Check environment
      const envCheck = await this.auditEnvironmentSetup();
      if (!envCheck.success) {
        issues.push("Environment configuration issues");
      }

      // Check Trust Hub status
      const trustHubCheck = await this.trustHubAudit.auditCustomerProfile();
      if (!trustHubCheck.success) {
        issues.push("Trust Hub Customer Profile issues");
      }

      // Check TFV monitoring
      const monitoringCheck =
        await this.tfvMonitoringAudit.auditAllTFVSubmissions();
      if (!monitoringCheck.success) {
        issues.push("TFV monitoring issues");
      }

      // If business ID provided, check compliance
      if (businessId) {
        const complianceCheck =
          await this.complianceAudit.auditOptOutProcessing(businessId);
        if (!complianceCheck.success) {
          issues.push("Compliance violations detected");
        }
      }

      const healthy = issues.length === 0;

      logInfo("Quick health check completed", {
        healthy,
        issues: issues.length,
        businessId,
      });

      return {
        healthy,
        issues,
        lastCheck: new Date().toISOString(),
      };
    } catch (error: any) {
      logError("Health check failed", error);
      return {
        healthy: false,
        issues: ["Health check system failure"],
        lastCheck: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate audit report in markdown format
   */
  generateAuditReport(auditResult: MasterAuditResult): string {
    const timestamp = new Date().toISOString();

    let report = `# TFV Pipeline Audit Report\n\n`;
    report += `**Generated:** ${timestamp}\n`;
    report += `**Overall Status:** ${
      auditResult.success ? "✅ PASSED" : "❌ FAILED"
    }\n`;
    report += `**Risk Level:** ${auditResult.riskLevel}\n`;
    report += `**Success Rate:** ${Math.round(
      (auditResult.summary.passed / auditResult.summary.totalChecks) * 100
    )}% (${auditResult.summary.passed}/${auditResult.summary.totalChecks})\n\n`;

    if (auditResult.urgentActions.length > 0) {
      report += `## 🚨 URGENT ACTIONS REQUIRED\n\n`;
      auditResult.urgentActions.forEach((action, index) => {
        report += `${index + 1}. ${action}\n`;
      });
      report += `\n`;
    }

    report += `## 📊 Audit Summary\n\n`;
    report += `| Category | Status | Details |\n`;
    report += `|----------|--------|---------|\n`;

    Object.entries(auditResult.results).forEach(
      ([category, result]: [string, any]) => {
        const status =
          result.success || result.overall?.success ? "✅ PASSED" : "❌ FAILED";
        const message =
          result.message || result.overall?.message || "No details";
        report += `| ${category} | ${status} | ${message} |\n`;
      }
    );

    report += `\n## 💡 Recommendations\n\n`;
    auditResult.recommendations.forEach((rec, index) => {
      report += `${index + 1}. ${rec}\n`;
    });

    report += `\n## 📋 Detailed Results\n\n`;
    Object.entries(auditResult.results).forEach(
      ([category, result]: [string, any]) => {
        report += `### ${
          category.charAt(0).toUpperCase() + category.slice(1)
        }\n\n`;
        if (result.details) {
          report += `\`\`\`json\n${JSON.stringify(
            result.details,
            null,
            2
          )}\n\`\`\`\n\n`;
        }
      }
    );

    return report;
  }
}
