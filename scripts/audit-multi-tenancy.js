#!/usr/bin/env node

/**
 * CRITICAL DATABASE MULTI-TENANCY AUDIT SCRIPT
 *
 * This script audits the entire database for multi-tenancy violations:
 * 1. Global unique constraints that should be business-scoped
 * 2. Missing business_id foreign keys
 * 3. Cross-business data leakage potential
 * 4. Index issues that could affect multi-tenancy
 * 5. Constraint violations
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

console.log("🔍 STARTING CRITICAL MULTI-TENANCY AUDIT...\n");

let auditResults = {
  critical: [],
  warnings: [],
  passed: [],
  summary: {
    totalIssues: 0,
    criticalIssues: 0,
    warnings: 0,
    passedChecks: 0,
  },
};

function addCritical(issue) {
  auditResults.critical.push(issue);
  auditResults.summary.criticalIssues++;
  auditResults.summary.totalIssues++;
  console.log(`❌ CRITICAL: ${issue}`);
}

function addWarning(issue) {
  auditResults.warnings.push(issue);
  auditResults.summary.warnings++;
  auditResults.summary.totalIssues++;
  console.log(`⚠️  WARNING: ${issue}`);
}

function addPassed(check) {
  auditResults.passed.push(check);
  auditResults.summary.passedChecks++;
  console.log(`✅ PASSED: ${check}`);
}

async function auditConstraints() {
  console.log("📋 AUDITING DATABASE CONSTRAINTS...\n");

  try {
    // Check for global unique constraints that should be business-scoped
    const result = await pool.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        kcu.column_name,
        tc.constraint_type
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_schema = 'public'
        AND tc.table_name NOT IN ('businesses', 'subscription_plans')
      ORDER BY tc.table_name, kcu.column_name;
    `);

    const tablesWithBusinessId = [
      "contacts",
      "campaigns",
      "messages",
      "coupons",
      "coupon_redemptions",
      "coupon_recipients",
      "analytics",
      "users",
      "business_profiles",
      "twilio_credentials",
      "business_phone_numbers",
      "twilio_a2p_config",
      "business_credits",
      "credit_transactions",
      "onboarding_progress",
      "subscription_events",
    ];

    for (const row of result.rows) {
      const { table_name, constraint_name, column_name, constraint_type } = row;

      if (tablesWithBusinessId.includes(table_name)) {
        // Check if this is a global unique constraint on a field that should be business-scoped
        if (
          constraint_type === "UNIQUE" &&
          !constraint_name.includes("business_id")
        ) {
          // Special case: clerk_id should remain globally unique (Clerk requirement)
          if (table_name === "users" && column_name === "clerk_id") {
            addPassed(
              `Global unique constraint '${constraint_name}' on ${table_name}.${column_name} is correct (Clerk requirement)`
            );
          } else {
            addCritical(
              `Global unique constraint '${constraint_name}' on ${table_name}.${column_name} should be business-scoped`
            );
          }
        } else if (constraint_name.includes("business_id")) {
          addPassed(
            `Business-scoped constraint '${constraint_name}' on ${table_name}.${column_name} is correct`
          );
        }
      } else {
        // Tables without business_id can have global unique constraints
        addPassed(
          `Global unique constraint '${constraint_name}' on ${table_name}.${column_name} is appropriate (no business_id)`
        );
      }
    }
  } catch (error) {
    addCritical(`Failed to audit constraints: ${error.message}`);
  }
}

async function auditForeignKeys() {
  console.log("\n🔗 AUDITING FOREIGN KEY RELATIONSHIPS...\n");

  try {
    const result = await pool.query(`
      SELECT 
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name NOT IN ('businesses')
      ORDER BY tc.table_name, kcu.column_name;
    `);

    for (const row of result.rows) {
      const {
        table_name,
        column_name,
        foreign_table_name,
        foreign_column_name,
      } = row;

      // Check if child table has business_id and parent table has business_id
      const childHasBusinessId = await pool.query(
        `
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'business_id'
      `,
        [table_name]
      );

      const parentHasBusinessId = await pool.query(
        `
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'business_id'
      `,
        [foreign_table_name]
      );

      if (
        childHasBusinessId.rows.length > 0 &&
        parentHasBusinessId.rows.length > 0
      ) {
        addPassed(
          `Foreign key ${table_name}.${column_name} -> ${foreign_table_name}.${foreign_column_name} maintains business isolation`
        );
      } else if (
        childHasBusinessId.rows.length > 0 &&
        parentHasBusinessId.rows.length === 0
      ) {
        addWarning(
          `Foreign key ${table_name}.${column_name} -> ${foreign_table_name}.${foreign_column_name} may allow cross-business access (parent has no business_id)`
        );
      } else {
        addPassed(
          `Foreign key ${table_name}.${column_name} -> ${foreign_table_name}.${foreign_column_name} is appropriate`
        );
      }
    }
  } catch (error) {
    addCritical(`Failed to audit foreign keys: ${error.message}`);
  }
}

async function auditIndexes() {
  console.log("\n📊 AUDITING DATABASE INDEXES...\n");

  try {
    const result = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename NOT IN ('businesses', 'subscription_plans')
      ORDER BY tablename, indexname;
    `);

    for (const row of result.rows) {
      const { tablename, indexname, indexdef } = row;

      // Check if this is a unique index that should include business_id
      if (indexdef.includes("UNIQUE") && !indexdef.includes("business_id")) {
        const hasBusinessId = await pool.query(
          `
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'business_id'
        `,
          [tablename]
        );

        if (hasBusinessId.rows.length > 0) {
          addWarning(
            `Unique index '${indexname}' on ${tablename} may not be business-scoped`
          );
        }
      } else if (indexdef.includes("business_id")) {
        addPassed(
          `Business-scoped index '${indexname}' on ${tablename} is correct`
        );
      } else {
        addPassed(`Index '${indexname}' on ${tablename} is appropriate`);
      }
    }
  } catch (error) {
    addCritical(`Failed to audit indexes: ${error.message}`);
  }
}

async function auditDataIntegrity() {
  console.log("\n🔒 AUDITING DATA INTEGRITY...\n");

  try {
    // Check for orphaned records (child records without valid parent)
    const tablesWithBusinessId = [
      "contacts",
      "campaigns",
      "messages",
      "coupons",
      "coupon_redemptions",
      "coupon_recipients",
      "analytics",
      "users",
      "business_profiles",
      "twilio_credentials",
      "business_phone_numbers",
      "twilio_a2p_config",
      "business_credits",
      "credit_transactions",
      "onboarding_progress",
      "subscription_events",
    ];

    for (const table of tablesWithBusinessId) {
      const result = await pool.query(`
        SELECT COUNT(*) as orphaned_count
        FROM ${table} c
        LEFT JOIN businesses b ON c.business_id = b.id
        WHERE b.id IS NULL
      `);

      const orphanedCount = parseInt(result.rows[0].orphaned_count);
      if (orphanedCount > 0) {
        addCritical(
          `${orphanedCount} orphaned records found in ${table} (no valid business_id)`
        );
      } else {
        addPassed(`No orphaned records found in ${table}`);
      }
    }
  } catch (error) {
    addCritical(`Failed to audit data integrity: ${error.message}`);
  }
}

async function auditPhoneNumberConstraint() {
  console.log("\n📱 AUDITING PHONE NUMBER CONSTRAINT...\n");

  try {
    // Check if the global unique constraint still exists
    const globalConstraint = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'contacts' 
        AND constraint_name = 'contacts_phone_number_unique'
        AND constraint_type = 'UNIQUE'
    `);

    if (globalConstraint.rows.length > 0) {
      addCritical(
        "Global unique constraint on contacts.phone_number still exists - CRITICAL MULTI-TENANCY VIOLATION"
      );
    } else {
      addPassed(
        "Global unique constraint on contacts.phone_number has been removed"
      );
    }

    // Check if business-scoped constraint exists
    const businessConstraint = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'contacts' 
        AND indexname = 'contacts_business_id_phone_number_idx'
    `);

    if (businessConstraint.rows.length > 0) {
      addPassed(
        "Business-scoped unique constraint on contacts (business_id, phone_number) exists"
      );
    } else {
      addCritical(
        "Business-scoped unique constraint on contacts (business_id, phone_number) is missing"
      );
    }

    // Test the constraint by checking for duplicate phone numbers within businesses
    const duplicates = await pool.query(`
      SELECT business_id, phone_number, COUNT(*) as count
      FROM contacts 
      GROUP BY business_id, phone_number 
      HAVING COUNT(*) > 1
    `);

    if (duplicates.rows.length > 0) {
      addCritical(
        `${duplicates.rows.length} duplicate phone numbers found within the same business`
      );
    } else {
      addPassed("No duplicate phone numbers found within the same business");
    }
  } catch (error) {
    addCritical(`Failed to audit phone number constraint: ${error.message}`);
  }
}

async function generateReport() {
  console.log("\n📋 AUDIT SUMMARY REPORT\n");
  console.log("=".repeat(50));

  if (auditResults.summary.criticalIssues > 0) {
    console.log(`❌ CRITICAL ISSUES: ${auditResults.summary.criticalIssues}`);
    auditResults.critical.forEach((issue) => console.log(`   • ${issue}`));
  }

  if (auditResults.summary.warnings > 0) {
    console.log(`\n⚠️  WARNINGS: ${auditResults.summary.warnings}`);
    auditResults.warnings.forEach((warning) => console.log(`   • ${warning}`));
  }

  console.log(`\n✅ PASSED CHECKS: ${auditResults.summary.passedChecks}`);

  console.log("\n" + "=".repeat(50));

  if (auditResults.summary.criticalIssues === 0) {
    console.log(
      "🎉 MULTI-TENANCY AUDIT PASSED - DATABASE IS SAFE FOR PRODUCTION"
    );
  } else {
    console.log(
      "🚨 CRITICAL MULTI-TENANCY VIOLATIONS FOUND - IMMEDIATE ACTION REQUIRED"
    );
    process.exit(1);
  }
}

async function main() {
  try {
    await auditConstraints();
    await auditForeignKeys();
    await auditIndexes();
    await auditDataIntegrity();
    await auditPhoneNumberConstraint();
    await generateReport();
  } catch (error) {
    console.error("❌ Audit failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
