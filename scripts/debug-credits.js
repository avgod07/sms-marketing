#!/usr/bin/env node

/**
 * Credit Debugging Script
 * Helps investigate unexpected credit changes by showing:
 * - Current credit balance
 * - Credit transaction history
 * - Any campaigns or committed messages
 * - Background job status
 */

// Environment variables should already be loaded by the build process

import { DatabaseStorage } from "../server/db/storage.js";
import { db } from "../server/db/index.js";
import { campaigns, committedMessages } from "../shared/schema.js";
import { eq, desc } from "drizzle-orm";

async function debugCredits(businessId) {
  console.log("🔍 CREDIT DEBUGGING ANALYSIS");
  console.log("=".repeat(50));

  try {
    const biz = new DatabaseStorage().forBusiness(businessId);

    // 1. Current Credit Balance
    console.log("\n💰 CURRENT CREDIT BALANCE:");
    const credits = await biz.getCredits();
    if (credits) {
      console.log(`   Balance: ${credits.balance} credits`);
      console.log(`   Last Updated: ${credits.updatedAt}`);
    } else {
      console.log("   ❌ No credit record found!");
    }

    // 2. Credit Transaction History (last 20)
    console.log("\n📊 CREDIT TRANSACTION HISTORY (last 20):");
    const transactions = await biz.getCreditTransactions();
    if (transactions.length === 0) {
      console.log("   ❌ No transactions found!");
    } else {
      transactions.slice(0, 20).forEach((tx, i) => {
        const sign = tx.amount >= 0 ? "+" : "";
        const metadata = tx.metadata ? JSON.parse(tx.metadata) : {};
        console.log(
          `   ${i + 1}. ${sign}${tx.amount} credits | ${
            tx.type
          } | ${tx.createdAt.toISOString()}`
        );
        console.log(`      Description: ${tx.description || "N/A"}`);
        if (Object.keys(metadata).length > 0) {
          console.log(`      Metadata: ${JSON.stringify(metadata, null, 8)}`);
        }
        console.log("");
      });
    }

    // 3. Check for Campaigns
    console.log("\n🎯 CAMPAIGNS (last 10):");
    const campaignList = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.businessId, businessId))
      .orderBy(desc(campaigns.createdAt))
      .limit(10);

    if (campaignList.length === 0) {
      console.log("   ✅ No campaigns found");
    } else {
      campaignList.forEach((campaign, i) => {
        console.log(
          `   ${i + 1}. Campaign "${campaign.name}" (ID: ${campaign.id})`
        );
        console.log(
          `      Status: ${campaign.status} | Processing: ${
            campaign.processingStatus || "N/A"
          }`
        );
        console.log(`      Created: ${campaign.createdAt.toISOString()}`);
        console.log(
          `      Sent Count: ${campaign.sentCount} | Delivered: ${campaign.deliveredCount}`
        );
        console.log("");
      });
    }

    // 4. Check for Committed Messages (new system)
    console.log("\n📨 COMMITTED MESSAGES (last 20):");
    const committed = await db
      .select()
      .from(committedMessages)
      .where(eq(committedMessages.businessId, businessId))
      .orderBy(desc(committedMessages.createdAt))
      .limit(20);

    if (committed.length === 0) {
      console.log("   ✅ No committed messages found");
    } else {
      console.log(`   Found ${committed.length} committed messages:`);
      committed.forEach((msg, i) => {
        console.log(
          `   ${i + 1}. ${msg.messageType} | Status: ${msg.status} | Credits: ${
            msg.creditCost
          }`
        );
        console.log(`      Created: ${msg.createdAt.toISOString()}`);
        console.log(`      Processed: ${msg.processedAt || "Not yet"}`);
        console.log("");
      });
    }

    // 5. Business Info
    console.log("\n🏢 BUSINESS INFO:");
    const business = await biz.getBusiness();
    console.log(`   Name: ${business.name}`);
    console.log(`   Plan: ${business.plan}`);
    console.log(`   Created: ${business.createdAt.toISOString()}`);

    // 6. Phone Numbers
    console.log("\n📞 PHONE NUMBERS:");
    const phoneNumbers = await biz.getPhoneNumbers();
    if (phoneNumbers.length === 0) {
      console.log("   ⚠️  No phone numbers configured");
    } else {
      phoneNumbers.forEach((phone, i) => {
        console.log(
          `   ${i + 1}. ${phone.phoneNumber} ${
            phone.isDefault ? "(DEFAULT)" : ""
          }`
        );
      });
    }

    console.log("\n" + "=".repeat(50));
    console.log("🎯 ANALYSIS COMPLETE");

    // Analysis
    if (credits && credits.balance === 43) {
      console.log("\n🔍 SPECIFIC ANALYSIS FOR 43 CREDITS:");
      console.log("   • Expected trial balance: 50 credits");
      console.log("   • Current balance: 43 credits");
      console.log("   • Missing: 7 credits");
      console.log("");
      console.log("   Possible causes:");
      console.log(
        "   1. Created a campaign with ~7 messages (credits deducted immediately)"
      );
      console.log("   2. Message commitment without phone number setup");
      console.log("   3. Background job processed something unexpected");
      console.log("");
      console.log(
        "   Check the transaction history above for 'message_commitment' entries!"
      );
    }
  } catch (error) {
    console.error("❌ Error during analysis:", error);
  }
}

// Get business ID from command line or use default
const businessId = process.argv[2] ? parseInt(process.argv[2]) : 1;

console.log(`Analyzing credits for Business ID: ${businessId}`);
console.log("Usage: node scripts/debug-credits.js [businessId]");
console.log("");

await debugCredits(businessId);
process.exit(0);
