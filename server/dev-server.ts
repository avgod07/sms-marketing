import express from "express";
import { registerRoutes } from "./routes";
import { setupVite } from "./vite-dev-logic";
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

// Development server with Vite integration
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

// Apply requireAuth to /api routes, but exclude webhook endpoints
app.use("/api", (req, res, next) => {
  // Skip authentication for webhook endpoints
  if (req.path.startsWith("/api/webhooks/")) {
    return next();
  }
  // Apply authentication to all other /api routes
  return requireAuth()(req, res, next);
});

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

  // Setup Vite for development
  await setupVite(app, server);

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
      logInfo(`Development server listening on port ${port}`);
    }
  );
})();
