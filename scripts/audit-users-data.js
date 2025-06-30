#!/usr/bin/env node

/**
 * AUDIT USERS TABLE DATA
 *
 * This script audits the current users table to understand:
 * 1. How clerk_id is being used
 * 2. Whether there are duplicate usernames across businesses
 * 3. Whether there are duplicate clerk_ids across businesses
 * 4. Current data patterns to inform the migration strategy
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

console.log("🔍 AUDITING USERS TABLE DATA...\n");

async function auditUsersData() {
  const client = await pool.connect();

  try {
    console.log("📋 Step 1: Analyzing current users data...");

    // Get total count
    const totalUsers = await client.query(
      "SELECT COUNT(*) as count FROM users"
    );
    console.log(`Total users: ${totalUsers.rows[0].count}`);

    // Get users with clerk_id
    const clerkUsers = await client.query(
      "SELECT COUNT(*) as count FROM users WHERE clerk_id IS NOT NULL"
    );
    console.log(`Users with clerk_id: ${clerkUsers.rows[0].count}`);

    // Get users without clerk_id
    const nonClerkUsers = await client.query(
      "SELECT COUNT(*) as count FROM users WHERE clerk_id IS NULL"
    );
    console.log(`Users without clerk_id: ${nonClerkUsers.rows[0].count}`);

    console.log(
      "\n📋 Step 2: Checking for duplicate usernames across businesses..."
    );

    // Check for duplicate usernames across different businesses
    const duplicateUsernames = await client.query(`
      SELECT username, COUNT(DISTINCT business_id) as business_count, 
             array_agg(DISTINCT business_id) as business_ids
      FROM users 
      GROUP BY username 
      HAVING COUNT(DISTINCT business_id) > 1
      ORDER BY business_count DESC
    `);

    if (duplicateUsernames.rows.length > 0) {
      console.log(
        `❌ Found ${duplicateUsernames.rows.length} usernames used across multiple businesses:`
      );
      duplicateUsernames.rows.forEach((row) => {
        console.log(
          `   Username: "${row.username}" - Used in ${
            row.business_count
          } businesses (IDs: ${row.business_ids.join(", ")})`
        );
      });
    } else {
      console.log("✅ No duplicate usernames found across businesses");
    }

    console.log(
      "\n📋 Step 3: Checking for duplicate clerk_ids across businesses..."
    );

    // Check for duplicate clerk_ids across different businesses
    const duplicateClerkIds = await client.query(`
      SELECT clerk_id, COUNT(DISTINCT business_id) as business_count, 
             array_agg(DISTINCT business_id) as business_ids
      FROM users 
      WHERE clerk_id IS NOT NULL
      GROUP BY clerk_id 
      HAVING COUNT(DISTINCT business_id) > 1
      ORDER BY business_count DESC
    `);

    if (duplicateClerkIds.rows.length > 0) {
      console.log(
        `❌ Found ${duplicateClerkIds.rows.length} clerk_ids used across multiple businesses:`
      );
      duplicateClerkIds.rows.forEach((row) => {
        console.log(
          `   Clerk ID: "${row.clerk_id}" - Used in ${
            row.business_count
          } businesses (IDs: ${row.business_ids.join(", ")})`
        );
      });
    } else {
      console.log("✅ No duplicate clerk_ids found across businesses");
    }

    console.log("\n📋 Step 4: Analyzing clerk_id patterns...");

    // Check clerk_id format patterns
    const clerkIdPatterns = await client.query(`
      SELECT 
        CASE 
          WHEN clerk_id LIKE 'user_%' THEN 'Generated (user_*)'
          WHEN clerk_id LIKE 'clerk_%' THEN 'Clerk format (clerk_*)'
          ELSE 'Other format'
        END as pattern,
        COUNT(*) as count
      FROM users 
      WHERE clerk_id IS NOT NULL
      GROUP BY pattern
      ORDER BY count DESC
    `);

    console.log("Clerk ID patterns:");
    clerkIdPatterns.rows.forEach((row) => {
      console.log(`   ${row.pattern}: ${row.count} users`);
    });

    console.log("\n📋 Step 5: Checking username patterns...");

    // Check username patterns
    const usernamePatterns = await client.query(`
      SELECT 
        CASE 
          WHEN username LIKE 'user_%' THEN 'Generated (user_*)'
          WHEN username LIKE 'demo%' THEN 'Demo users'
          WHEN username LIKE 'admin%' THEN 'Admin users'
          ELSE 'Custom usernames'
        END as pattern,
        COUNT(*) as count
      FROM users 
      GROUP BY pattern
      ORDER BY count DESC
    `);

    console.log("Username patterns:");
    usernamePatterns.rows.forEach((row) => {
      console.log(`   ${row.pattern}: ${row.count} users`);
    });

    console.log("\n📋 Step 6: Sample data analysis...");

    // Show sample of users with their business info
    const sampleUsers = await client.query(`
      SELECT u.id, u.username, u.clerk_id, u.business_id, b.name as business_name
      FROM users u
      JOIN businesses b ON u.business_id = b.id
      ORDER BY u.created_at DESC
      LIMIT 10
    `);

    console.log("Sample users (most recent 10):");
    sampleUsers.rows.forEach((row) => {
      console.log(
        `   ID: ${row.id}, Username: "${row.username}", Clerk ID: "${
          row.clerk_id || "NULL"
        }", Business: "${row.business_name}" (ID: ${row.business_id})`
      );
    });

    console.log("\n📋 Step 7: Migration readiness assessment...");

    const hasDuplicateUsernames = duplicateUsernames.rows.length > 0;
    const hasDuplicateClerkIds = duplicateClerkIds.rows.length > 0;

    if (hasDuplicateUsernames || hasDuplicateClerkIds) {
      console.log("❌ MIGRATION BLOCKERS FOUND:");
      if (hasDuplicateUsernames) {
        console.log(
          "   - Duplicate usernames across businesses will prevent business-scoped uniqueness"
        );
      }
      if (hasDuplicateClerkIds) {
        console.log(
          "   - Duplicate clerk_ids across businesses will prevent business-scoped uniqueness"
        );
      }
      console.log("\n💡 RECOMMENDATIONS:");
      console.log(
        "   1. Resolve duplicate usernames by adding business-specific suffixes"
      );
      console.log(
        "   2. Investigate duplicate clerk_ids - these may indicate a data integrity issue"
      );
      console.log(
        "   3. Consider if clerk_ids should remain globally unique (Clerk requirement)"
      );
    } else {
      console.log("✅ NO MIGRATION BLOCKERS FOUND");
      console.log(
        "   - Safe to proceed with business-scoped uniqueness constraints"
      );
    }

    console.log("\n📋 Step 8: Clerk ID uniqueness recommendation...");

    // Check if clerk_ids follow Clerk's global uniqueness pattern
    const clerkIdAnalysis = await client.query(`
      SELECT 
        COUNT(DISTINCT clerk_id) as unique_clerk_ids,
        COUNT(*) as total_users_with_clerk_id
      FROM users 
      WHERE clerk_id IS NOT NULL
    `);

    const uniqueCount = clerkIdAnalysis.rows[0].unique_clerk_ids;
    const totalClerkUsers = clerkIdAnalysis.rows[0].total_users_with_clerk_id;

    if (uniqueCount === totalClerkUsers) {
      console.log("✅ All clerk_ids are currently unique");
      console.log(
        "💡 RECOMMENDATION: Keep clerk_id globally unique (Clerk requirement)"
      );
      console.log("   - Only change username to business-scoped uniqueness");
    } else {
      console.log("❌ Found duplicate clerk_ids within the same data");
      console.log("💡 RECOMMENDATION: Investigate data integrity issues");
    }
  } catch (error) {
    console.error("\n❌ Audit failed:", error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

auditUsersData();
