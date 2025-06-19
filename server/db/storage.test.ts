import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseStorage } from './storage';
import { campaigns, couponRecipients, messages } from '@shared/schema';

let insertMock: any;
let updateMock: any;
let valuesMock: any;
let setMock: any;
let whereMock: any;
let returningMock: any;
let deleteMock: any;
let transactionMock: any;

vi.mock('../config/db.config', () => ({
  db: {
    insert: (...args: any[]) => insertMock(...args),
    update: (...args: any[]) => updateMock(...args),
    delete: (...args: any[]) => deleteMock(...args),
    transaction: (...args: any[]) => transactionMock(...args),
  },
}));

beforeEach(() => {
  returningMock = vi.fn().mockResolvedValue([{ id: 1 }]);
  valuesMock = vi.fn(() => ({ returning: returningMock }));
  insertMock = vi.fn(() => ({ values: valuesMock }));

  whereMock = vi.fn(() => ({ returning: returningMock }));
  setMock = vi.fn(() => ({ where: whereMock }));
  updateMock = vi.fn(() => ({ set: setMock }));

  deleteMock = vi.fn(() => ({ where: whereMock }));
  transactionMock = vi.fn(async (fn: any) => {
    await fn({ delete: deleteMock });
  });
});

describe('DatabaseStorage phone normalization', () => {
  it('normalizes phone numbers on createContact', async () => {
    const storage = new DatabaseStorage(1);
    await storage.createContact({
      firstName: 'A',
      lastName: 'B',
      phoneNumber: '(123) 456-7890',
    });
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ phoneNumber: '+11234567890' }),
    );
  });

  it('normalizes phone numbers on updateContact', async () => {
    const storage = new DatabaseStorage(1);
    await storage.updateContact(2, { phoneNumber: '(123) 456-7890' });
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ phoneNumber: '+11234567890' }),
    );
  });
});

describe('DatabaseStorage.deleteCampaign', () => {
  it('removes messages and recipients before deleting campaign', async () => {
    const storage = new DatabaseStorage(2);

    await storage.deleteCampaign(5);

    expect(transactionMock).toHaveBeenCalled();
    expect(deleteMock).toHaveBeenCalledTimes(3);
    expect(deleteMock.mock.calls[0][0]).toBe(messages);
    expect(deleteMock.mock.calls[1][0]).toBe(couponRecipients);
    expect(deleteMock.mock.calls[2][0]).toBe(campaigns);
  });
});
