import { useEffect } from "react";
import { connectSocket } from "@/lib/socket";
import { useAuth } from "@/hooks/use-auth";
import type { Message } from "@shared/schema";

interface Options {
  onMessage: (message: Message) => void;
  onStatus?: (message: Message) => void;
}

export function useMessageSocket({ onMessage, onStatus }: Options) {
  const { data: user } = useAuth();

  useEffect(() => {
    // Only connect if user is authenticated and has businessId
    if (!user || !user.businessId) return;

    const socket = connectSocket(user.businessId);
    const handler = (ev: MessageEvent) => {
      try {
        const { event, data } = JSON.parse(ev.data) as {
          event: string;
          data: Message;
          sourceId?: number;
        };

        // Security: Validate that incoming message belongs to current business
        if (data && typeof data === "object" && "businessId" in data) {
          if ((data as any).businessId !== user.businessId) {
            console.warn("Received message for different business, ignoring");
            return;
          }
        }

        if (event === "message:send") {
          onMessage(data);
        } else if (event === "message:status") {
          onStatus?.(data);
        }
      } catch {
        console.warn("Invalid socket message");
      }
    };
    socket.addEventListener("message", handler);
    return () => socket.removeEventListener("message", handler);
  }, [onMessage, onStatus, user?.businessId]);
}
