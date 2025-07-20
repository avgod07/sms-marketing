import type { Message } from "@shared/schema";

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let currentBusinessId: number | null = null;

export function connectSocket(businessId?: number): WebSocket {
  // If businessId is provided and different from current, force reconnection
  if (businessId && businessId !== currentBusinessId) {
    disconnectSocket();
    currentBusinessId = businessId;
  }

  if (socket) return socket;

  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const baseUrl = `${proto}://${window.location.host}/ws`;
  const url = currentBusinessId
    ? `${baseUrl}?businessId=${currentBusinessId}`
    : baseUrl;

  socket = new WebSocket(url);

  socket.addEventListener("close", () => {
    socket = null;
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectSocket(currentBusinessId || undefined);
      }, 2000);
    }
  });

  socket.addEventListener("error", (error) => {
    console.error("WebSocket connection error:", error);
    socket = null;
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.close();
    socket = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

export function emitMessageSend(message: Message) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn("WebSocket not connected when emitting message");
    return;
  }
  const payload = JSON.stringify({ event: "message:send", data: message });
  socket.send(payload);
}
