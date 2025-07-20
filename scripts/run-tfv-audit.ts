#!/usr/bin/env tsx

/**
 * TFV Pipeline Audit Script
 * Runs comprehensive audit of the entire Twilio toll-free verification pipeline
 * Usage: npm run audit:tfv or tsx scripts/run-tfv-audit.ts
 */

import { MasterTFVAuditService } from "../server/services/master-audit.js";
import { logInfo, logError } from "../server/utils/logger.util.js";
import { writeFileSync } from "fs";
import { join } from "path";

interface AuditOptions {
  businessId?: number;
  testPhoneNumber?: string;
  includeMessageFlow?: boolean;
  includeCompliance?: boolean;
  createReport?: boolean;
  runMode?: "quick" | "comprehensive" | "production-ready";
  sampleBusinessData?: boolean;
}

// Sample business data for testing
const SAMPLE_BUSINESS_DATA = {
  businessName: "SMS Demo Marketing Co",
  websiteUrl: "https://example-marketing.com",
  address: {
    street: "123 Marketing Street",
    city: "San Francisco",
    state: "CA",
    postalCode: "94105",
    country: "US",
  },
  contact: {
    firstName: "Demo",
    lastName: "Manager",
    email: "demo@example-marketing.com",
    phone: "+14155551234",
  },
  businessType: "LLC" as const,
  industryType: "Marketing and Advertising",
  regionsOfOperation: ["US", "CA"],
};

async function main() {
  const args = process.argv.slice(2);

  // Parse command line arguments
  const options: AuditOptions = {
    runMode: "comprehensive",
    createReport: true,
    includeMessageFlow: false,
    includeCompliance: true,
    sampleBusinessData: false,
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--business-id":
        options.businessId = parseInt(args[++i]);
        break;
      case "--test-phone":
        options.testPhoneNumber = args[++i];
        break;
      case "--include-messaging":
        options.includeMessageFlow = true;
        break;
      case "--skip-compliance":
        options.includeCompliance = false;
        break;
      case "--no-report":
        options.createReport = false;
        break;
      case "--mode":
        options.runMode = args[++i] as
          | "quick"
          | "comprehensive"
          | "production-ready";
        break;
      case "--sample-data":
        options.sampleBusinessData = true;
        break;
      case "--help":
        printUsage();
        return;
    }
  }

  console.log("🚀 Starting TFV Pipeline Audit");
  console.log("================================");
  console.log(`Mode: ${options.runMode}`);
  console.log(`Business ID: ${options.businessId || "Auto-detect/Sample"}`);
  console.log(`Test Phone: ${options.testPhoneNumber || "Not provided"}`);
  console.log(`Include Messaging: ${options.includeMessageFlow}`);
  console.log(`Include Compliance: ${options.includeCompliance}`);
  console.log(`Generate Report: ${options.createReport}`);
  console.log("================================\n");

  try {
    const auditService = new MasterTFVAuditService();

    if (options.runMode === "quick") {
      // Quick health check only
      logInfo("Running quick health check");
      const healthCheck = await auditService.quickHealthCheck(
        options.businessId
      );

      console.log("\n📊 QUICK HEALTH CHECK RESULTS");
      console.log("==============================");
      console.log(
        `Status: ${healthCheck.healthy ? "✅ HEALTHY" : "❌ ISSUES FOUND"}`
      );
      console.log(`Last Check: ${healthCheck.lastCheck}`);

      if (healthCheck.issues.length > 0) {
        console.log("\n🚨 Issues Found:");
        healthCheck.issues.forEach((issue, index) => {
          console.log(`  ${index + 1}. ${issue}`);
        });
      } else {
        console.log("\n🎉 No issues detected!");
      }

      return;
    }

    // Build audit configuration
    const auditConfig = {
      businessId: options.businessId || 1, // Default test business
      testPhoneNumber: options.testPhoneNumber,
      includeMessageFlow: options.includeMessageFlow,
      includeCompliance: options.includeCompliance,
      customerProfileData: options.sampleBusinessData
        ? SAMPLE_BUSINESS_DATA
        : undefined,
      testMessage:
        "🧪 TFV Audit Test: This message verifies your SMS pipeline is working correctly. Reply STOP to unsubscribe.",
    };

    // Run comprehensive audit
    logInfo("Starting comprehensive TFV audit", auditConfig);
    const auditResult = await auditService.auditComplete(auditConfig);

    // Display results
    console.log("\n📋 TFV PIPELINE AUDIT RESULTS");
    console.log("==============================");
    console.log(
      `Overall Status: ${auditResult.success ? "✅ PASSED" : "❌ FAILED"}`
    );
    console.log(
      `Risk Level: ${getRiskLevelEmoji(auditResult.riskLevel)} ${
        auditResult.riskLevel
      }`
    );
    console.log(
      `Success Rate: ${Math.round(
        (auditResult.summary.passed / auditResult.summary.totalChecks) * 100
      )}% (${auditResult.summary.passed}/${auditResult.summary.totalChecks})`
    );
    console.log(`Message: ${auditResult.message}`);

    // Show urgent actions
    if (auditResult.urgentActions.length > 0) {
      console.log("\n🚨 URGENT ACTIONS REQUIRED:");
      auditResult.urgentActions.forEach((action, index) => {
        console.log(`  ${index + 1}. ${action}`);
      });
    }

    // Show category results
    console.log("\n📊 Category Results:");
    Object.entries(auditResult.results).forEach(
      ([category, result]: [string, any]) => {
        const status = result.success || result.overall?.success ? "✅" : "❌";
        const message =
          result.message || result.overall?.message || "No details";
        console.log(`  ${status} ${category.toUpperCase()}: ${message}`);
      }
    );

    // Show top recommendations
    if (auditResult.recommendations.length > 0) {
      console.log("\n💡 Top Recommendations:");
      auditResult.recommendations.slice(0, 5).forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
      if (auditResult.recommendations.length > 5) {
        console.log(
          `  ... and ${
            auditResult.recommendations.length - 5
          } more (see full report)`
        );
      }
    }

    // Generate and save detailed report
    if (options.createReport) {
      console.log("\n📄 Generating detailed audit report...");
      const report = auditService.generateAuditReport(auditResult);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const reportPath = join(
        process.cwd(),
        `tfv-audit-report-${timestamp}.md`
      );

      writeFileSync(reportPath, report, "utf8");
      console.log(`✅ Report saved to: ${reportPath}`);
    }

    // Production readiness assessment
    if (options.runMode === "production-ready") {
      console.log("\n🎯 PRODUCTION READINESS ASSESSMENT");
      console.log("===================================");

      const isProductionReady =
        auditResult.success && auditResult.urgentActions.length === 0;
      const readinessScore = Math.round(
        (auditResult.summary.passed / auditResult.summary.totalChecks) * 100
      );

      if (isProductionReady) {
        console.log("🟢 STATUS: READY FOR PRODUCTION");
        console.log("🚀 Your TFV pipeline is fully operational and compliant!");
        console.log("💰 Ready for funding demo and customer onboarding");
      } else if (readinessScore >= 80) {
        console.log("🟡 STATUS: MOSTLY READY (Minor Issues)");
        console.log(
          "⚠️ Address the recommendations below before full production"
        );
      } else if (readinessScore >= 60) {
        console.log("🟠 STATUS: NEEDS ATTENTION (Moderate Issues)");
        console.log("⚠️ Several issues need to be resolved before production");
      } else {
        console.log("🔴 STATUS: NOT READY (Critical Issues)");
        console.log("🚨 Critical issues must be resolved before proceeding");
      }

      console.log(`📊 Production Readiness Score: ${readinessScore}%`);
    }

    // Exit with appropriate code
    process.exit(auditResult.success ? 0 : 1);
  } catch (error: any) {
    logError("Audit script failed", error);
    console.error("\n❌ AUDIT FAILED");
    console.error("==================");
    console.error(`Error: ${error.message}`);
    console.error("\nPlease check:");
    console.error("1. Environment variables are set correctly");
    console.error("2. Database is accessible");
    console.error("3. Twilio credentials are valid");
    console.error("4. Network connectivity to Twilio API");

    process.exit(1);
  }
}

