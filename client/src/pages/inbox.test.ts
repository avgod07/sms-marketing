import { describe, it, expect } from "vitest";

interface Message {
  id: number;
  contactId?: number | null;
  phoneNumber: string;
  content: string;
  createdAt: string;
  status: string;
}

interface Conversation {
  id: number;
  phone: string;
  messages: { id: number; text: string; status?: string }[];
  hasUnread?: boolean;
}

function applyMessage(
  prev: Conversation[],
  data: Message,
  selectedId: number | null
): Conversation[] {
  // Skip messages without contactId (e.g., test messages) - they don't belong in conversations
  if (!data.contactId) {
    return prev;
  }

  const idx = prev.findIndex(
    (c) => c.id === data.contactId || c.phone === data.phoneNumber
  );
  if (idx === -1) return prev;
  const conv = prev[idx];
  const updated: Conversation = {
    ...conv,
    messages: [
      ...conv.messages,
      { id: data.id, text: data.content, status: data.status },
    ],
    hasUnread: conv.id === selectedId ? false : true,
  };
  const copy = prev.slice();
  copy[idx] = updated;
  return copy;
}

function applyStatus(
  prev: Conversation[],
  id: number,
  status: string
): Conversation[] {
  return prev.map((c) => {
    const idx = c.messages.findIndex((m) => m.id === id);
    if (idx === -1) return c;
    const msgs = c.messages.slice();
    msgs[idx] = { ...msgs[idx], status };
    return { ...c, messages: msgs };
  });
}

describe("inbox message handler", () => {
  it("adds inbound message to conversation list", () => {
    const convs: Conversation[] = [{ id: 1, phone: "+123", messages: [] }];
    const msg: Message = {
      id: 2,
      contactId: 1,
      phoneNumber: "+123",
      content: "hello",
      createdAt: new Date().toISOString(),
      status: "received",
    };
    const updated = applyMessage(convs, msg, null);
    expect(updated[0].messages[0].text).toBe("hello");
    expect(updated[0].hasUnread).toBe(true);
  });

  it("updates message status", () => {
    const convs: Conversation[] = [
      { id: 1, phone: "+123", messages: [{ id: 2, text: "hi" }] },
    ];
    const updated = applyStatus(convs, 2, "delivered");
    expect(updated[0].messages[0].status).toBe("delivered");
  });

  it("ignores messages with null contactId (test messages)", () => {
    const convs: Conversation[] = [{ id: 1, phone: "+123", messages: [] }];
    const testMsg: Message = {
      id: 2,
      contactId: null, // Test message with null contactId
      phoneNumber: "+555-TEST",
      content: "Test message",
      createdAt: "2023-01-01T00:00:00Z",
      status: "sent",
    };
    const updated = applyMessage(convs, testMsg, null);
    // Should return unchanged - test messages don't appear in conversations
    expect(updated).toEqual(convs);
    expect(updated[0].messages).toHaveLength(0);
  });
});
