import crypto from "crypto";

const algorithm = "aes-256-cbc";

// Validate encryption key is set
if (!process.env.ENCRYPTION_KEY) {
  throw new Error(
    "ENCRYPTION_KEY environment variable must be set for production"
  );
}

const key = crypto
  .createHash("sha256")
  .update(process.env.ENCRYPTION_KEY)
  .digest();
const ivLength = 16;

export function encrypt(text: string): string {
  if (!text) {
    throw new Error("Cannot encrypt empty string");
  }

  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  return iv.toString("base64") + ":" + encrypted;
}

export function decrypt(payload: string): string {
  if (!payload || !payload.includes(":")) {
    throw new Error("Invalid encrypted payload format");
  }

  const [ivStr, data] = payload.split(":");
  if (!ivStr || !data) {
    throw new Error("Invalid encrypted payload structure");
  }

  try {
    const iv = Buffer.from(ivStr, "base64");
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(data, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    throw new Error(
      "Failed to decrypt payload: " +
        (error instanceof Error ? error.message : "Unknown error")
    );
  }
}
