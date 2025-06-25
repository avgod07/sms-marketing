vi.mock("../db/storage", () => {
  mockForBusiness = {
    createUser: vi.fn(),
    getContacts: vi.fn().mockResolvedValue([]),
    getCampaigns: vi.fn().mockResolvedValue([]),
    getCoupons: vi.fn().mockResolvedValue([]),
    getConversationSummaries: vi.fn().mockResolvedValue([]),
    getMessagesByContact: vi.fn().mockResolvedValue([]),
    createContact: vi.fn(),
    createMessage: vi.fn(),
    deleteCampaign: vi.fn(),
    searchContacts: vi.fn().mockResolvedValue([]),
    getDashboardStats: vi.fn().mockResolvedValue({
      totalContacts: 0,
      messagesSent: 0,
      activeCampaigns: 0,
      deliveryRate: 0,
      contactsChange: null,
      messagesChange: null,
      campaignsChange: null,
      deliveryRateChange: null,
    }),
    getTwilioCredentials: vi.fn().mockResolvedValue({}),
    getPhoneNumbers: vi.fn().mockResolvedValue([]),
  };
  mockStorage = {
    getUserByUsername: vi.fn(),
    getUserByClerkId: vi.fn(),
    createBusiness: vi.fn(),
    forBusiness: vi.fn(() => mockForBusiness),
  };
  return {
    storage: mockStorage,
    findTwilioCredentialByAccountSid: (mockFindCred = vi.fn()),
    findBusinessIdByPhoneNumber: (mockFindBizId = vi.fn()),
  };
});

import request from "supertest";
import express from "express";
import {
  vi,
  describe,
  it,
  expect,
  afterEach,
  beforeAll,
  beforeEach,
} from "vitest";
var mockForBusiness: any;
var mockStorage: any;
var registerRoutes: any;
var mockSendSMS: any;
var mockFindCred: any;
var mockFindBizId: any;
var mockBroadcast: any;

vi.mock("../config/db.config", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockResolvedValue([]),
    }),
  },
}));

vi.mock("../services/twilio.js", () => {
  mockSendSMS = vi.fn();
  return { TwilioService: { sendSMS: mockSendSMS } };
});

vi.mock("../socket", () => ({
  socketService: { broadcast: (mockBroadcast = vi.fn()) },
}));

vi.mock("../utils/encryption.util", () => ({
  decrypt: vi.fn(() => "token"),
  encrypt: vi.fn(),
}));

vi.mock("twilio", () => ({
  default: { validateRequest: vi.fn(() => true) },
  validateRequest: vi.fn(() => true),
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn(() => Promise.resolve("hashed")) },
  hash: vi.fn(() => Promise.resolve("hashed")),
}));

// Mock Clerk authentication
vi.mock("@clerk/express", () => ({
  requireAuth: () => (req: any, res: any, next: any) => {
    // Simulate Clerk authentication
    if (req.headers.authorization === "Bearer valid-token") {
      req.auth = () => ({ userId: "user_123", email: "test@example.com" });
      next();
    } else {
      res.status(401).json({ message: "Unauthorized" });
    }
  },
}));

beforeAll(async () => {
  registerRoutes = (await import("./index")).registerRoutes;
});

afterEach(() => {
  vi.clearAllMocks();
  registerRoutes = undefined;
});

async function setupApp(user?: any) {
  const app = express();
  app.use(express.json());

  // Add authentication header for authenticated requests
  if (user) {
    app.use((req, _res, next) => {
      req.headers.authorization = "Bearer valid-token";
      next();
    });
  }

  if (!registerRoutes) {
    registerRoutes = (await import("./index")).registerRoutes;
  }
  await registerRoutes(app);
  return app;
}

