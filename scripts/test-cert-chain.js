import tls from "tls";
import fs from "fs";

console.log("🔍 Testing TLS handshake with RDS...");

const socket = tls.connect(
  {
    host: "sms-app-db-1752198434.ci16q22uympu.us-east-1.rds.amazonaws.com",
    port: 5432,
    ca: fs.readFileSync("/app/certs/us-east-1-bundle.pem").toString(),
    rejectUnauthorized: true,
  },
  () => {
    console.log("✅ TLS handshake success");
    console.log("🔍 Certificate info:", socket.getPeerCertificate());
    socket.end();
  }
);

socket.on("error", (err) => {
  console.error("❌ TLS handshake failed:", err.message);
  console.error("🔍 Error code:", err.code);
  console.error("🔍 Error stack:", err.stack);
});

socket.on("close", () => {
  console.log("🔍 TLS connection closed");
});
