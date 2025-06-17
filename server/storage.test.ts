import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseStorage } from './storage';

let insertMock: any;
let updateMock: any;
let valuesMock: any;
let setMock: any;
let whereMock: any;
let returningMock: any;

vi.mock('./db', () => ({
  db: {
    insert: (...args: any[]) => insertMock(...args),
    update: (...args: any[]) => updateMock(...args),
  },
}));

beforeEach(() => {
  returningMock = vi.fn().mockResolvedValue([{ id: 1 }]);
  valuesMock = vi.fn(() => ({ returning: returningMock }));
  insertMock = vi.fn(() => ({ values: valuesMock }));

  whereMock = vi.fn(() => ({ returning: returningMock }));
  setMock = vi.fn(() => ({ where: whereMock }));
  updateMock = vi.fn(() => ({ set: setMock }));
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
