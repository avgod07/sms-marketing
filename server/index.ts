import express from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { logInfo } from "./utils/logger.util";
import { setupSocket } from "./socket";
import { setupAuth } from "./middlewares/auth.middleware";
import {
  errorHandler,
  setupGlobalErrorHandling,
} from "./middlewares/error.middleware";
import { securityHeaders } from "./middlewares/security.middleware";
import { requireAuth } from "@clerk/express";
import { checkDatabaseHealth } from "./config/db.config";

// Production server - no Vite dependencies
const app = express();

setupGlobalErrorHandling();

// Apply security headers to all responses (before any routes)
app.use(securityHeaders);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add health check route after security headers
app.get("/api/health", async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    res.json({
      status: "ok",
      database: dbHealth.healthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.json({
      status: "ok",
      database: "unknown",
      timestamp: new Date().toISOString(),
    });
  }
});

setupAuth(app);

// Only apply requireAuth to /api routes
app.use("/api", requireAuth());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      logInfo("request", {
        method: req.method,
        path,
        status: res.statusCode,
        duration,
        response: capturedJsonResponse,
        userId: (req as any).user?.id,
      });
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);
  setupSocket(server);

  app.use(errorHandler);

  // Serve static files from the built client in production
  serveStatic(app);

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      logInfo(`Production server listening on port ${port}`);

      // Start SMS command cleanup service after server is ready
      (async () => {
        const { SMSCommandTimeoutService } = await import(
          "./services/sms-command-timeout.js"
        );
        SMSCommandTimeoutService.startPeriodicCleanup(30 * 1000); // Every 30 seconds
        logInfo("SMS command cleanup service started");
      })();
    }
  );
})();
