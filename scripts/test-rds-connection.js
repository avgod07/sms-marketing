import pg from "pg";
import { readFileSync } from "fs";

// Load environment variables from .env.production if it exists
if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
  try {
    const envFile = readFileSync(".env.production", "utf8");
    const envVars = envFile.split("\n").filter((line) => line.includes("="));
    envVars.forEach((line) => {
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        process.env[key] = valueParts.join("=");
      }
    });
    console.log("✅ Loaded environment from .env.production");
  } catch (error) {
    console.log("⚠️  Could not load .env.production:", error.message);
  }
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ ERROR: DATABASE_URL not found");
  console.log(
    "Make sure DATABASE_URL is set in your environment or .env.production file"
  );
  process.exit(1);
}

console.log("🔄 Testing RDS connection...");
console.log("Connection details:");
const url = new URL(connectionString);
console.log(`  Host: ${url.hostname}`);
console.log(`  Port: ${url.port || 5432}`);
console.log(`  Database: ${url.pathname.slice(1)}`);
console.log(`  Username: ${url.username}`);
console.log(`  SSL Mode: ${url.searchParams.get("sslmode") || "prefer"}`);
console.log("");

const client = new pg.Client({
  connectionString,
  // Explicit SSL configuration for RDS
  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false, // For RDS compatibility
        }
      : false,
});

async function testConnection() {
  try {
    console.log("🔌 Attempting to connect...");
    await client.connect();
    console.log("✅ Connection successful!");

    console.log("🔍 Testing basic query...");
    const result = await client.query(
      "SELECT version() as version, current_database() as database, current_user as user"
    );
    console.log("✅ Query successful!");
    console.log("Database info:");
    console.log(
      `  Version: ${result.rows[0].version.split(" ").slice(0, 2).join(" ")}`
    );
    console.log(`  Database: ${result.rows[0].database}`);
    console.log(`  User: ${result.rows[0].user}`);

    console.log("🔍 Testing schema access...");
    const tables = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    console.log(`✅ Found ${tables.rows.length} tables in public schema`);
    if (tables.rows.length > 0) {
      console.log("Tables:", tables.rows.map((r) => r.tablename).join(", "));
    }
  } catch (error) {
    console.error("❌ Connection failed!");
    console.error("Error details:");
    console.error(`  Code: ${error.code || "N/A"}`);
    console.error(`  Message: ${error.message}`);

    if (error.code === "ENOTFOUND") {
      console.log("\n💡 Troubleshooting suggestions:");
      console.log("  - Check if the RDS endpoint is correct");
      console.log("  - Verify your internet/VPC connectivity");
    } else if (error.code === "ECONNREFUSED") {
      console.log("\n💡 Troubleshooting suggestions:");
      console.log("  - Check if RDS instance is running");
      console.log("  - Verify security groups allow inbound connections");
      console.log("  - Check if the port (5432) is correct");
    } else if (error.message.includes("password authentication failed")) {
      console.log("\n💡 Troubleshooting suggestions:");
      console.log("  - Check username and password in DATABASE_URL");
      console.log("  - Verify RDS master credentials");
    } else if (error.message.includes("SSL")) {
      console.log("\n💡 Troubleshooting suggestions:");
      console.log("  - RDS requires SSL connections");
      console.log('  - Check SSL mode in DATABASE_URL (should be "require")');
    }

    process.exit(1);
  } finally {
    try {
      await client.end();
      console.log("🔌 Connection closed");
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

testConnection();
