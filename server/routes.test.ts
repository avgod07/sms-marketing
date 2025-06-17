import request from 'supertest';
import express from 'express';
import { vi, describe, it, expect, afterEach, beforeAll } from 'vitest';
var mockForBusiness: any;
var mockStorage: any;
var registerRoutes: any;

vi.mock('./db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockResolvedValue([]),
    }),
  },
}));

vi.mock('./storage', () => {
  mockForBusiness = {
    createUser: vi.fn(),
  };
  mockStorage = {
    getUserByUsername: vi.fn(),
    createBusiness: vi.fn(),
    forBusiness: vi.fn(() => mockForBusiness),
  };
  return {
    storage: mockStorage,
    findTwilioCredentialByAccountSid: vi.fn(),
    findBusinessIdByPhoneNumber: vi.fn(),
  };
});

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn(() => Promise.resolve('hashed')) },
  hash: vi.fn(() => Promise.resolve('hashed')),
}));

vi.mock('passport', () => ({
  default: {
    authenticate: () => (_req: any, _res: any, next: any) => next(),
    initialize: () => (_req: any, _res: any, next: any) => next(),
    session: () => (_req: any, _res: any, next: any) => next(),
    use: vi.fn(),
    serializeUser: vi.fn(),
    deserializeUser: vi.fn(),
  },
  authenticate: () => (_req: any, _res: any, next: any) => next(),
  initialize: () => (_req: any, _res: any, next: any) => next(),
  session: () => (_req: any, _res: any, next: any) => next(),
  use: vi.fn(),
  serializeUser: vi.fn(),
  deserializeUser: vi.fn(),
}));

beforeAll(async () => {
  registerRoutes = (await import('./routes')).registerRoutes;
});

afterEach(() => {
  vi.clearAllMocks();
  registerRoutes = undefined;
});

async function setupApp(user?: any) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.login = (_u: any, cb: any) => cb?.();
    if (user) {
      req.user = user;
      req.isAuthenticated = () => true;
    }
    next();
  });
  if (!registerRoutes) {
    registerRoutes = (await import('./routes')).registerRoutes;
  }
  await registerRoutes(app);
  return app;
}

describe('routes', () => {
  it('signup creates account', async () => {
    mockStorage.getUserByUsername.mockResolvedValue(undefined);
    mockStorage.createBusiness.mockResolvedValue({ id: 1 });
    mockForBusiness.createUser.mockResolvedValue({ id: 1, username: 'a@b.com' });

    const app = await setupApp();

    const res = await request(app)
      .post('/api/signup')
      .send({
        username: 'a@b.com',
        password: 'Password1!',
        businessName: 'Biz',
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'Signed up' });
  });

  it('signup rejects existing user', async () => {
    mockStorage.getUserByUsername.mockResolvedValue({ id: 1 });

    const app = await setupApp();
    const res = await request(app)
      .post('/api/signup')
      .send({
        username: 'a@b.com',
        password: 'Password1!',
        businessName: 'Biz',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('User already exists');
  });

  it('me returns current user', async () => {
    const app = await setupApp({ id: 2, name: 'User' });
    const res = await request(app).get('/api/me');
    expect(res.body).toEqual({ id: 2, name: 'User' });
  });

  it('me returns null when not logged in', async () => {
    const app = await setupApp();
    const res = await request(app).get('/api/me');
    expect(res.body).toBeNull();
  });

  it('deletes campaign with existing messages', async () => {
    mockForBusiness.deleteCampaign = vi.fn().mockResolvedValue(undefined);

    const app = await setupApp({ businessId: 1 });
    const res = await request(app).delete('/api/campaigns/3');

    expect(mockForBusiness.deleteCampaign).toHaveBeenCalledWith(3);
    expect(res.status).toBe(204);
  });
});
