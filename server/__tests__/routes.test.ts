import { beforeEach, describe, expect, test, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerRoutes } from '../routes';

vi.mock('../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn().mockResolvedValue([]),
    })),
  },
}));

vi.mock('../storage', () => ({
  storage: {
    forBusiness: vi.fn(() => ({
      normalizeCampaignStatuses: vi.fn(),
    })),
    getUserByUsername: vi.fn(),
    createBusiness: vi.fn(),
  },
  findTwilioCredentialByAccountSid: vi.fn(),
  findBusinessIdByPhoneNumber: vi.fn(),
}));

vi.mock('../services/twilio.js', () => ({
  TwilioService: vi.fn().mockImplementation(() => ({
    sendSms: vi.fn(),
  })),
}));

vi.mock('../services/campaign.js', () => ({
  executeCampaign: vi.fn(),
}));

vi.mock('../services/a2p.js', () => ({
  registerBusinessForA2P: vi.fn(),
}));

describe('routes', () => {
  let app: express.Express;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    await registerRoutes(app);
  });

  test('GET /api/me returns null when not authenticated', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  test('POST /api/signup with invalid data returns 400', async () => {
    const res = await request(app).post('/api/signup').send({});
    expect(res.status).toBe(400);
  });
});
