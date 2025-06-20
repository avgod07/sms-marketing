import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest';
import { createServer } from 'http';
import WebSocket from 'ws';
import express from 'express';
import request from 'supertest';
import { SocketService, setupSocket, socketService } from './socket';

var registerRoutes: any;
var mockForBusiness: any;
var mockStorage: any;
var mockFindCred: any;
var mockFindBizId: any;

vi.mock('./db/storage', () => {
  mockForBusiness = {
    getContactByPhoneNumber: vi.fn(),
    createContact: vi.fn(),
    createMessage: vi.fn(),
    updateMessageStatusBySid: vi.fn(),
  };
  mockStorage = {
    forBusiness: vi.fn(() => mockForBusiness),
  };
  return {
    storage: mockStorage,
    findTwilioCredentialByAccountSid: (mockFindCred = vi.fn()),
    findBusinessIdByPhoneNumber: (mockFindBizId = vi.fn()),
  };
});

vi.mock('./utils/encryption.util', () => ({
  decrypt: vi.fn(() => 'token'),
  encrypt: vi.fn(),
}));

vi.mock('twilio', () => ({
  default: { validateRequest: vi.fn(() => true) },
  validateRequest: vi.fn(() => true),
}));

describe('SocketService', () => {
  let server: ReturnType<typeof createServer>;
  let service: SocketService;
  let port: number;
  let app: express.Express;

  beforeAll(async () => {
    registerRoutes = (await import('./routes')).registerRoutes;
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    service = setupSocket(server);
    await new Promise<void>(resolve => server.listen(0, resolve));
    port = (server.address() as any).port;
  });

  afterAll(async () => {
    service.wss.close();
    server.close();
  });

  it('does not echo messages back to the sender', async () => {
    const ws1 = new WebSocket(`ws://localhost:${port}/ws`);
    const ws2 = new WebSocket(`ws://localhost:${port}/ws`);

    await Promise.all([
      new Promise(resolve => ws1.once('open', resolve)),
      new Promise(resolve => ws2.once('open', resolve)),
    ]);

    const msgs1: string[] = [];
    const msgs2: string[] = [];
    ws1.on('message', data => msgs1.push(data.toString()));
    ws2.on('message', data => msgs2.push(data.toString()));

    ws1.send(JSON.stringify({ event: 'message:send', data: { id: 1, content: 'hi' } }));

    await new Promise(r => setTimeout(r, 20));

    expect(msgs1.length).toBe(0);
    expect(msgs2.length).toBe(1);
  });

  it('broadcasts inbound webhook messages', async () => {
    mockFindCred.mockResolvedValue({ businessId: 1, authTokenEncrypted: 'enc' });
    mockForBusiness.getContactByPhoneNumber.mockResolvedValue(undefined);
    mockForBusiness.createContact.mockResolvedValue({ id: 2 });
    const saved = {
      id: 5,
      phoneNumber: '+15551234567',
      contactId: 2,
      content: 'hello',
      status: 'received',
    };
    mockForBusiness.createMessage.mockResolvedValue(saved);

    const ws1 = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise(resolve => ws1.once('open', resolve));

    const msgs: string[] = [];
    ws1.on('message', data => msgs.push(data.toString()));

    const res = await request(`http://localhost:${port}`)
      .post('/webhooks/twilio-inbound')
      .set('x-twilio-signature', 'sig')
      .send({
        AccountSid: 'AC123',
        From: '+15551234567',
        To: '+15559876543',
        Body: 'hello',
      });
    expect(res.status).toBe(200);

    await new Promise(r => setTimeout(r, 20));

    expect(msgs.length).toBe(1);
    const payload = JSON.parse(msgs[0]);
    expect(payload.event).toBe('message:send');
    expect(payload.data).toEqual(saved);
  });

  it('broadcasts status callback updates', async () => {
    mockFindCred.mockResolvedValue({ businessId: 1, authTokenEncrypted: 'enc' });
    const updated = { id: 5, status: 'delivered' };
    mockForBusiness.updateMessageStatusBySid.mockResolvedValue(updated);

    const ws1 = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise(resolve => ws1.once('open', resolve));

    const msgs: string[] = [];
    ws1.on('message', data => msgs.push(data.toString()));

    const res = await request(`http://localhost:${port}`)
      .post('/api/webhooks/twilio/status-callback')
      .set('x-twilio-signature', 'sig')
      .send({
        AccountSid: 'AC123',
        MessageSid: 'SM1',
        MessageStatus: 'delivered',
        To: '+15559876543',
      });
    expect(res.status).toBe(200);

    await new Promise(r => setTimeout(r, 20));

    expect(msgs.length).toBe(1);
    const payload = JSON.parse(msgs[0]);
    expect(payload.event).toBe('message:status');
    expect(payload.data).toEqual(updated);
  });
});
