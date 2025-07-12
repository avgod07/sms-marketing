import { defineConfig } from "drizzle-kit";
import { readFileSync } from "fs";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === "production"
        ? (() => {
            try {
              const certPath = "/app/certs/us-east-1-bundle.pem";
              const certContent = readFileSync(certPath).toString();
              return {
                rejectUnauthorized: true,
                ca: certContent,
              };
            } catch (error) {
              console.error("Failed to load SSL certificate:", error);
              return { rejectUnauthorized: false };
            }
          })()
        : false,
  },
});
