import { describe, it, expect, vi } from "vitest";

let mockSendBulkSMS: any;
vi.mock("./twilio", () => ({
  TwilioService: { sendBulkSMS: (...args: any[]) => mockSendBulkSMS(...args) },
}));

function createMockStorage() {
  return {
    getCampaign: vi.fn().mockResolvedValue({ id: 1, message: "hi" }),
    getContacts: vi.fn().mockResolvedValue([
      { id: 1, phoneNumber: "+10000000001", active: true },
      { id: 2, phoneNumber: "+10000000002", active: true },
    ]),
    getCoupons: vi.fn().mockResolvedValue([]),
    createCouponRecipient: vi.fn(),
    getTwilioCredentials: vi.fn().mockResolvedValue(undefined),
    getPhoneNumbers: vi
      .fn()
      .mockResolvedValue([{ phoneNumber: "+15550000000", isDefault: true }]),
    createMessage: vi.fn(),
    updateCampaign: vi.fn(),
    getCredits: vi.fn().mockResolvedValue({ balance: 10 }),
    adjustCredits: vi.fn().mockResolvedValue({ balance: 8 }),
  } as any;
}

describe("executeCampaign", () => {
  it("marks campaign completed even when all sends fail", async () => {
    const { executeCampaign } = await import("./campaign");
    const storage = createMockStorage();
    mockSendBulkSMS = vi
      .fn()
      .mockResolvedValue([{ success: false }, { success: false }]);

    const result = await executeCampaign(storage, 1);

    expect(result.sentCount).toBe(0);
    expect(result.failedCount).toBe(2);
    expect(storage.updateCampaign).toHaveBeenCalledWith(1, {
      status: "completed",
      sentCount: 0,
      deliveredCount: 0,
    });
    expect(storage.adjustCredits).not.toHaveBeenCalled();
  });

  it("sends only to active contacts", async () => {
    const { executeCampaign } = await import("./campaign");
    const storage = createMockStorage();
    storage.getContacts = vi.fn().mockResolvedValue([
      { id: 1, phoneNumber: "+10000000001", active: true },
      { id: 2, phoneNumber: "+10000000002", active: false },
    ]);

    mockSendBulkSMS = vi.fn().mockResolvedValue([{ success: true }]);

    const result = await executeCampaign(storage, 1);

    expect(mockSendBulkSMS).toHaveBeenCalled();
    const messages = mockSendBulkSMS.mock.calls[0][1];
    expect(messages).toHaveLength(1);
    expect(messages[0].contactId).toBe(1);
    expect(result.totalContacts).toBe(1);
  });

  it("deducts credits and records transaction after successful sends", async () => {
    const { executeCampaign } = await import("./campaign");
    const storage = createMockStorage();
    mockSendBulkSMS = vi
      .fn()
      .mockResolvedValue([{ success: true }, { success: true }]);

    const result = await executeCampaign(storage, 1);

    expect(storage.getCredits).toHaveBeenCalled();
    expect(storage.adjustCredits).toHaveBeenCalledWith(
      -2,
      "send_sms",
      "Sent 2 SMS for campaign 1",
      {
        campaignId: 1,
        failedCount: 0,
        totalContacts: 2,
      }
    );
    expect(result.sentCount).toBe(2);
  });

  it("throws if not enough credits", async () => {
    const { executeCampaign, InsufficientCreditsError } = await import(
      "./campaign"
    );
    const storage = createMockStorage();
    storage.getCredits = vi.fn().mockResolvedValue({ balance: 1 }); // Only 1 credit, but 2 contacts
    mockSendBulkSMS = vi.fn();

    await expect(executeCampaign(storage, 1)).rejects.toThrow(
      InsufficientCreditsError
    );
    expect(storage.adjustCredits).not.toHaveBeenCalled();
  });
});
