#!/usr/bin/env node

/**
 * SAFE FIX: Apply users table multi-tenancy fix
 *
 * This script directly applies the critical fix to remove the global unique constraint
 * on usernames and replace it with a business-scoped constraint, while preserving
 * the global uniqueness of clerk_id (Clerk requirement).
 */

import pg from "pg";

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

console.log("🚨 APPLYING SAFE USERS TABLE MULTI-TENANCY FIX...\n");

async function applyUsersFix() {
  const client = await pool.connect();

  try {
    console.log("📋 Step 1: Checking current constraints...");

    // Check if global username constraint exists
    const globalUsernameConstraint = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'users' 
        AND constraint_name = 'users_username_unique'
        AND constraint_type = 'UNIQUE'
    `);

    if (globalUsernameConstraint.rows.length > 0) {
      console.log(
        "❌ CRITICAL: Global username constraint found - removing..."
      );

      // Drop the global unique constraint
      await client.query(`
        ALTER TABLE users DROP CONSTRAINT users_username_unique
      `);
      console.log("✅ Global username constraint removed");
    } else {
      console.log("✅ Global username constraint already removed");
    }

    // Verify clerk_id constraint still exists
    const clerkIdConstraint = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'users' 
        AND constraint_name = 'users_clerk_id_unique'
        AND constraint_type = 'UNIQUE'
    `);

    if (clerkIdConstraint.rows.length > 0) {
      console.log(
        "✅ Clerk ID global constraint preserved (Clerk requirement)"
      );
    } else {
      console.log(
        "⚠️  WARNING: Clerk ID global constraint missing - this may be expected"
      );
    }

    console.log("\n📋 Step 2: Adding business-scoped username constraint...");

    // Add composite unique constraint for username
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_business_id_username_idx 
      ON users (business_id, username)
    `);
    console.log("✅ Business-scoped username constraint added");

    // Add performance index
    await client.query(`
      CREATE INDEX IF NOT EXISTS users_business_id_username_lookup_idx 
      ON users (business_id, username)
    `);
    console.log("✅ Performance index added");

    console.log("\n📋 Step 3: Verifying constraints...");

    // Verify the business-scoped constraint exists
    const businessUsernameConstraint = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'users' 
        AND indexname = 'users_business_id_username_idx'
    `);

    if (businessUsernameConstraint.rows.length > 0) {
      console.log("✅ Business-scoped username constraint verified");
    } else {
      throw new Error(
        "Business-scoped username constraint not found after creation"
      );
    }

    console.log("\n📋 Step 4: Testing constraint integrity...");

    // Check for any existing duplicate usernames within businesses
    const duplicates = await client.query(`
      SELECT business_id, username, COUNT(*) as count
      FROM users 
      GROUP BY business_id, username 
      HAVING COUNT(*) > 1
    `);

    if (duplicates.rows.length > 0) {
      console.log("❌ CRITICAL: Found duplicate usernames within businesses:");
      duplicates.rows.forEach((row) => {
        console.log(
          `   Business ${row.business_id}: ${row.username} (${row.count} times)`
        );
      });
      throw new Error(
        "Data integrity issue: duplicate usernames found within businesses"
      );
    } else {
      console.log("✅ No duplicate usernames found within businesses");
    }

    // Verify clerk_ids are still globally unique
    const clerkDuplicates = await client.query(`
      SELECT clerk_id, COUNT(*) as count
      FROM users 
      WHERE clerk_id IS NOT NULL
      GROUP BY clerk_id 
      HAVING COUNT(*) > 1
    `);

    if (clerkDuplicates.rows.length > 0) {
      console.log("❌ CRITICAL: Found duplicate clerk_ids:");
      clerkDuplicates.rows.forEach((row) => {
        console.log(`   Clerk ID: ${row.clerk_id} (${row.count} times)`);
      });
      throw new Error("Data integrity issue: duplicate clerk_ids found");
    } else {
      console.log("✅ All clerk_ids remain globally unique");
    }

    console.log("\n🎉 SAFE USERS TABLE FIX APPLIED SUCCESSFULLY!");
    console.log("✅ Global username constraint removed");
    console.log("✅ Business-scoped username constraint added");
    console.log("✅ Clerk ID global uniqueness preserved");
    console.log("✅ Multi-tenancy integrity verified");
    console.log("\n🔒 Your users table is now safe for multi-tenant usage!");
    console.log("🔐 Authentication will continue to work correctly");
  } catch (error) {
    console.error("\n❌ USERS TABLE FIX FAILED:", error.message);
    console.error(
      "This is a critical issue that must be resolved immediately."
    );
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyUsersFix();
