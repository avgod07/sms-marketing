import pkg from "pg";
const { Client } = pkg;
import fs from "fs";

console.log("🔍 Testing pg client connection...");
console.log("🔍 Using DATABASE_URL:", process.env.DATABASE_URL);
console.log("🔍 Cert path:", "/app/certs/us-east-1-bundle.pem");

try {
  const certContent = fs
    .readFileSync("/app/certs/us-east-1-bundle.pem")
    .toString();
  console.log("🔍 Cert loaded:", certContent.split("\n")[0]);
} catch (error) {
  console.error("❌ Failed to load certificate:", error);
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    ca: fs.readFileSync("/app/certs/us-east-1-bundle.pem").toString(),
    rejectUnauthorized: true,
  },
});

client
  .connect()
  .then(() => {
    console.log("✅ Connected via pg");
    return client.query("SELECT 1 as test");
  })
  .then((result) => {
    console.log("✅ Query successful:", result.rows[0]);
    return client.end();
  })
  .catch((err) => {
    console.error("❌ PG connection failed:", err.message);
    console.error("🔍 Error code:", err.code);
    console.error("🔍 Error stack:", err.stack);
  });
