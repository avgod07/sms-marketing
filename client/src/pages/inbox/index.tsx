import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import ChatBubble from "@/components/shared/ChatBubble";
import { formatPhoneNumber, timeAgo } from "@/lib/utils";
import { Search, MessageSquareText, Plus, AlertTriangle } from "lucide-react";
import { emitMessageSend } from "@/lib/socket";
import { useMessageSocket } from "@/hooks/use-message-socket";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useBusinessTimezone } from "@/hooks/use-business-timezone";
import { handleApiError } from "@/lib/handleApiError";
import type { Message as ApiMessage } from "@shared/schema";
import type { Contact } from "@shared/schema";
import { useSetupStatus } from "@/hooks/use-setup-status";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import NewMessageModal from "@/components/inbox/new-message-modal";
import { useLocation, Link } from "wouter";

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
  active: boolean;
}

export default function Inbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);
  const [preSelectedContact, setPreSelectedContact] = useState<Contact | null>(null);
  const { toast } = useToast();
  const { data: user } = useAuth();
  const debouncedSearch = useDebounce(searchQuery, 300);
  const trimmedSearch = debouncedSearch.trim().toLowerCase();
  const [location] = useLocation();
  const selected =
    selectedId !== null
      ? conversations.find((c) => c.id === selectedId) || null
      : null;
  const filteredConversations = conversations.filter((c) => {
    if (!trimmedSearch) return true;
    const target = `${c.contactName ?? ""} ${c.phone}`.toLowerCase();
    return target.includes(trimmedSearch);
  });
  const { data: setup } = useSetupStatus(!!user);
  const { timezone } = useBusinessTimezone();

  // Handle pre-selected contact from URL parameters
  useEffect(() => {
    if (location.includes('contactId=')) {
      const urlParams = new URLSearchParams(location.split('?')[1]);
      const contactId = urlParams.get('contactId');
      const contactName = urlParams.get('contactName');
      const phoneNumber = urlParams.get('phoneNumber');
      
      if (contactId && contactName && phoneNumber) {
        const contact: Contact = {
          id: parseInt(contactId),
          firstName: contactName.split(' ')[0] || '',
          lastName: contactName.split(' ').slice(1).join(' ') || '',
          phoneNumber: phoneNumber,
          email: null,
          active: true,
          businessId: 0,
          consentDate: new Date(),
          consentMethod: "unknown",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setPreSelectedContact(contact);
        setIsNewMessageModalOpen(true);
      }
    }
  }, [location]);

  useEffect(() => {
    if (!user) return; // Only load conversations when user is authenticated
    
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
            active: c.active !== false,
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
        toast({
          title: "Failed to load conversations",
          description: handleApiError(err),
          variant: "destructive",
        });
      }
    }
    loadConversations();
  }, [user]); // Add user as dependency

  useEffect(() => {
    if (selectedId === null || !user) return; // Only load messages when user is authenticated
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
        toast({
          title: "Failed to load messages",
          description: handleApiError(err),
          variant: "destructive",
        });
      }
    }
    loadMessages();
  }, [selectedId, user]); // Add user as dependency

  useMessageSocket({
    onMessage: (data) => {
      const contactId = (data as any).contactId as number | null | undefined;
      const phone = (data as any).phoneNumber as string | undefined;
      const messageType = (data as any).messageType as string | undefined;
      
      // Skip messages without contactId (e.g., test messages) - they don't belong in conversations
      if (!contactId) {
        return;
      }
      
      // Skip campaign, test, welcome, and compliance messages - they don't belong in conversations
      // This creates a stricter filter than backend getConversationSummaries() for cleaner real-time experience
      // Frontend includes: 'received', 'regular', 'individual' 
      // Frontend excludes: 'campaign', 'test', 'welcome', compliance messages (stop_response, help_response, etc.)
      if (messageType === 'campaign' || 
          messageType === 'test' || 
          messageType === 'welcome' ||
          messageType === 'stop_response' || 
          messageType === 'help_response' ||
          messageType === 'sms_command_response') {
        return;
      }
      
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === contactId || c.phone === phone);
        
        if (idx === -1) {
          // Create new conversation for first-time contact
          const newConversation: Conversation = {
            id: contactId,
            contactName: undefined, // Will display phone number initially
            phone: phone || '', // Fallback to empty string if phone is undefined
            active: true, // New contacts are active by default
            messages: [
              {
                id: data.id,
                text: data.content,
                timestamp: new Date((data as any).createdAt ?? Date.now()),
                incoming: data.status === 'received',
                status: data.status,
              },
            ],
            hasUnread: true, // New conversations should be marked as unread
          };
          
          // Add new conversation to the beginning of the list (most recent first)
          return [newConversation, ...prev];
        }
        
        // Existing logic for updating existing conversations
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
    if (!reply.trim() || !selected || !selected.active) return;
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
      toast({
        title: "Failed to send message",
        description: handleApiError(err),
        variant: "destructive",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewMessageClick = () => {
    setIsNewMessageModalOpen(true);
  };

  const handleNewMessageModalClose = () => {
    setIsNewMessageModalOpen(false);
    setPreSelectedContact(null);
  };

  const handleMessageSent = (message: ApiMessage) => {
    // Refresh conversations to show the new conversation
    const loadConversations = async () => {
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
            active: c.active !== false,
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
          
          // Select the conversation with the contact we just messaged (only for messages with contactId)
          if (message.contactId) {
            const newConv = convs.find(c => c.id === message.contactId);
            if (newConv) {
              setSelectedId(newConv.id);
            }
          }
        }
      } catch (err) {
        console.error("Failed to refresh conversations:", err);
      }
    };
    loadConversations();
  };

  return (
    <div className="fade-in h-screen flex flex-col">
      {/* Page Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
          <p className="text-gray-600 mt-1">View and reply to incoming messages</p>
        </div>
      </header>
      
      {/* Content */}
      <div className="flex-1 min-h-0 p-8">
        {/* Setup Warning - Show at top if onboarding not complete */}
        {setup && !setup.onboardingComplete && (
          <Alert className="mb-6 bg-yellow-50 border-yellow-400 text-yellow-700">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Finish Setup</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>Complete your onboarding to start sending messages and receiving replies.</p>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href="/onboarding">Complete Setup</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        <Card className="mx-auto h-full w-full max-w-[1200px] p-6 flex flex-col">
          <div className="flex flex-1 min-h-0 w-full">
            {/* Conversations Sidebar */}
            <aside className="hidden md:flex w-[300px] flex-col border-r border-gray-200 min-h-0">
              <div className="p-4 border-b shrink-0">
                <Button
                  onClick={handleNewMessageClick}
                  className="w-full mb-3"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Message
                </Button>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
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
                        {timeAgo(last.timestamp, timezone)}
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
            {conversations.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
                <MessageSquareText className="w-16 h-16 text-gray-300 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Start your first conversation</h2>
                <p className="text-gray-600 mb-4">
                  Add a contact or wait for someone to message you. Your chats will show up here.
                </p>
              </div>
            ) : selected && (
              <section className="flex flex-1 min-h-0 flex-col">
                <div className="p-4 border-b flex items-center space-x-2 shrink-0">
                  <h2 className="font-semibold">
                    {selected.contactName || formatPhoneNumber(selected.phone)}
                  </h2>
                  {!selected.active && (
                    <span className="rounded bg-red-100 text-red-700 px-2 py-0.5 text-xs">Inactive</span>
                  )}
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
                  {selected.messages.map((msg) => (
                    <ChatBubble
                      key={msg.id}
                      message={msg.text}
                      incoming={msg.incoming}
                      timestamp={timeAgo(msg.timestamp, timezone)}
                      status={msg.status}
                    />
                  ))}
                </div>
                <div className="p-4 border-t shrink-0">
                  <div className="flex items-end space-x-2">
                    <Textarea
                      placeholder="Type a message"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="flex-1 resize-none"
                      disabled={!selected.active}
                    />
                    <Button onClick={handleSend} disabled={!reply.trim() || !selected.active}>
                      Send
                    </Button>
                  </div>
                </div>
              </section>
            )}
          </div>
        </Card>
      </div>
      
      <NewMessageModal
        isOpen={isNewMessageModalOpen}
        onClose={handleNewMessageModalClose}
        onMessageSent={handleMessageSent}
        preSelectedContact={preSelectedContact}
      />
    </div>
  );
}
