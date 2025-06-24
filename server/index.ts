import express from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { logInfo } from "./utils/logger.util";
import { setupSocket } from "./socket";
import { setupAuth } from "./middlewares/auth.middleware";
import {
  errorHandler,
  setupGlobalErrorHandling,
} from "./middlewares/error.middleware";

const app = express();
// trust the first proxy when running behind one (e.g., in Docker or devcontainers)
app.set("trust proxy", 1);
setupGlobalErrorHandling();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
setupAuth(app);

// Add a relaxed CSP for local development to allow Clerk OAuth flows.
// This should be removed or hardened for production.
if (process.env.NODE_ENV === "development") {
  app.use((_req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;"
    );
    next();
  });
}

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

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    logInfo(`Server listening on port ${port}`);
  });
})();