describe("routes", () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockStorage.getUserByClerkId.mockReset();
    mockStorage.forBusiness.mockReset();
    mockForBusiness.getContacts.mockReset();
    mockForBusiness.getCampaigns.mockReset();
    mockForBusiness.getCoupons.mockReset();
    mockForBusiness.getConversationSummaries.mockReset();
    mockForBusiness.getMessagesByContact.mockReset();
    mockForBusiness.searchContacts.mockReset();
    mockForBusiness.getDashboardStats.mockReset();

    // Re-establish default mock implementations
    mockStorage.forBusiness.mockReturnValue(mockForBusiness);
    mockForBusiness.getContacts.mockResolvedValue([]);
    mockForBusiness.getCampaigns.mockResolvedValue([]);
    mockForBusiness.getCoupons.mockResolvedValue([]);
    mockForBusiness.getConversationSummaries.mockResolvedValue([]);
    mockForBusiness.getMessagesByContact.mockResolvedValue([]);
    mockForBusiness.searchContacts.mockResolvedValue([]);
    mockForBusiness.getDashboardStats.mockResolvedValue({
      totalContacts: 0,
      messagesSent: 0,
      activeCampaigns: 0,
      deliveryRate: 0,
      contactsChange: null,
      messagesChange: null,
      campaignsChange: null,
      deliveryRateChange: null,
    });
  });

  it("me returns current user when authenticated", async () => {
    mockStorage.getUserByClerkId.mockResolvedValue({ id: 2, businessId: 1 });
    const app = await setupApp({ id: 2, name: "User" });
    const res = await request(app)
      .get("/api/me")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("userId");
  });

  it("me returns 401 when not authenticated", async () => {
    const app = await setupApp();
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(401);
  });

  it("scopes routes using the businessId from the session", async () => {
    mockStorage.getUserByClerkId.mockResolvedValue({ id: 1, businessId: 42 });
    mockStorage.forBusiness.mockReturnValue(mockForBusiness);
    mockForBusiness.getContacts.mockResolvedValue([]);
    const app = await setupApp();
    await request(app)
      .get("/api/contacts")
      .set("Authorization", "Bearer valid-token");
    expect(mockStorage.forBusiness).toHaveBeenCalledWith(42);
    expect(mockForBusiness.getContacts).toHaveBeenCalled();
  });

  it("searches contacts with multiple tokens", async () => {
    const contacts = [{ id: 1, firstName: "David", lastName: "Wilson" }];
    mockStorage.getUserByClerkId.mockResolvedValue({ id: 1, businessId: 1 });
    mockStorage.forBusiness.mockReturnValue(mockForBusiness);
    mockForBusiness.searchContacts.mockResolvedValue(contacts);
    const app = await setupApp();
    const res = await request(app)
      .get("/api/contacts")
      .query({ search: "David Wi" })
      .set("Authorization", "Bearer valid-token");
    expect(mockForBusiness.searchContacts).toHaveBeenCalledWith("David Wi");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(contacts);
  });

  it("searches contacts by first and last name", async () => {
    const contacts = [{ id: 2, firstName: "Sarah", lastName: "Johnson" }];
    mockStorage.getUserByClerkId.mockResolvedValue({ id: 1, businessId: 1 });
    mockStorage.forBusiness.mockReturnValue(mockForBusiness);
    mockForBusiness.searchContacts.mockResolvedValue(contacts);
    const app = await setupApp();
    const res = await request(app)
      .get("/api/contacts")
      .query({ search: "Sarah J" })
      .set("Authorization", "Bearer valid-token");
    expect(mockForBusiness.searchContacts).toHaveBeenCalledWith("Sarah J");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(contacts);
  });

  it("lists conversation summaries", async () => {
    const convs = [{ id: 1, contactId: 1, lastMessage: "Hello" }];
    mockStorage.getUserByClerkId.mockResolvedValue({ id: 1, businessId: 1 });
    mockStorage.forBusiness.mockReturnValue(mockForBusiness);
    mockForBusiness.getConversationSummaries.mockResolvedValue(convs);
    const app = await setupApp();
    const res = await request(app)
      .get("/api/conversations")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(convs);
    expect(mockForBusiness.getConversationSummaries).toHaveBeenCalled();
  });

  it("fetches messages for contact", async () => {
    const msgs = [{ id: 1, content: "Hello", contactId: 3 }];
    mockStorage.getUserByClerkId.mockResolvedValue({ id: 1, businessId: 1 });
    mockStorage.forBusiness.mockReturnValue(mockForBusiness);
    mockForBusiness.getMessagesByContact.mockResolvedValue(msgs);
    const app = await setupApp();
    const res = await request(app)
      .get("/api/conversations/3/messages")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(msgs);
    expect(mockForBusiness.getMessagesByContact).toHaveBeenCalledWith(3);
  });

  describe("multi-tenant isolation", () => {
    it("returns only contacts for the authenticated business", async () => {
      const contacts1 = [{ id: 1, firstName: "A" }];
      const contacts2 = [{ id: 2, firstName: "B" }];

      mockStorage.getUserByClerkId
        .mockResolvedValueOnce({ id: 1, businessId: 1 })
        .mockResolvedValueOnce({ id: 2, businessId: 2 });

      mockStorage.forBusiness
        .mockReturnValueOnce({
          ...mockForBusiness,
          getContacts: vi.fn().mockResolvedValue(contacts1),
        })
        .mockReturnValueOnce({
          ...mockForBusiness,
          getContacts: vi.fn().mockResolvedValue(contacts2),
        });

      const app1 = await setupApp();
      const app2 = await setupApp();
      const res1 = await request(app1)
        .get("/api/contacts")
        .set("Authorization", "Bearer valid-token");
      const res2 = await request(app2)
        .get("/api/contacts")
        .set("Authorization", "Bearer valid-token");
      expect(res1.body).toEqual(contacts1);
      expect(res2.body).toEqual(contacts2);
    });

    it("returns only campaigns for the authenticated business", async () => {
      const campaigns1 = [{ id: 1, name: "C1" }];
      const campaigns2 = [{ id: 2, name: "C2" }];

      mockStorage.getUserByClerkId
        .mockResolvedValueOnce({ id: 1, businessId: 1 })
        .mockResolvedValueOnce({ id: 2, businessId: 2 });

      mockStorage.forBusiness
        .mockReturnValueOnce({
          ...mockForBusiness,
          getCampaigns: vi.fn().mockResolvedValue(campaigns1),
        })
        .mockReturnValueOnce({
          ...mockForBusiness,
          getCampaigns: vi.fn().mockResolvedValue(campaigns2),
        });

      const app1 = await setupApp();
      const app2 = await setupApp();
      const res1 = await request(app1)
        .get("/api/campaigns")
        .set("Authorization", "Bearer valid-token");
      const res2 = await request(app2)
        .get("/api/campaigns")
        .set("Authorization", "Bearer valid-token");
      expect(res1.body).toEqual(campaigns1);
      expect(res2.body).toEqual(campaigns2);
    });

    it("returns only coupons for the authenticated business", async () => {
      const coupons1 = [{ id: 1, code: "X1" }];
      const coupons2 = [{ id: 2, code: "X2" }];

      mockStorage.getUserByClerkId
        .mockResolvedValueOnce({ id: 1, businessId: 1 })
        .mockResolvedValueOnce({ id: 2, businessId: 2 });

      mockStorage.forBusiness
        .mockReturnValueOnce({
          ...mockForBusiness,
          searchCoupons: vi.fn().mockResolvedValue(coupons1),
        })
        .mockReturnValueOnce({
          ...mockForBusiness,
          searchCoupons: vi.fn().mockResolvedValue(coupons2),
        });

      const app1 = await setupApp();
      const app2 = await setupApp();
      const res1 = await request(app1)
        .get("/api/coupons")
        .set("Authorization", "Bearer valid-token");
      const res2 = await request(app2)
        .get("/api/coupons")
        .set("Authorization", "Bearer valid-token");
      expect(res1.body).toEqual(coupons1);
      expect(res2.body).toEqual(coupons2);
    });

    it("returns stats for the authenticated business only", async () => {
      const stats1 = { totalContacts: 1, messagesSent: 5 };
      const stats2 = { totalContacts: 5, messagesSent: 10 };

      mockStorage.getUserByClerkId
        .mockResolvedValueOnce({ id: 1, businessId: 1 })
        .mockResolvedValueOnce({ id: 2, businessId: 2 });

      mockStorage.forBusiness
        .mockReturnValueOnce({
          ...mockForBusiness,
          getDashboardStats: vi.fn().mockResolvedValue(stats1),
        })
        .mockReturnValueOnce({
          ...mockForBusiness,
          getDashboardStats: vi.fn().mockResolvedValue(stats2),
        });

      const app1 = await setupApp();
      const app2 = await setupApp();
      const res1 = await request(app1)
        .get("/api/dashboard/stats")
        .set("Authorization", "Bearer valid-token");
      const res2 = await request(app2)
        .get("/api/dashboard/stats")
        .set("Authorization", "Bearer valid-token");
      expect(res1.body.totalContacts).toBe(1);
      expect(res2.body.totalContacts).toBe(5);
    });
  });
});
