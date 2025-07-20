import { describe, it, expect, beforeEach, vi } from "vitest";
import { DatabaseStorage } from "./storage";
import {
  campaigns,
  couponRecipients,
  messages,
  coupons,
  contacts,
} from "@shared/schema";

// Mock the logger utility
vi.mock("../utils/logger.util", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

let insertMock: any;
let updateMock: any;
let selectMock: any;
let fromMock: any;
let selectWhereMock: any;
let orderByMock: any;
let valuesMock: any;
let setMock: any;
let whereMock: any;
let returningMock: any;
let deleteMock: any;
let transactionMock: any;

vi.mock("../config/db.config", () => ({
  db: {
    insert: (...args: any[]) => insertMock(...args),
    update: (...args: any[]) => updateMock(...args),
    select: (...args: any[]) => selectMock(...args),
    delete: (...args: any[]) => deleteMock(...args),
    transaction: (...args: any[]) => transactionMock(...args),
  },
}));

beforeEach(() => {
  returningMock = vi.fn().mockResolvedValue([{ id: 1 }]);
  valuesMock = vi.fn(() => ({ returning: returningMock }));
  insertMock = vi.fn(() => ({ values: valuesMock }));

  orderByMock = vi.fn().mockResolvedValue([]);
  selectWhereMock = vi.fn(() => ({ orderBy: orderByMock }));
  fromMock = vi.fn(() => ({ where: selectWhereMock }));
  selectMock = vi.fn(() => ({ from: fromMock }));

  whereMock = vi.fn(() => ({ returning: returningMock }));
  setMock = vi.fn(() => ({ where: whereMock }));
  updateMock = vi.fn(() => ({ set: setMock }));

  deleteMock = vi.fn(() => ({ where: whereMock }));
  transactionMock = vi.fn(async (fn: any) => {
    await fn({ delete: deleteMock });
  });
});

describe("DatabaseStorage phone normalization", () => {
  it("normalizes phone numbers on createContact", async () => {
    const storage = new DatabaseStorage(1);
    await storage.createContact({
      firstName: "A",
      lastName: "B",
      phoneNumber: "(123) 456-7890",
    });
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ phoneNumber: "+11234567890" })
    );
  });

  it("normalizes phone numbers on updateContact", async () => {
    const storage = new DatabaseStorage(1);
    await storage.updateContact(2, { phoneNumber: "(123) 456-7890" });
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ phoneNumber: "+11234567890" })
    );
  });
});

describe("DatabaseStorage.deleteCampaign", () => {
  it("removes messages and recipients before deleting campaign", async () => {
    const storage = new DatabaseStorage(2);

    await storage.deleteCampaign(5);

    expect(transactionMock).toHaveBeenCalled();
    expect(deleteMock).toHaveBeenCalledTimes(3);
    expect(deleteMock.mock.calls[0][0]).toBe(messages);
    expect(deleteMock.mock.calls[1][0]).toBe(couponRecipients);
    expect(deleteMock.mock.calls[2][0]).toBe(campaigns);
  });
});

describe("DatabaseStorage.getMessagesByContact", () => {
  it("queries by contact and orders ascending", async () => {
    const storage = new DatabaseStorage(3);
    await storage.getMessagesByContact(7);

    expect(selectMock).toHaveBeenCalled();
    expect(fromMock).toHaveBeenCalledWith(messages);
    expect(selectWhereMock).toHaveBeenCalled();
    expect(orderByMock).toHaveBeenCalled();
  });
});

describe("Coupons unique index", () => {
  it("allows same code for different businesses", async () => {
    const s1 = new DatabaseStorage(1);
    const s2 = new DatabaseStorage(2);

    await s1.createCoupon({ code: "SALE", type: "percent", value: "10" });
    await s2.createCoupon({ code: "SALE", type: "percent", value: "10" });

    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(valuesMock.mock.calls[0][0].businessId).toBe(1);
    expect(valuesMock.mock.calls[1][0].businessId).toBe(2);
  });
});

describe("createBusiness", () => {
  it("grants 50 trial credits when business is created with free_trial plan", async () => {
    const storage = new DatabaseStorage();
    const mockAdjustCredits = vi.fn().mockResolvedValue({ balance: 50 });
    const mockForBusiness = vi.fn().mockReturnValue({
      adjustCredits: mockAdjustCredits,
    });

    // Mock the forBusiness method
    vi.spyOn(storage, "forBusiness").mockImplementation(mockForBusiness);

    // Mock the database response to return the expected business object
    returningMock = vi.fn().mockResolvedValue([
      {
        id: 1,
        name: "Test Business",
        plan: "free_trial",
      },
    ]);

    const business = await storage.createBusiness({
      name: "Test Business",
      plan: "free_trial",
    });

    expect(business.name).toBe("Test Business");
    expect(business.plan).toBe("free_trial");
    expect(storage.forBusiness).toHaveBeenCalledWith(business.id);
    expect(mockAdjustCredits).toHaveBeenCalledWith(
      50,
      "trial_bonus",
      "Free trial credits for new business"
    );
  });

  it("does not grant trial credits when business is created with non-trial plan", async () => {
    const storage = new DatabaseStorage();
    const mockAdjustCredits = vi.fn();
    const mockForBusiness = vi.fn().mockReturnValue({
      adjustCredits: mockAdjustCredits,
    });

    // Mock the forBusiness method
    vi.spyOn(storage, "forBusiness").mockImplementation(mockForBusiness);

    // Mock the database response to return the expected business object
    returningMock = vi.fn().mockResolvedValue([
      {
        id: 1,
        name: "Test Business",
        plan: "starter",
      },
    ]);

    const business = await storage.createBusiness({
      name: "Test Business",
      plan: "starter",
    });

    expect(business.name).toBe("Test Business");
    expect(business.plan).toBe("starter");
    expect(mockAdjustCredits).not.toHaveBeenCalled();
  });

  it("handles errors gracefully when granting trial credits fails", async () => {
    const storage = new DatabaseStorage();
    const mockAdjustCredits = vi
      .fn()
      .mockRejectedValue(new Error("Database error"));
    const mockForBusiness = vi.fn().mockReturnValue({
      adjustCredits: mockAdjustCredits,
    });

    // Mock the forBusiness method
    vi.spyOn(storage, "forBusiness").mockImplementation(mockForBusiness);

    // Import the mocked logError
    const { logError } = await import("../utils/logger.util");

    // Mock the database response to return the expected business object
    returningMock = vi.fn().mockResolvedValue([
      {
        id: 1,
        name: "Test Business",
        plan: "free_trial",
      },
    ]);

    const business = await storage.createBusiness({
      name: "Test Business",
      plan: "free_trial",
    });

    expect(business.name).toBe("Test Business");
    expect(business.plan).toBe("free_trial");
    expect(mockAdjustCredits).toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(
      "Failed to grant trial credits",
      expect.objectContaining({
        businessId: business.id,
        error: "Database error",
      })
    );
  });
});
