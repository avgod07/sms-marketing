import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import ChatBubble from "@/components/shared/ChatBubble";
import { formatPhoneNumber, timeAgo } from "@/lib/utils";
import { Search, MessageSquareText } from "lucide-react";

interface Message {
  id: number;
  text: string;
  timestamp: Date;
  incoming: boolean;
}

interface Conversation {
  id: number;
  contactName?: string;
  phone: string;
  messages: Message[];
}

const mockConversations: Conversation[] = [
  {
    id: 1,
    contactName: "John Doe",
    phone: "1234567890",
    messages: [
      { id: 1, text: "Hey there!", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), incoming: true },
      { id: 2, text: "Hi John, how can I help you?", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2 + 60000), incoming: false },
    ],
  },
  {
    id: 2,
    contactName: "Jane Smith",
    phone: "9876543210",
    messages: [
      { id: 1, text: "I would like to know more about your services.", timestamp: new Date(Date.now() - 1000 * 60 * 30), incoming: true },
    ],
  },
  {
    id: 3,
    phone: "5551237890",
    messages: [
      { id: 1, text: "Is this the right number to contact support?", timestamp: new Date(Date.now() - 1000 * 60 * 5), incoming: true },
    ],
  },
];

export default function Inbox() {
  const [selectedId, setSelectedId] = useState<number>(mockConversations[0].id);
  const [reply, setReply] = useState("");
  const selected = mockConversations.find((c) => c.id === selectedId)!;

  const handleSend = () => {
    if (!reply.trim()) return;
    selected.messages.push({
      id: Date.now(),
      text: reply,
      timestamp: new Date(),
      incoming: false,
    });
    setReply("");
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
            <Input placeholder="Search..." className="pl-10" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {mockConversations.map((conv) => {
            const last = conv.messages[conv.messages.length - 1];
            const isActive = conv.id === selectedId;
            return (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
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
              </button>
            );
          })}
        </div>
      </aside>

      {/* Chat Panel */}
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

        </div>
      </Card>
    </div>
  );
}
