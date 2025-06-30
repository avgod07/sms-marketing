#!/usr/bin/env node

/**
 * CRITICAL FIX: Apply phone number multi-tenancy constraint fix
 *
 * This script directly applies the critical fix to remove the global unique constraint
 * on phone numbers and replace it with a business-scoped constraint.
 */

import pg from "pg";
import fs from "fs";
import path from "path";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

console.log("🚨 APPLYING CRITICAL PHONE NUMBER CONSTRAINT FIX...\n");

async function applyCriticalFix() {
  const client = await pool.connect();

  try {
    console.log("📋 Step 1: Checking current constraints...");

    // Check if global constraint exists
    const globalConstraint = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'contacts' 
        AND constraint_name = 'contacts_phone_number_unique'
        AND constraint_type = 'UNIQUE'
    `);

    if (globalConstraint.rows.length > 0) {
      console.log("❌ CRITICAL: Global unique constraint found - removing...");

      // Drop the global unique constraint
      await client.query(`
        ALTER TABLE contacts DROP CONSTRAINT contacts_phone_number_unique
      `);
      console.log("✅ Global unique constraint removed");
    } else {
      console.log("✅ Global unique constraint already removed");
    }

    console.log("\n📋 Step 2: Adding business-scoped constraint...");

    // Add composite unique constraint
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS contacts_business_id_phone_number_idx 
      ON contacts (business_id, phone_number)
    `);
    console.log("✅ Business-scoped unique constraint added");

    // Add performance index
    await client.query(`
      CREATE INDEX IF NOT EXISTS contacts_business_id_phone_number_lookup_idx 
      ON contacts (business_id, phone_number)
    `);
    console.log("✅ Performance index added");

    console.log("\n📋 Step 3: Verifying constraint...");

    // Verify the constraint exists
    const businessConstraint = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'contacts' 
        AND indexname = 'contacts_business_id_phone_number_idx'
    `);

    if (businessConstraint.rows.length > 0) {
      console.log("✅ Business-scoped constraint verified");
    } else {
      throw new Error("Business-scoped constraint not found after creation");
    }

    console.log("\n📋 Step 4: Testing constraint integrity...");

    // Check for any existing duplicate phone numbers within businesses
    const duplicates = await client.query(`
      SELECT business_id, phone_number, COUNT(*) as count
      FROM contacts 
      GROUP BY business_id, phone_number 
      HAVING COUNT(*) > 1
    `);

    if (duplicates.rows.length > 0) {
      console.log(
        "❌ CRITICAL: Found duplicate phone numbers within businesses:"
      );
      duplicates.rows.forEach((row) => {
        console.log(
          `   Business ${row.business_id}: ${row.phone_number} (${row.count} times)`
        );
      });
      throw new Error(
        "Data integrity issue: duplicate phone numbers found within businesses"
      );
    } else {
      console.log("✅ No duplicate phone numbers found within businesses");
    }

    console.log("\n🎉 CRITICAL FIX APPLIED SUCCESSFULLY!");
    console.log("✅ Global phone number constraint removed");
    console.log("✅ Business-scoped constraint added");
    console.log("✅ Multi-tenancy integrity verified");
    console.log("\n🔒 Your database is now safe for multi-tenant usage!");
  } catch (error) {
    console.error("\n❌ CRITICAL FIX FAILED:", error.message);
    console.error(
      "This is a critical issue that must be resolved immediately."
    );
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyCriticalFix();
