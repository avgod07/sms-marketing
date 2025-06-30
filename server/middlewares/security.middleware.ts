import { Request, Response, NextFunction } from "express";

/**
 * Security Headers Middleware
 *
 * Implements essential security headers for MVP baseline security.
 * Designed to be easily extensible for future security hardening.
 *
 * Headers implemented:
 * - Strict-Transport-Security: Enforces HTTPS
 * - X-Frame-Options: Prevents clickjacking
 * - X-Content-Type-Options: Prevents MIME type sniffing
 * - Referrer-Policy: Controls referrer information
 */
export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Skip certain headers for webhook endpoints to prevent breaking external services
  const isWebhookEndpoint =
    req.path.startsWith("/webhooks/") || req.path.startsWith("/api/webhooks/");

  // Strict-Transport-Security: Enforce HTTPS for all connections
  // 31536000 seconds = 1 year
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );

  // X-Frame-Options: Prevent clickjacking by blocking iframe embedding
  // DENY is the most secure option - blocks all embedding
  res.setHeader("X-Frame-Options", "DENY");

  // X-Content-Type-Options: Prevent browsers from guessing MIME types
  // nosniff forces browsers to respect the declared Content-Type
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Referrer-Policy: Control how much referrer information is exposed
  // strict-origin-when-cross-origin: Send full referrer to same origin,
  // only send origin to cross-origin requests, send nothing to less secure destinations
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Future extensibility: Easy to add CSP, Permissions-Policy, etc.
  // Example for future implementation:
  // if (!isWebhookEndpoint) {
  //   res.setHeader('Content-Security-Policy', "default-src 'self'");
  // }

  next();
}

/**
 * Configuration object for security headers
 * Makes it easy to modify or extend security settings
 */
export const securityConfig = {
  // HSTS settings
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: false, // Set to true when ready for preload list
  },

  // Frame options
  frameOptions: "DENY", // Options: DENY, SAMEORIGIN, ALLOW-FROM uri

  // Content type options
  contentTypeOptions: "nosniff",

  // Referrer policy
  referrerPolicy: "strict-origin-when-cross-origin",

  // Webhook endpoints that should skip certain headers
  webhookPaths: ["/webhooks/", "/api/webhooks/"],

  // Future CSP configuration
  csp: {
    enabled: false, // Set to true when ready to implement CSP
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'"], // Will need adjustment for production
      "style-src": ["'self'", "'unsafe-inline'"], // Will need adjustment for production
      "img-src": ["'self'", "data:", "https:"],
      "connect-src": ["'self'", "https:"],
      "font-src": ["'self'"],
      "object-src": ["'none'"],
      "media-src": ["'self'"],
      "frame-src": ["'none'"],
    },
  },
};
