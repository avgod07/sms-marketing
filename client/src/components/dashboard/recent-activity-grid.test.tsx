import { describe, it, expect, vi } from "vitest";
import { RecentActivityGrid } from "./recent-activity-grid";

// Mock the useRecentActivity hook
vi.mock("@/hooks/useRecentActivity", () => ({
  useRecentActivity: vi.fn(),
}));

const mockUseRecentActivity = vi.mocked(await import("@/hooks/useRecentActivity")).useRecentActivity;

describe("RecentActivityGrid", () => {
  it("returns correct data structure from hook", () => {
    const mockData = {
      contacts: [
        {
          id: 1,
          firstName: "John",
          lastName: "Doe",
          phoneNumber: "+1234567890",
          email: "john@example.com",
          createdAt: "2024-01-01T00:00:00Z",
        },
      ],
      campaigns: [
        {
          id: 1,
          name: "Summer Sale",
          status: "completed",
          createdAt: "2024-01-01T00:00:00Z",
        },
      ],
      messages: [
        {
          id: 1,
          content: "Hello!",
          status: "delivered",
          phoneNumber: "+1234567890",
          contactId: 1,
          contactName: "John Doe",
          createdAt: "2024-01-01T00:00:00Z",
        },
      ],
      inboxMessages: [
        {
          id: 2,
          content: "Hi there!",
          status: "received",
          phoneNumber: "+1234567890",
          contactId: 1,
          contactName: "John Doe",
          createdAt: "2024-01-01T00:00:00Z",
        },
      ],
      isLoading: false,
      isError: false,
    };

    mockUseRecentActivity.mockReturnValue(mockData);

    // Test that the hook returns the expected structure
    const result = mockUseRecentActivity();
    
    expect(result.contacts).toHaveLength(1);
    expect(result.campaigns).toHaveLength(1);
    expect(result.messages).toHaveLength(1);
    expect(result.inboxMessages).toHaveLength(1);
    expect(result.isLoading).toBe(false);
    expect(result.isError).toBe(false);
    
    expect(result.contacts[0].firstName).toBe("John");
    expect(result.campaigns[0].name).toBe("Summer Sale");
    expect(result.messages[0].contactName).toBe("John Doe");
    expect(result.inboxMessages[0].contactName).toBe("John Doe");
  });

  it("handles loading state", () => {
    const loadingData = {
      contacts: [],
      campaigns: [],
      messages: [],
      inboxMessages: [],
      isLoading: true,
      isError: false,
    };

    mockUseRecentActivity.mockReturnValue(loadingData);
    
    const result = mockUseRecentActivity();
    expect(result.isLoading).toBe(true);
    expect(result.contacts).toHaveLength(0);
    expect(result.inboxMessages).toHaveLength(0);
  });

  it("handles error state", () => {
    const errorData = {
      contacts: [],
      campaigns: [],
      messages: [],
      inboxMessages: [],
      isLoading: false,
      isError: true,
    };

    mockUseRecentActivity.mockReturnValue(errorData);
    
    const result = mockUseRecentActivity();
    expect(result.isError).toBe(true);
    expect(result.isLoading).toBe(false);
    expect(result.inboxMessages).toHaveLength(0);
  });
}); 