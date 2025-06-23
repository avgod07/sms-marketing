import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { Message } from '@shared/schema';
import { logInfo, logWarn } from './utils/logger.util';

import { getAuth } from './utils/clerk-auth';

interface SocketPayload<T = any> {
  event: string;
  data: T;
}

export class SocketService {
  wss: WebSocketServer;
  private nextId = 1;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', async (ws, req) => {
      const { userId } = await getAuth(req as any);
      if (!userId) {
        ws.close(4401, 'Unauthorized');
        return;
      }
      (ws as any).id = this.nextId++;
      logInfo('WebSocket client connected', { id: (ws as any).id });
      ws.on('message', msg => {
        try {
          const { event, data } = JSON.parse(msg.toString()) as SocketPayload;
          if (event === 'message:send') {
            this.broadcast('message:send', data, ws);
          }
        } catch (err) {
          logWarn('Invalid websocket message');
        }
      });
    });
  }

  broadcast(event: string, data: any, exclude?: WebSocket) {
    const payload = JSON.stringify({ event, data, sourceId: (exclude as any)?.id });
    logInfo('broadcast', { event, sourceId: (exclude as any)?.id });
    for (const client of this.wss.clients) {
      if (client === exclude) continue;
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }
}

export let socketService: SocketService | null = null;

export function setupSocket(server: Server) {
  socketService = new SocketService(server);
  return socketService;
}

export function getSocketService() {
  return socketService;
}
