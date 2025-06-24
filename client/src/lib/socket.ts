import type { Message } from '@shared/schema';

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function connectSocket(token = ''): WebSocket {
  if (socket) return socket;
  const port = import.meta.env.VITE_BACKEND_PORT;
  socket = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
  socket.addEventListener('close', () => {
    socket = null;
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectSocket();
      }, 2000);
    }
  });
  return socket;
}

export function emitMessageSend(message: Message) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn('WebSocket not connected when emitting message');
    return;
  }
  const payload = JSON.stringify({ event: 'message:send', data: message });
  socket.send(payload);
}
