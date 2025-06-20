import { describe, it, expect, vi } from 'vitest';

let mockSendBulkSMS: any;
vi.mock('./twilio', () => ({
  TwilioService: { sendBulkSMS: (...args: any[]) => mockSendBulkSMS(...args) },
}));

function createMockStorage() {
  return {
    getCampaign: vi.fn().mockResolvedValue({ id: 1, message: 'hi' }),
    getContacts: vi.fn().mockResolvedValue([
      { id: 1, phoneNumber: '+10000000001' },
      { id: 2, phoneNumber: '+10000000002' },
    ]),
    getCoupons: vi.fn().mockResolvedValue([]),
    createCouponRecipient: vi.fn(),
    getTwilioCredentials: vi.fn().mockResolvedValue(undefined),
    getPhoneNumbers: vi.fn().mockResolvedValue([
      { phoneNumber: '+15550000000', isDefault: true },
    ]),
    createMessage: vi.fn(),
    updateCampaign: vi.fn(),
  } as any;
}

describe('executeCampaign', () => {
  it('marks campaign failed when all sends fail', async () => {
    const { executeCampaign } = await import('./campaign');
    const storage = createMockStorage();
    mockSendBulkSMS = vi.fn().mockResolvedValue([{ success: false }, { success: false }]);

    const result = await executeCampaign(storage, 1);

    expect(result.sentCount).toBe(0);
    expect(result.failedCount).toBe(2);
    expect(storage.updateCampaign).toHaveBeenCalledWith(1, {
      status: 'failed',
      sentCount: 0,
      deliveredCount: 0,
    });
  });
});


