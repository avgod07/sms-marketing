import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { createServer } from 'http';
import WebSocket from 'ws';
import { SocketService } from './socket';

describe('SocketService', () => {
  let server: ReturnType<typeof createServer>;
  let service: SocketService;
  let port: number;

  beforeAll(async () => {
    server = createServer();
    service = new SocketService(server);
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
});
