import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { db } from "../server/config/db.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  console.log(
    "🔄 Starting migration: Add messaging_service_sid to businesses table..."
  );

  try {
    // Read the migration SQL file
    const migrationSql = readFileSync(
      join(
        __dirname,
        "../migrations/0015_add_messaging_service_to_businesses.sql"
      ),
      "utf8"
    );

    // Execute the migration
    await db.execute(migrationSql);

    console.log("✅ Migration completed successfully!");
    console.log("📄 Changes applied:");
    console.log("   - Added messaging_service_sid column to businesses table");
    console.log("   - Migrated existing data from twilio_credentials table");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runMigration();
