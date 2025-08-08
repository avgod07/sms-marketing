import crypto from "crypto";

const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || "your-32-character-secret-key-here!";
const ALGORITHM = "aes-256-gcm";

export class EncryptionService {
  static encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const key = Buffer.from(ENCRYPTION_KEY, "utf8").subarray(0, 32);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

      let encrypted = cipher.update(text, "utf8", "hex");
      encrypted += cipher.final("hex");

      const authTag = cipher.getAuthTag();

      return (
        iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted
      );
    } catch (error) {
      console.error("Encryption failed:", error);
      // In development, return the text as-is for simplicity
      if (process.env.NODE_ENV === "development") {
        return text;
      }
      throw error;
    }
  }

  static decrypt(encryptedText: string): string {
    try {
      // In development, if text doesn't contain ':', it's likely unencrypted
      if (
        process.env.NODE_ENV === "development" &&
        !encryptedText.includes(":")
      ) {
        return encryptedText;
      }

      const parts = encryptedText.split(":");
      if (parts.length !== 3) {
        throw new Error("Invalid encrypted data format");
      }

      const [ivHex, authTagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");
      const key = Buffer.from(ENCRYPTION_KEY, "utf8").subarray(0, 32);

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      console.error("Decryption failed:", error);
      // In development, return as-is if decryption fails
      if (process.env.NODE_ENV === "development") {
        return encryptedText;
      }
      throw error;
    }
  }
}
