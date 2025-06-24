import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { createClerkClient } from '@clerk/backend';
import { createClerkRequest } from '@clerk/backend/internal';
import { logDebug, logInfo } from './logger.util';

function absoluteUrl(req: Request | import('http').IncomingMessage) {
  const protoHeader = Array.isArray(req.headers['x-forwarded-proto'])
    ? req.headers['x-forwarded-proto'][0]
    : req.headers['x-forwarded-proto'];
  const protocol = protoHeader || 'http';

  const hostHeader =
    (Array.isArray(req.headers['x-forwarded-host'])
      ? req.headers['x-forwarded-host'][0]
      : req.headers['x-forwarded-host']) ||
    (Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host);

  const path = (req as any).originalUrl || req.url || '';
  return `${protocol}://${hostHeader}${path}`;
}

const clerkApiUrl =
  process.env.CLERK_API_URL ||
  'https://noted-weasel-27.clerk.accounts.dev';

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY || '',
  apiUrl: clerkApiUrl,
  publishableKey:
    process.env.CLERK_PUBLISHABLE_KEY ||
    process.env.VITE_CLERK_PUBLISHABLE_KEY ||
    '',
});

logInfo('Clerk configured', {
  apiUrl: clerkApiUrl,
  secretKeySet: !!process.env.CLERK_SECRET_KEY,
  publishableKeySet:
    !!(
      process.env.CLERK_PUBLISHABLE_KEY ||
      process.env.VITE_CLERK_PUBLISHABLE_KEY
    ),
});

export async function getAuth(req: Request | import('http').IncomingMessage) {
  logDebug('absoluteUrl', { url: absoluteUrl(req) });
  const clerkReq = createClerkRequest(absoluteUrl(req), {
    method: (req as any).method || 'GET',
    headers: req.headers as any,
  });
  const state = await clerk.authenticateRequest(clerkReq);
  logDebug('clerk auth state', { state });
  const auth = state.toAuth();
  const userId = (auth as any)?.userId ?? null;
  logDebug('getAuth result', { userId });
  return { userId };
}

export function clerkExpressRequireAuth(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    logDebug('absoluteUrl', { url: absoluteUrl(req) });
    const clerkReq = createClerkRequest(absoluteUrl(req), {
      method: req.method,
      headers: req.headers as any,
    });
    const state = await clerk.authenticateRequest(clerkReq);
    logDebug('clerk auth state', { state });
    if (!state.isSignedIn) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    (req as any).auth = { userId: state.toAuth().userId };
    logDebug('middleware auth success', { userId: state.toAuth().userId });
    next();
  };
}