function getRiskLevelEmoji(riskLevel: string): string {
  switch (riskLevel) {
    case "LOW":
      return "🟢";
    case "MEDIUM":
      return "🟡";
    case "HIGH":
      return "🟠";
    case "CRITICAL":
      return "🔴";
    default:
      return "⚪";
  }
}

function printUsage() {
  console.log(`
TFV Pipeline Audit Script
========================

Usage: tsx scripts/run-tfv-audit.ts [options]

Options:
  --business-id <id>      Business ID to audit (default: 1)
  --test-phone <number>   Phone number for testing (format: +1234567890)
  --include-messaging     Include message flow testing
  --skip-compliance       Skip compliance auditing
  --no-report            Don't generate markdown report
  --mode <mode>          Audit mode: quick | comprehensive | production-ready
  --sample-data          Use sample business data for testing
  --help                 Show this help message

Examples:
  # Quick health check
  tsx scripts/run-tfv-audit.ts --mode quick

  # Comprehensive audit with messaging
  tsx scripts/run-tfv-audit.ts --business-id 1 --include-messaging --test-phone +15551234567

  # Production readiness check
  tsx scripts/run-tfv-audit.ts --mode production-ready --business-id 1

  # Test with sample data
  tsx scripts/run-tfv-audit.ts --sample-data --include-messaging --test-phone +15551234567

Environment Variables Required:
  TWILIO_ACCOUNT_SID           Twilio Account SID
  TWILIO_AUTH_TOKEN           Twilio Auth Token  
  TWILIO_BUSINESS_PROFILE_SID  Trust Hub Customer Profile SID
  DATABASE_URL                Database connection string
  CLERK_SECRET_KEY            Clerk authentication key

Optional:
  TWILIO_WEBHOOK_URL          Webhook URL for status updates
  BASE_URL                    Base URL for the application
  `);
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
