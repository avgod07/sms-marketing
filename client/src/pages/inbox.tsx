import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import ChatBubble from "@/components/shared/ChatBubble";
import { formatPhoneNumber, timeAgo } from "@/lib/utils";
import { Search, MessageSquareText } from "lucide-react";
import { emitMessageSend } from "@/lib/socket";
import { useMessageSocket } from "@/hooks/use-message-socket";
import { useDebounce } from "@/hooks/use-debounce";
import type { Message as ApiMessage } from "@shared/schema";

interface Message {
  id: number;
  text: string;
  timestamp: Date;
  incoming: boolean;
  status?: string;
}

interface Conversation {
  id: number;
  contactName?: string;
  phone: string;
  messages: Message[];
  hasUnread?: boolean;
}


export default function Inbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const trimmedSearch = debouncedSearch.trim().toLowerCase();
  const selected =
    selectedId !== null
      ? conversations.find((c) => c.id === selectedId) || null
      : null;
  const filteredConversations = conversations.filter((c) => {
    if (!trimmedSearch) return true;
    const target = `${c.contactName ?? ""} ${c.phone}`.toLowerCase();
    return target.includes(trimmedSearch);
  });

  useEffect(() => {
    async function loadConversations() {
      try {
        const res = await fetch("/api/conversations");
        if (res.ok) {
          const data = await res.json();
          const convs: Conversation[] = data.map((c: any) => ({
            id: c.id,
            contactName:
              c.firstName || c.lastName
                ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()
                : undefined,
            phone: c.phoneNumber,
            messages: c.lastMessage
              ? [
                  {
                    id: c.lastMessage.id,
                    text: c.lastMessage.content,
                    timestamp: new Date(c.lastMessage.createdAt),
                    incoming: c.lastMessage.status === "received",
                    status: c.lastMessage.status,
                  },
                ]
              : [],
            hasUnread: false,
          }));
          setConversations(convs);
          if (convs.length && selectedId === null) {
            setSelectedId(convs[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedId === null) return;
    async function loadMessages() {
      try {
        const res = await fetch(`/api/conversations/${selectedId}/messages`);
        if (res.ok) {
          const data: ApiMessage[] = await res.json();
          setConversations((prev) =>
            prev.map((c) =>
              c.id === selectedId
                ? {
                    ...c,
                    messages: data.map((m) => ({
                      id: m.id,
                      text: m.content,
                      timestamp: new Date(m.createdAt as any),
                      incoming: m.status === "received",
                      status: m.status,
                    })),
                  }
                : c,
            ),
          );
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadMessages();
  }, [selectedId]);

  useMessageSocket({
    onMessage: (data) => {
      const contactId = (data as any).contactId as number | undefined;
      const phone = (data as any).phoneNumber as string | undefined;
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === contactId || c.phone === phone);
        if (idx === -1) return prev;
        const conv = prev[idx];
        const updated: Conversation = {
          ...conv,
          messages: [
            ...conv.messages,
            {
              id: data.id,
              text: data.content,
              timestamp: new Date((data as any).createdAt ?? Date.now()),
              incoming: data.status === 'received',
              status: data.status,
            },
          ],
          hasUnread: conv.id === selectedId ? false : true,
        };
        const copy = prev.slice();
        copy[idx] = updated;
        return copy;
      });
    },
    onStatus: data => {
      setConversations(prev =>
        prev.map(conv => {
          const msgIdx = conv.messages.findIndex(m => m.id === data.id);
          if (msgIdx === -1) return conv;
          const messages = conv.messages.slice();
          messages[msgIdx] = { ...messages[msgIdx], status: data.status };
          return { ...conv, messages };
        }),
      );
    },
  });

  const handleSend = async () => {
    if (!reply.trim() || !selected) return;
    const tempId = Date.now();
    const localMessage = {
      id: tempId,
      text: reply,
      timestamp: new Date(),
      incoming: false,
      status: 'sent',
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedId
          ? { ...c, messages: [...c.messages, localMessage] }
          : c,
      ),
    );
    setReply("");

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: selected.id,
          phoneNumber: selected.phone,
          content: reply,
          status: "sent",
        }),
      });
      if (res.ok) {
        const saved: ApiMessage = await res.json();
        setConversations((prev) => {
          const idxConv = prev.findIndex((c) => c.id === selectedId);
          if (idxConv === -1) return prev;
          const conv = prev[idxConv];
          const msgIdx = conv.messages.findIndex((m) => m.id === tempId);
          if (msgIdx === -1) return prev;
          const updatedConv: Conversation = {
            ...conv,
            messages: conv.messages.map((m, i) =>
              i === msgIdx
                ? {
                    id: saved.id,
                    text: saved.content,
                    timestamp: new Date((saved as any).createdAt ?? Date.now()),
                    incoming: false,
                    status: saved.status,
                  }
                : m,
            ),
          };
          const copy = prev.slice();
          copy[idxConv] = updatedConv;
          return copy;
        });
        emitMessageSend(saved);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fade-in h-full p-8">
      <Card className="mx-auto h-full w-full max-w-[1200px] p-6">
        <div className="flex h-full w-full">
      {/* Conversations Sidebar */}
      <aside className="hidden md:flex w-[300px] flex-col border-r border-gray-200">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center space-x-2">
            <MessageSquareText className="w-5 h-5" />
            <span>Inbox</span>
          </h2>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                {conversations.length === 0 ? (
                  <MessageSquareText className="w-6 h-6 text-gray-400" />
                ) : (
                  <Search className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {conversations.length === 0
                  ? "No conversations yet"
                  : "No conversations match your search"}
              </h3>
              <p className="text-gray-500">
                {conversations.length === 0
                  ? "Messages will appear here when customers reply"
                  : "Try adjusting your search"}
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const last = conv.messages[conv.messages.length - 1];
              if (!last) return null;
              const isActive = conv.id === selectedId;
            return (
              <button
                key={conv.id}
                onClick={() => {
                  setSelectedId(conv.id);
                  setConversations(prev =>
                    prev.map(c =>
                      c.id === conv.id ? { ...c, hasUnread: false } : c,
                    ),
                  );
                }}
                className={
                  "w-full text-left px-4 py-3 flex space-x-3 hover:bg-gray-100 " +
                  (isActive ? "bg-muted" : "")
                }
              >
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                  {(conv.contactName || conv.phone)[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {conv.contactName || formatPhoneNumber(conv.phone)}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {last.text}
                  </p>
                </div>
                <div className="ml-2 shrink-0 text-xs text-gray-400">
                  {timeAgo(last.timestamp)}
                </div>
                {conv.hasUnread && !isActive && (
                  <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </button>
            );
          })
          )}
        </div>
      </aside>

      {/* Chat Panel */}
      {selected && (
        <section className="flex flex-1 flex-col">
          <div className="p-4 border-b flex items-center">
            <h2 className="font-semibold">
              {selected.contactName || formatPhoneNumber(selected.phone)}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selected.messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                message={msg.text}
                incoming={msg.incoming}
                timestamp={timeAgo(msg.timestamp)}
                status={msg.status}
              />
            ))}
          </div>
          <div className="p-4 border-t">
            <div className="flex items-end space-x-2">
              <Textarea
                placeholder="Type a message"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 resize-none"
              />
              <Button onClick={handleSend} disabled={!reply.trim()}>
                Send
              </Button>
            </div>
          </div>
        </section>
      )}

        </div>
      </Card>
    </div>
  );
}
