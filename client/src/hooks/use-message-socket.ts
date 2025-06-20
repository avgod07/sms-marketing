import { useEffect } from 'react';
import { connectSocket } from '@/lib/socket';
import type { Message } from '@shared/schema';

interface Options {
  onMessage: (message: Message) => void;
}

export function useMessageSocket({ onMessage }: Options) {
  useEffect(() => {
    const socket = connectSocket();
    const handler = (ev: MessageEvent) => {
      try {
        const { event, data } = JSON.parse(ev.data) as {
          event: string;
          data: Message;
          sourceId?: number;
        };
        if (event === 'message:send') {
          onMessage(data);
        }
      } catch {
        console.warn('Invalid socket message');
      }
    };
    socket.addEventListener('message', handler);
    return () => socket.removeEventListener('message', handler);
  }, [onMessage]);
}
