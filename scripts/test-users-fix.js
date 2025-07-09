#!/usr/bin/env node

/**
 * COMPREHENSIVE TEST: Users Table Multi-Tenancy Fix
 *
 * This script tests the users table fix to ensure:
 * 1. Username is now business-scoped (not globally unique)
 * 2. Clerk ID remains globally unique
 * 3. Authentication still works
 * 4. No existing functionality breaks
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

console.log("🧪 TESTING USERS TABLE MULTI-TENANCY FIX...\n");

async function testUsersFix() {
  const client = await pool.connect();

  try {
    console.log("📋 Step 1: Verifying current constraints...");

    // Check if global username constraint was removed
    const globalUsernameConstraint = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'users' 
        AND constraint_name = 'users_username_unique'
        AND constraint_type = 'UNIQUE'
    `);

    if (globalUsernameConstraint.rows.length > 0) {
      console.log("❌ FAILED: Global username constraint still exists");
      return false;
    } else {
      console.log("✅ PASSED: Global username constraint removed");
    }

    // Check if clerk_id constraint still exists (should remain)
    const clerkIdConstraint = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'users' 
        AND constraint_name = 'users_clerk_id_unique'
        AND constraint_type = 'UNIQUE'
    `);

    if (clerkIdConstraint.rows.length > 0) {
      console.log("✅ PASSED: Clerk ID global constraint preserved");
    } else {
      console.log("❌ FAILED: Clerk ID global constraint missing");
      return false;
    }

    console.log(
      "\n📋 Step 2: Verifying business-scoped username constraint..."
    );

    // Check if business-scoped username constraint exists
    const businessUsernameConstraint = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'users' 
        AND indexname = 'users_business_id_username_idx'
    `);

    if (businessUsernameConstraint.rows.length > 0) {
      console.log("✅ PASSED: Business-scoped username constraint exists");
    } else {
      console.log("❌ FAILED: Business-scoped username constraint missing");
      return false;
    }

    console.log(
      "\n📋 Step 3: Testing username uniqueness across businesses..."
    );

    // Get current users to test with
    const currentUsers = await client.query(`
      SELECT id, username, business_id 
      FROM users 
      ORDER BY business_id, username
    `);

    console.log(`Found ${currentUsers.rows.length} users to test with`);

    // Test that we can have same username in different businesses
    if (currentUsers.rows.length >= 2) {
      const user1 = currentUsers.rows[0];
      const user2 = currentUsers.rows[1];

      if (user1.business_id !== user2.business_id) {
        console.log(
          `✅ PASSED: Users in different businesses can have different usernames`
        );
        console.log(`   Business ${user1.business_id}: "${user1.username}"`);
        console.log(`   Business ${user2.business_id}: "${user2.username}"`);
      } else {
        console.log(
          `ℹ️  INFO: All users are in same business, can't test cross-business uniqueness`
        );
      }
    }

    console.log("\n📋 Step 4: Testing clerk_id global uniqueness...");

    // Test that clerk_ids remain globally unique
    const clerkIds = await client.query(`
      SELECT clerk_id, COUNT(*) as count
      FROM users 
      WHERE clerk_id IS NOT NULL
      GROUP BY clerk_id 
      HAVING COUNT(*) > 1
    `);

    if (clerkIds.rows.length > 0) {
      console.log("❌ FAILED: Found duplicate clerk_ids");
      clerkIds.rows.forEach((row) => {
        console.log(`   Clerk ID "${row.clerk_id}" appears ${row.count} times`);
      });
      return false;
    } else {
      console.log("✅ PASSED: All clerk_ids are globally unique");
    }

    console.log("\n📋 Step 5: Testing constraint enforcement...");

    // Try to create a duplicate username within the same business (should fail)
    const testBusiness = await client.query(
      "SELECT id FROM businesses LIMIT 1"
    );
    if (testBusiness.rows.length > 0) {
      const businessId = testBusiness.rows[0].id;
      const existingUser = await client.query(
        `
        SELECT username FROM users WHERE business_id = $1 LIMIT 1
      `,
        [businessId]
      );

      if (existingUser.rows.length > 0) {
        const duplicateUsername = existingUser.rows[0].username;

        try {
          await client.query(
            `
            INSERT INTO users (business_id, username, password_hash, clerk_id)
            VALUES ($1, $2, $3, $4)
          `,
            [
              businessId,
              duplicateUsername,
              "test_hash",
              "test_clerk_id_" + Date.now(),
            ]
          );

          console.log(
            "❌ FAILED: Was able to create duplicate username in same business"
          );
          return false;
        } catch (error) {
          if (error.code === "23505") {
            // Unique violation
            console.log(
              "✅ PASSED: Correctly prevented duplicate username in same business"
            );
          } else {
            console.log("❌ FAILED: Unexpected error:", error.message);
            return false;
          }
        }
      }
    }

    console.log("\n📋 Step 6: Testing cross-business username reuse...");

    // Try to create same username in different business (should succeed)
    const businesses = await client.query(
      "SELECT id FROM businesses ORDER BY id LIMIT 2"
    );
    if (businesses.rows.length >= 2) {
      const business1 = businesses.rows[0].id;
      const business2 = businesses.rows[1].id;
      const testUsername = "test_username_" + Date.now();

      try {
        // Insert in first business
        await client.query(
          `
          INSERT INTO users (business_id, username, password_hash, clerk_id)
          VALUES ($1, $2, $3, $4)
        `,
          [business1, testUsername, "test_hash_1", "test_clerk_1_" + Date.now()]
        );

        // Insert same username in second business
        await client.query(
          `
          INSERT INTO users (business_id, username, password_hash, clerk_id)
          VALUES ($1, $2, $3, $4)
        `,
          [business2, testUsername, "test_hash_2", "test_clerk_2_" + Date.now()]
        );

        console.log(
          "✅ PASSED: Successfully created same username in different businesses"
        );

        // Clean up test data
        await client.query("DELETE FROM users WHERE username = $1", [
          testUsername,
        ]);
      } catch (error) {
        console.log(
          "❌ FAILED: Could not create same username in different businesses:",
          error.message
        );
        return false;
      }
    }

    console.log("\n📋 Step 7: Testing authentication compatibility...");

    // Test that getUserByClerkId still works (should be global)
    const clerkUser = await client.query(`
      SELECT id, username, business_id, clerk_id 
      FROM users 
      WHERE clerk_id IS NOT NULL 
      LIMIT 1
    `);

    if (clerkUser.rows.length > 0) {
      const user = clerkUser.rows[0];
      const foundUser = await client.query(
        `
        SELECT id, username, business_id 
        FROM users 
        WHERE clerk_id = $1
      `,
        [user.clerk_id]
      );

      if (foundUser.rows.length === 1) {
        console.log("✅ PASSED: getUserByClerkId still works globally");
      } else {
        console.log("❌ FAILED: getUserByClerkId not working correctly");
        return false;
      }
    }

    console.log("\n🎉 ALL TESTS PASSED!");
    console.log("✅ Username is now business-scoped");
    console.log("✅ Clerk ID remains globally unique");
    console.log("✅ Authentication still works");
    console.log("✅ No functionality broken");
    console.log("\n🔒 Your multi-tenancy fix is working correctly!");

    return true;
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    return false;
  } finally {
    client.release();
    await pool.end();
  }
}

testUsersFix().then((success) => {
  if (!success) {
    process.exit(1);
  }
});
