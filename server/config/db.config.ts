import pg from "pg";
const { Pool } = pg;

import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { logInfo, logError, logWarn } from "../utils/logger.util";
import { readFileSync } from "fs";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}

// Production-safe connection pool configuration
const poolConfig = {
  connectionString: process.env.DATABASE_URL,

  // Connection pool settings
  max: parseInt(process.env.DB_POOL_MAX || "20"), // Maximum number of connections
  min: parseInt(process.env.DB_POOL_MIN || "2"), // Minimum number of connections
  idle: parseInt(process.env.DB_POOL_IDLE || "10000"), // How long a connection can be idle (ms)
  acquire: parseInt(process.env.DB_POOL_ACQUIRE || "60000"), // How long to wait for a connection (ms)

  // Connection timeout settings
  connectionTimeoutMillis: parseInt(
    process.env.DB_CONNECTION_TIMEOUT || "10000"
  ), // 10 seconds
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "30000"), // 30 seconds

  // SSL configuration (important for production)
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
            logError(
              "Failed to load SSL certificate, falling back to basic SSL",
              { error }
            );
            return { rejectUnauthorized: false };
          }
        })()
      : false,

  // Statement timeout (prevents long-running queries)
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || "30000"), // 30 seconds
};

export const pool = new Pool(poolConfig);

// Connection pool event monitoring
pool.on("connect", (client) => {
  logInfo(
    `Database connection established. Pool size: ${pool.totalCount}/${pool.totalCount}`
  );
});

pool.on("acquire", (client) => {
  logInfo(
    `Database connection acquired. Available: ${pool.idleCount}/${pool.totalCount}`
  );
});

pool.on("error", (err, client) => {
  logError(`Database pool error: ${err.message}`, { error: err });
});

pool.on("remove", (client) => {
  logInfo(
    `Database connection removed. Pool size: ${pool.totalCount}/${pool.totalCount}`
  );
});

// Graceful shutdown handling
const gracefulShutdown = async () => {
  logInfo("Shutting down database connection pool...");
  try {
    await pool.end();
    logInfo("Database connection pool closed successfully");
    process.exit(0);
  } catch (error) {
    logError("Error closing database pool:", { error });
    process.exit(1);
  }
};

// Handle process termination signals
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Health check function for monitoring
export const checkDatabaseHealth = async (): Promise<{
  healthy: boolean;
  details?: string;
}> => {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    return { healthy: true };
  } catch (error) {
    logError("Database health check failed:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      code: (error as any)?.code,
      detail: (error as any)?.detail,
    });
    return {
      healthy: false,
      details:
        error instanceof Error ? error.message : "Unknown database error",
    };
  }
};

// Log pool configuration on startup
logInfo("Database pool configured with settings:", {
  max: poolConfig.max,
  min: poolConfig.min,
  idle: poolConfig.idle,
  acquire: poolConfig.acquire,
  connectionTimeout: poolConfig.connectionTimeoutMillis,
  idleTimeout: poolConfig.idleTimeoutMillis,
  ssl: poolConfig.ssl ? "enabled" : "disabled",
  statementTimeout: poolConfig.statement_timeout,
});

export const db = drizzle(pool, { schema });
