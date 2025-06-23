import { describe, it, expect, vi, beforeEach } from 'vitest';

let authenticateRequest: any;
let createRequest: any;

vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({
    authenticateRequest: (...args: any[]) => authenticateRequest(...args),
  }),
}));

vi.mock('@clerk/backend/internal', () => ({
  createClerkRequest: (...args: any[]) => createRequest(...args),
}));

import { getAuth, clerkExpressRequireAuth } from './clerk-auth';
import type { Request, Response, NextFunction } from 'express';

function makeReq(path: string, headers: any = {}, method = 'GET') {
  return {
    headers: { host: 'example.com', ...headers },
    method,
    url: path,
    originalUrl: path,
  } as unknown as Request;
}

describe('clerk-auth URL handling', () => {
  beforeEach(() => {
    authenticateRequest = vi.fn().mockResolvedValue({
      isSignedIn: true,
      toAuth: () => ({ userId: '1' }),
    });
    createRequest = vi.fn();
  });

  it('builds absolute url for express requests', async () => {
    const req = makeReq('/api/test', { 'x-forwarded-proto': 'https' });
    await getAuth(req);
    expect(createRequest).toHaveBeenCalledWith(
      'https://example.com/api/test',
      expect.objectContaining({ headers: req.headers, method: 'GET' }),
    );
  });

  it('builds absolute url for websocket requests', async () => {
    const wsReq = { headers: { host: 'ws.example.com' }, url: '/ws', method: 'GET' } as any;
    await getAuth(wsReq);
    expect(createRequest).toHaveBeenCalledWith(
      'http://ws.example.com/ws',
      expect.objectContaining({ headers: wsReq.headers, method: 'GET' }),
    );
  });

  it('middleware rejects unauthenticated requests', async () => {
    authenticateRequest = vi.fn().mockResolvedValue({ isSignedIn: false, toAuth: () => ({}) });
    createRequest = vi.fn();
    const req = makeReq('/api/protected');
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn();
    const mw = clerkExpressRequireAuth();
    await mw(req, res, next as NextFunction);
    expect(createRequest).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
