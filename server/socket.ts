import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import type { Message } from "@shared/schema";
import { logInfo, logWarn } from "./utils/logger.util";
import { storage } from "./db/storage";
import { parse as parseUrl } from "url";

interface SocketPayload<T = any> {
  event: string;
  data: T;
}

interface AuthenticatedWebSocket extends WebSocket {
  id?: number;
  businessId?: number;
  authenticated?: boolean;
}

export class SocketService {
  wss: WebSocketServer;
  private nextId = 1;

  constructor(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: "/ws",
      verifyClient: async (info: {
        req: IncomingMessage;
        origin: string;
        secure: boolean;
      }) => {
        try {
          // Extract business ID from query parameters
          const url = parseUrl(info.req.url || "", true);
          const businessId = url.query.businessId;

          if (!businessId || typeof businessId !== "string") {
            logWarn("WebSocket connection rejected: missing businessId");
            return false;
          }

          // Store businessId for later use
          (info.req as any).businessId = parseInt(businessId, 10);
          return true;
        } catch (err) {
          logWarn("WebSocket connection rejected: invalid parameters");
          return false;
        }
      },
    });

    this.wss.on("connection", (ws: AuthenticatedWebSocket, req) => {
      const businessId = (req as any).businessId;
      ws.id = this.nextId++;
      ws.businessId = businessId;
      ws.authenticated = true;

      logInfo("WebSocket client connected", {
        id: ws.id,
        businessId: businessId,
      });

      ws.on("message", (msg) => {
        try {
          const { event, data } = JSON.parse(msg.toString()) as SocketPayload;
          if (event === "message:send") {
            // Use the websocket's business ID for broadcasting
            this.broadcast("message:send", data, ws.businessId!, ws);
          }
        } catch (err) {
          logWarn("Invalid websocket message");
        }
      });
    });
  }

  // Updated broadcast method with business scoping
  broadcast(
    event: string,
    data: any,
    businessId?: number,
    exclude?: WebSocket
  ) {
    const payload = JSON.stringify({
      event,
      data,
      sourceId: (exclude as any)?.id,
    });
    logInfo("broadcast", {
      event,
      businessId,
      sourceId: (exclude as any)?.id,
    });

    for (const client of this.wss.clients) {
      const authClient = client as AuthenticatedWebSocket;

      // Skip excluded client
      if (client === exclude) continue;

      // Skip if client is not open
      if (client.readyState !== WebSocket.OPEN) continue;

      // Security: Only send to clients of the same business
      if (businessId && authClient.businessId !== businessId) {
        continue;
      }

      // If no businessId specified, fall back to old behavior (for backward compatibility)
      client.send(payload);
    }
  }

  // Legacy broadcast method for backward compatibility
  broadcastToAll(event: string, data: any, exclude?: WebSocket) {
    this.broadcast(event, data, undefined, exclude);
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
