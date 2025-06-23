import request from 'supertest';
import express from 'express';
import { vi, describe, it, expect, afterEach, beforeAll, beforeEach } from 'vitest';
var mockForBusiness: any;
var mockStorage: any;
var registerRoutes: any;
var mockSendSMS: any;
var mockFindBizId: any;
var mockFindByServiceSid: any;
var mockFindByNumber: any;
var mockBroadcast: any;

vi.mock('../config/db.config', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockResolvedValue([]),
    }),
  },
}));

vi.mock('../db/storage', () => {
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
    findBusinessIdByPhoneNumber: (mockFindBizId = vi.fn()),
    findBusinessIdByNumber: (mockFindByNumber = vi.fn()),
    findBusinessIdByServiceSid: (mockFindByServiceSid = vi.fn()),
  };
});

vi.mock('../services/twilio.js', () => {
  mockSendSMS = vi.fn();
  return { TwilioService: { sendSMS: mockSendSMS } };
});

vi.mock('../socket', () => ({
  socketService: { broadcast: (mockBroadcast = vi.fn()) },
}));

vi.mock('../utils/encryption.util', () => ({
  decrypt: vi.fn(() => 'token'),
  encrypt: vi.fn(),
}));

vi.mock('twilio', () => {
  const mockTwilio = vi.fn(() => ({}));
  return {
    default: Object.assign(mockTwilio, {
      validateRequest: vi.fn(() => true),
    }),
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
  registerRoutes = (await import('./index')).registerRoutes;
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
    registerRoutes = (await import('./index')).registerRoutes;
  }
  await registerRoutes(app);
  return app;
}

describe('routes', () => {
  it('signup creates account', async () => {
    mockStorage.getUserByUsername.mockResolvedValue(undefined);
    mockStorage.createBusiness.mockResolvedValue({ id: 1 });
    mockForBusiness.createUser.mockResolvedValue({ id: 1, username: 'a@b.com' });

    mockFindBizId.mockResolvedValue(1);
    mockFindByNumber.mockResolvedValue(1);
    const app = await setupApp();

    const res = await request(app)
      .post('/api/signup')
      .send({
        username: 'a@b.com',
        password: 'Password1!',
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'Signed up' });
  });

  it('signup assigns a unique business for each new user', async () => {
    const bizA = { createUser: vi.fn().mockResolvedValue({ id: 1 }) };
    const bizB = { createUser: vi.fn().mockResolvedValue({ id: 2 }) };
    mockStorage.getUserByUsername
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    mockStorage.createBusiness
      .mockResolvedValueOnce({ id: 11 })
      .mockResolvedValueOnce({ id: 22 });
    mockStorage.forBusiness
      .mockImplementationOnce(() => bizA)
      .mockImplementationOnce(() => bizB);

    const app = await setupApp();

    await request(app)
      .post('/api/signup')
      .send({ username: 'u1@example.com', password: 'Password1!' });

    await request(app)
      .post('/api/signup')
      .send({ username: 'u2@example.com', password: 'Password1!' });

    expect(mockStorage.createBusiness).toHaveBeenCalledTimes(2);
    expect(mockStorage.forBusiness).toHaveBeenNthCalledWith(1, 11);
    expect(mockStorage.forBusiness).toHaveBeenNthCalledWith(2, 22);
    expect(bizA.createUser).toHaveBeenCalledWith({
      username: 'u1@example.com',
      passwordHash: 'hashed',
    });
    expect(bizB.createUser).toHaveBeenCalledWith({
      username: 'u2@example.com',
      passwordHash: 'hashed',
    });
  });

  it('signup rejects existing user', async () => {
    mockStorage.getUserByUsername.mockResolvedValue({ id: 1 });

    const app = await setupApp();
    const res = await request(app)
      .post('/api/signup')
      .send({
        username: 'a@b.com',
        password: 'Password1!',
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

  it('public contact signup creates contact', async () => {
    mockForBusiness.createContact = vi.fn().mockResolvedValue({ id: 5 });
    const app = await setupApp();

    const res = await request(app)
      .post('/public/contacts')
      .send({
        businessId: 2,
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '+15551234567',
        email: 'j@example.com',
      });

    expect(res.status).toBe(201);
    expect(mockStorage.forBusiness).toHaveBeenCalledWith(2);
    expect(mockForBusiness.createContact).toHaveBeenCalled();
  });

  it('scopes routes using the businessId from the session', async () => {
    mockForBusiness.getContacts = vi.fn().mockResolvedValue([]);
    const app = await setupApp({ businessId: 42 });

    await request(app).get('/api/contacts');

    expect(mockStorage.forBusiness).toHaveBeenCalledWith(42);
    expect(mockForBusiness.getContacts).toHaveBeenCalled();
  });

  it('searches contacts with multiple tokens', async () => {
    const contacts = [
      { id: 1, firstName: 'David', lastName: 'Wilson' },
    ];
    mockForBusiness.searchContacts = vi.fn().mockResolvedValue(contacts);
    const app = await setupApp({ businessId: 1 });

    const res = await request(app)
      .get('/api/contacts')
      .query({ search: 'David Wi' });

    expect(mockForBusiness.searchContacts).toHaveBeenCalledWith('David Wi');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(contacts);
  });

  it('searches contacts by first and last name', async () => {
    const contacts = [
      { id: 2, firstName: 'Sarah', lastName: 'Johnson' },
    ];
    mockForBusiness.searchContacts = vi.fn().mockResolvedValue(contacts);
    const app = await setupApp({ businessId: 1 });

    const res = await request(app)
      .get('/api/contacts')
      .query({ search: 'Sarah J' });

    expect(mockForBusiness.searchContacts).toHaveBeenCalledWith('Sarah J');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(contacts);
  });

  it('lists conversation summaries', async () => {
    const convs = [{ id: 1 }];
    mockForBusiness.getConversationSummaries = vi.fn().mockResolvedValue(convs);
    mockForBusiness.getPhoneNumbers = vi
      .fn()
      .mockResolvedValue([{ phoneNumber: '+15550001111', serviceSid: 'MG123', isDefault: true }]);
    const app = await setupApp({ businessId: 1 });

    const res = await request(app).get('/api/conversations');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(convs);
    expect(mockForBusiness.getConversationSummaries).toHaveBeenCalled();
  });

  it('fetches messages for contact', async () => {
    const msgs = [{ id: 1 }];
    mockForBusiness.getMessagesByContact = vi.fn().mockResolvedValue(msgs);
    mockForBusiness.getPhoneNumbers = vi
      .fn()
      .mockResolvedValue([{ phoneNumber: '+15550001111', serviceSid: 'MG123', isDefault: true }]);
    const app = await setupApp({ businessId: 1 });

    const res = await request(app).get('/api/conversations/3/messages');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(msgs);
    expect(mockForBusiness.getMessagesByContact).toHaveBeenCalledWith(3);
  });

  it('sends sms and saves message', async () => {
    mockForBusiness.getPhoneNumbers = vi
      .fn()
      .mockResolvedValue([{ phoneNumber: '+15550001111', serviceSid: 'MG123', isDefault: true }]);
    mockForBusiness.getContact = vi.fn().mockResolvedValue({ id: 4, active: true });
    mockSendSMS.mockResolvedValue({ success: true, messageSid: 'SM789' });
    mockForBusiness.createMessage = vi
      .fn()
      .mockResolvedValue({ id: 7, content: 'hi' });

    const app = await setupApp({ businessId: 1 });

    const res = await request(app)
      .post('/api/messages')
      .send({
        phoneNumber: '+15551234567',
        content: 'hello',
        contactId: 4,
      });

    expect(res.status).toBe(201);
    expect(mockSendSMS).toHaveBeenCalledWith({
      to: '+15551234567',
      message: 'hello',
      from: '+15550001111',
      messagingServiceSid: 'MG123',
      campaignId: undefined,
      contactId: 4,
    });
    expect(mockForBusiness.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: '+15551234567',
        content: 'hello',
        status: 'sent',
        messageSid: 'SM789',
      }),
    );
  });

  it('blocks sms when business lacks a phone number', async () => {
    mockForBusiness.getPhoneNumbers = vi.fn().mockResolvedValue([]);
    const app = await setupApp({ businessId: 1 });

    const res = await request(app)
      .post('/api/messages')
      .send({ phoneNumber: '+15551234567', content: 'hi', contactId: 4 });

    expect(res.status).toBe(403);
  });

  it('allows sms after phone number added', async () => {
    mockForBusiness.getPhoneNumbers = vi
      .fn()
      .mockResolvedValue([{ phoneNumber: '+15550001111', serviceSid: 'MG123', isDefault: true }]);
    mockForBusiness.getContact = vi.fn().mockResolvedValue({ id: 4, active: true });
    mockSendSMS.mockResolvedValue({ success: true, messageSid: 'SM001' });
    mockForBusiness.createMessage = vi.fn().mockResolvedValue({ id: 8, content: 'hi' });

    const app = await setupApp({ businessId: 1 });

    const res = await request(app)
      .post('/api/messages')
      .send({ phoneNumber: '+15551234567', content: 'hello', contactId: 4 });

    expect(res.status).toBe(201);
    expect(mockSendSMS).toHaveBeenCalled();
  });

  it('handles inbound webhook and broadcasts message', async () => {
    mockForBusiness.getContactByPhoneNumber = vi.fn().mockResolvedValue(undefined);
    mockForBusiness.createContact = vi.fn().mockResolvedValue({ id: 2 });
    const saved = {
      id: 5,
      phoneNumber: '+15551234567',
      contactId: 2,
      content: 'hello',
      status: 'received',
    };
    mockForBusiness.createMessage = vi.fn().mockResolvedValue(saved);
    mockFindByNumber.mockResolvedValue(1);

    const app = await setupApp();

    const res = await request(app)
      .post('/webhooks/twilio-inbound')
      .set('x-twilio-signature', 'sig')
      .send({
        AccountSid: 'AC123',
        From: '+15551234567',
        To: '+15550001111',
        Body: 'hello',
      });

    expect(res.status).toBe(200);
    expect(mockForBusiness.createContact).toHaveBeenCalled();
    expect(mockForBusiness.createMessage).toHaveBeenCalledWith({
      phoneNumber: '+15551234567',
      contactId: 2,
      content: 'hello',
      status: 'received',
    });
    expect(mockBroadcast).toHaveBeenCalledWith('message:send', saved);
  });

  describe('multi-tenant isolation', () => {
    let biz1: any;
    let biz2: any;

    beforeEach(() => {
      biz1 = {
        getContacts: vi.fn().mockResolvedValue([{ id: 1, firstName: 'A' }]),
        getCampaigns: vi.fn().mockResolvedValue([{ id: 1, name: 'C1' }]),
        searchCoupons: vi.fn().mockResolvedValue([{ id: 1, code: 'X1' }]),
        getDashboardStats: vi.fn().mockResolvedValue({
          totalContacts: 1,
          messagesSent: 2,
          activeCampaigns: 1,
          deliveryRate: 0.5,
          contactsChange: null,
          messagesChange: null,
          campaignsChange: null,
          deliveryRateChange: null,
        }),
      };
      biz2 = {
        getContacts: vi.fn().mockResolvedValue([{ id: 2, firstName: 'B' }]),
        getCampaigns: vi.fn().mockResolvedValue([{ id: 2, name: 'C2' }]),
        searchCoupons: vi.fn().mockResolvedValue([{ id: 2, code: 'X2' }]),
        getDashboardStats: vi.fn().mockResolvedValue({
          totalContacts: 5,
          messagesSent: 6,
          activeCampaigns: 2,
          deliveryRate: 0.9,
          contactsChange: null,
          messagesChange: null,
          campaignsChange: null,
          deliveryRateChange: null,
        }),
      };
      mockStorage.forBusiness.mockImplementation((id: number) =>
        id === 1 ? biz1 : biz2,
      );
    });

    it('returns only contacts for the authenticated business', async () => {
      const app1 = await setupApp({ businessId: 1 });
      const app2 = await setupApp({ businessId: 2 });

      const res1 = await request(app1).get('/api/contacts');
      const res2 = await request(app2).get('/api/contacts');

      expect(res1.body).toEqual([{ id: 1, firstName: 'A' }]);
      expect(res2.body).toEqual([{ id: 2, firstName: 'B' }]);
    });

    it('returns only campaigns for the authenticated business', async () => {
      const app1 = await setupApp({ businessId: 1 });
      const app2 = await setupApp({ businessId: 2 });

      const res1 = await request(app1).get('/api/campaigns');
      const res2 = await request(app2).get('/api/campaigns');

      expect(res1.body).toEqual([{ id: 1, name: 'C1' }]);
      expect(res2.body).toEqual([{ id: 2, name: 'C2' }]);
    });

    it('returns only coupons for the authenticated business', async () => {
      const app1 = await setupApp({ businessId: 1 });
      const app2 = await setupApp({ businessId: 2 });

      const res1 = await request(app1).get('/api/coupons');
      const res2 = await request(app2).get('/api/coupons');

      expect(res1.body).toEqual([{ id: 1, code: 'X1' }]);
      expect(res2.body).toEqual([{ id: 2, code: 'X2' }]);
    });

    it('returns stats for the authenticated business only', async () => {
      const app1 = await setupApp({ businessId: 1 });
      const app2 = await setupApp({ businessId: 2 });

      const res1 = await request(app1).get('/api/dashboard/stats');
      const res2 = await request(app2).get('/api/dashboard/stats');

      expect(res1.body.totalContacts).toBe(1);
      expect(res2.body.totalContacts).toBe(5);
    });
  });
});
