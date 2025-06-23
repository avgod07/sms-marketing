import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { createClerkClient } from '@clerk/backend';
import { createClerkRequest } from '@clerk/backend/internal';

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY || '',
});

export async function getAuth(req: Request | import('http').IncomingMessage) {
  const state = await clerk.authenticateRequest(createClerkRequest(req as any));
  const auth = state.toAuth();
  const userId = (auth as any)?.userId ?? null;
  return { userId };
}

export function clerkExpressRequireAuth(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const state = await clerk.authenticateRequest(createClerkRequest(req as any));
    if (!state.isSignedIn) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    (req as any).auth = { userId: state.toAuth().userId };
    next();
  };
}
