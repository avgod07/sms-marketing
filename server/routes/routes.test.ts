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

// Mock Clerk authentication
vi.mock("@clerk/express", () => ({
  requireAuth: () => (req: any, res: any, next: any) => {
    // If req.auth is mocked to have a userId, allow the request
    const auth = typeof req.auth === "function" ? req.auth() : req.auth;
    if (auth?.userId) {
      return next();
    }
    // Otherwise, redirect to login (simulating Clerk behavior)
    return res.status(302).redirect("/sign-in");
  },
}));

vi.mock("../db/storage", () => {
  mockForBusiness = {
    createUser: vi.fn(),
    getCredits: vi.fn(),
    adjustCredits: vi.fn(),
    getContacts: vi.fn().mockResolvedValue([]),
    getCampaigns: vi.fn().mockResolvedValue([]),
    getCoupons: vi.fn().mockResolvedValue([]),
    getDashboardStats: vi.fn().mockResolvedValue({}),
    deleteCampaign: vi.fn().mockResolvedValue(undefined),
  };
  mockStorage = {
    getUserByUsername: vi.fn(),
    getUserByClerkId: vi.fn(),
    createBusiness: vi.fn().mockResolvedValue({ id: 2 }),
    forBusiness: vi.fn(() => mockForBusiness),
  };
  return {
    storage: mockStorage,
    findTwilioCredentialByAccountSid: (mockFindCred = vi.fn()),
    findBusinessIdByPhoneNumber: (mockFindBizId = vi.fn()),
  };
});

vi.mock("../services/twilio.js", () => {
  mockSendSMS = vi.fn();
  return { TwilioService: { sendSMS: mockSendSMS } };
});

vi.mock("../services/stripe", () => ({
  createCheckoutSession: vi
    .fn()
    .mockResolvedValue({ url: "https://stripe.test/session" }),
  verifyWebhookSignature: vi.fn((signature, payload) => {
    if (signature === "valid") {
      return {
        type: "checkout.session.completed",
        data: {
          object: {
            id: "sess_123",
            metadata: { businessId: "1", credits: "50" },
            amount_total: 50, // $0.50 in cents
            payment_status: "paid",
            currency: "usd",
          },
        },
      };
    }
    throw new Error("Invalid signature");
  }),
}));

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

vi.mock("passport", () => ({
  default: {
    authenticate: () => (_req: any, _res: any, next: any) => next(),
    initialize: () => (_req: any, _res: any, next: any) => next(),
    session: () => (_req: any, _res: any, next: any) => next(),
    use: vi.fn(),
    serializeUser: vi.fn(),
    deserializeUser: vi.fn(),
  },
  authenticate: () => (_req: any, _res: any, next: any) => next(),
  initialize: () => (_req: any, _res: any, next: any) => next(),
  session: () => (_req: any, _res: any, next: any) => next(),
  use: vi.fn(),
  serializeUser: vi.fn(),
  deserializeUser: vi.fn(),
}));

beforeAll(async () => {
  registerRoutes = (await import("./index")).registerRoutes;
});

afterEach(() => {
  vi.clearAllMocks();
  registerRoutes = undefined;
});

beforeEach(() => {
  vi.clearAllMocks();
  // Default: always return user id: 1, businessId: 1
  if (mockStorage.getUserByClerkId) {
    mockStorage.getUserByClerkId.mockReset();
    mockStorage.getUserByClerkId.mockResolvedValue({ id: 1, businessId: 1 });
  }
  if (mockStorage.createBusiness) {
    mockStorage.createBusiness.mockReset();
    mockStorage.createBusiness.mockResolvedValue({ id: 1 });
  }
  if (mockStorage.forBusiness) {
    mockStorage.forBusiness.mockReset && mockStorage.forBusiness.mockReset();
    mockStorage.forBusiness.mockImplementation(() => mockForBusiness);
  }
});

async function setupApp(user?: any) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    // Mock Clerk authentication
    req.auth = () => ({
      userId: user ? "clerk_user_123" : undefined,
    });
    next();
  });
  if (!registerRoutes) {
    registerRoutes = (await import("./index")).registerRoutes;
  }
  await registerRoutes(app);
  return app;
}

describe("routes", () => {
  it("me returns current user", async () => {
    mockStorage.getUserByClerkId.mockResolvedValue({ id: 2, businessId: 1 });
    const app = await setupApp({ id: 2, name: "User" });
    const res = await request(app).get("/api/me");
    expect(res.body).toEqual({
      hasLocalAccount: true,
      userId: 2,
      businessId: 1,
    });
  });

  it("me returns hasLocalAccount false when not logged in", async () => {
    const app = await setupApp();
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(302); // Redirect to sign-in
  });

  it("deletes campaign with existing messages", async () => {
    mockForBusiness.deleteCampaign = vi.fn().mockResolvedValue(undefined);
    mockStorage.getUserByClerkId.mockResolvedValue({ id: 1, businessId: 1 });

    const app = await setupApp({ businessId: 1 });
    const res = await request(app).delete("/api/campaigns/3");

    expect(mockForBusiness.deleteCampaign).toHaveBeenCalledWith(3);
    expect(res.status).toBe(204);
  });

  it("public contact signup creates contact", async () => {
    const businessMocks: Record<number, any> = {};
    mockStorage.forBusiness.mockImplementation((businessId: number) => {
      if (!businessMocks[businessId]) {
        businessMocks[businessId] = {
          createContact: vi.fn().mockResolvedValue({ id: 5 }),
          getBusiness: vi
            .fn()
            .mockResolvedValue({ id: businessId, name: "Test Business" }),
          getContactByPhoneNumber: vi.fn().mockResolvedValue(undefined),
          getContacts: vi.fn().mockResolvedValue([]),
          getCampaigns: vi.fn().mockResolvedValue([]),
          getCoupons: vi.fn().mockResolvedValue([]),
          getDashboardStats: vi.fn().mockResolvedValue({}),
          getCredits: vi.fn().mockResolvedValue({ balance: 0 }),
          adjustCredits: vi.fn(),
          createUser: vi
            .fn()
            .mockImplementation(() => Promise.resolve({ id: 1, businessId })),
        };
      }
      return businessMocks[businessId];
    });

    mockStorage.getUserByClerkId.mockReset();
    mockStorage.createBusiness.mockReset();
    mockStorage.getUserByClerkId
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 1, businessId: 2 });
    mockStorage.createBusiness.mockResolvedValue({ id: 2 });

    const app = await setupApp({ id: 1, businessId: 2 });

    const res = await request(app).post("/public/contacts").send({
      businessId: 2,
      firstName: "John",
      lastName: "Doe",
      phoneNumber: "+15551234567",
      email: "j@example.com",
    });

    expect(res.status).toBe(201);
    expect(mockStorage.forBusiness).toHaveBeenCalledWith(2);
    expect(businessMocks[2].createContact).toHaveBeenCalled();
  });

  it("scopes routes using the businessId from the session", async () => {
    mockForBusiness.getContacts = vi.fn().mockResolvedValue([]);
    mockStorage.getUserByClerkId.mockResolvedValue({ id: 1, businessId: 42 });
    const app = await setupApp({ businessId: 42 });

    await request(app).get("/api/contacts");

    expect(mockStorage.forBusiness).toHaveBeenCalledWith(42);
    expect(mockForBusiness.getContacts).toHaveBeenCalled();
  });

  it("searches contacts with multiple tokens", async () => {
    const contacts = [{ id: 1, firstName: "David", lastName: "Wilson" }];
    mockForBusiness.searchContacts = vi.fn().mockResolvedValue(contacts);
    const app = await setupApp({ businessId: 1 });

    const res = await request(app)
      .get("/api/contacts")
      .query({ search: "David Wi" });

    expect(mockForBusiness.searchContacts).toHaveBeenCalledWith("David Wi");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(contacts);
  });

  it("searches contacts by first and last name", async () => {
    const contacts = [{ id: 2, firstName: "Sarah", lastName: "Johnson" }];
    mockForBusiness.searchContacts = vi.fn().mockResolvedValue(contacts);
    const app = await setupApp({ businessId: 1 });

    const res = await request(app)
      .get("/api/contacts")
      .query({ search: "Sarah J" });

    expect(mockForBusiness.searchContacts).toHaveBeenCalledWith("Sarah J");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(contacts);
  });

  it("lists conversation summaries", async () => {
    const convs = [{ id: 1 }];
    mockForBusiness.getConversationSummaries = vi.fn().mockResolvedValue(convs);
    const app = await setupApp({ businessId: 1 });

    const res = await request(app).get("/api/conversations");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(convs);
    expect(mockForBusiness.getConversationSummaries).toHaveBeenCalled();
  });

  it("fetches messages for contact", async () => {
    const msgs = [{ id: 1 }];
    mockForBusiness.getMessagesByContact = vi.fn().mockResolvedValue(msgs);
    const app = await setupApp({ businessId: 1 });

    const res = await request(app).get("/api/conversations/3/messages");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(msgs);
    expect(mockForBusiness.getMessagesByContact).toHaveBeenCalledWith(3);
  });

  it("sends sms and saves message", async () => {
    const creds = {
      accountSid: "AC123",
      authTokenEncrypted: "enc",
      messagingServiceSid: "MG456",
    };
    mockForBusiness.getTwilioCredentials = vi.fn().mockResolvedValue(creds);
    mockForBusiness.getPhoneNumbers = vi
      .fn()
      .mockResolvedValue([{ phoneNumber: "+15550001111", isDefault: true }]);
    mockForBusiness.getContact = vi
      .fn()
      .mockResolvedValue({ id: 4, active: true });
    mockSendSMS.mockResolvedValue({ success: true, messageSid: "SM789" });
    mockForBusiness.createMessage = vi
      .fn()
      .mockResolvedValue({ id: 7, content: "hi" });

    const app = await setupApp({ businessId: 1 });

    const res = await request(app).post("/api/messages").send({
      phoneNumber: "+15551234567",
      content: "hello",
      contactId: 4,
    });

    expect(res.status).toBe(201);
    expect(mockSendSMS).toHaveBeenCalledWith(creds, {
      to: "+15551234567",
      message: "hello",
      from: "+15550001111",
      messagingServiceSid: "MG456",
      campaignId: undefined,
      contactId: 4,
    });
    expect(mockForBusiness.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: "+15551234567",
        content: "hello",
        status: "sent",
        messageSid: "SM789",
      })
    );
  });

  it("handles inbound webhook and broadcasts message", async () => {
    mockFindCred.mockResolvedValue({
      businessId: 1,
      authTokenEncrypted: "enc",
    });
    mockForBusiness.getContactByPhoneNumber = vi
      .fn()
      .mockResolvedValue(undefined);
    mockForBusiness.createContact = vi.fn().mockResolvedValue({ id: 2 });
    const saved = {
      id: 5,
      phoneNumber: "+15551234567",
      contactId: 2,
      content: "hello",
      status: "received",
    };
    mockForBusiness.createMessage = vi.fn().mockResolvedValue(saved);

    const app = await setupApp();

    const res = await request(app)
      .post("/webhooks/twilio-inbound")
      .set("x-twilio-signature", "sig")
      .send({
        AccountSid: "AC123",
        From: "+15551234567",
        To: "+15550001111",
        Body: "hello",
      });

    expect(res.status).toBe(200);
    expect(mockForBusiness.createContact).toHaveBeenCalled();
    expect(mockForBusiness.createMessage).toHaveBeenCalledWith({
      phoneNumber: "+15551234567",
      contactId: 2,
      content: "hello",
      status: "received",
    });
    expect(mockBroadcast).toHaveBeenCalledWith("message:send", saved);
  });
});

describe("Multi-tenant isolation", () => {
  it("returns only contacts for the authenticated business", async () => {
    // Mock different users for different businesses
    mockStorage.getUserByClerkId
      .mockResolvedValueOnce({ id: 1, businessId: 1 })
      .mockResolvedValueOnce({ id: 2, businessId: 2 });

    const biz1 = {
      getContacts: vi.fn().mockResolvedValue([{ id: 1, firstName: "A" }]),
    };
    const biz2 = {
      getContacts: vi.fn().mockResolvedValue([{ id: 2, firstName: "B" }]),
    };

    mockStorage.forBusiness.mockReturnValueOnce(biz1).mockReturnValueOnce(biz2);

    const app1 = await setupApp({ businessId: 1 });
    const app2 = await setupApp({ businessId: 2 });

    const res1 = await request(app1).get("/api/contacts");
    const res2 = await request(app2).get("/api/contacts");

    expect(res1.body).toEqual([{ id: 1, firstName: "A" }]);
    expect(res2.body).toEqual([{ id: 2, firstName: "B" }]);
  });

  it("returns only campaigns for the authenticated business", async () => {
    // Mock different users for different businesses
    mockStorage.getUserByClerkId
      .mockResolvedValueOnce({ id: 1, businessId: 1 })
      .mockResolvedValueOnce({ id: 2, businessId: 2 });

    const biz1 = {
      getCampaigns: vi.fn().mockResolvedValue([{ id: 1, name: "C1" }]),
    };
    const biz2 = {
      getCampaigns: vi.fn().mockResolvedValue([{ id: 2, name: "C2" }]),
    };

    mockStorage.forBusiness.mockReturnValueOnce(biz1).mockReturnValueOnce(biz2);

    const app1 = await setupApp({ businessId: 1 });
    const app2 = await setupApp({ businessId: 2 });

    const res1 = await request(app1).get("/api/campaigns");
    const res2 = await request(app2).get("/api/campaigns");

    expect(res1.body).toEqual([{ id: 1, name: "C1" }]);
    expect(res2.body).toEqual([{ id: 2, name: "C2" }]);
  });

  it("returns only coupons for the authenticated business", async () => {
    // Mock different users for different businesses
    const businessMocks2: Record<number, any> = {};
    mockStorage.forBusiness.mockImplementation((businessId: number) => {
      if (!businessMocks2[businessId]) {
        businessMocks2[businessId] = {
          getCoupons: vi
            .fn()
            .mockResolvedValue([{ id: businessId, code: `X${businessId}` }]),
          searchCoupons: vi
            .fn()
            .mockResolvedValue([{ id: businessId, code: `X${businessId}` }]),
          getContacts: vi.fn(),
          getCampaigns: vi.fn(),
          getDashboardStats: vi.fn(),
          getCredits: vi.fn(),
          adjustCredits: vi.fn(),
          createUser: vi
            .fn()
            .mockImplementation(() =>
              Promise.resolve({ id: businessId, businessId })
            ),
          createContact: vi.fn(),
        };
      }
      return businessMocks2[businessId];
    });

    // Reset and set up mocks specifically for this test
    mockStorage.getUserByClerkId.mockReset();
    mockStorage.createBusiness.mockReset();

    // Map userId to businessId
    const userMap = {
      user1: { id: 1, businessId: 1 },
      user2: { id: 2, businessId: 2 },
    };
    mockStorage.getUserByClerkId.mockImplementation((clerkId) => {
      return Promise.resolve(userMap[clerkId]);
    });
    mockStorage.createBusiness
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ id: 2 });

    const app1 = await setupApp({ userId: "user1", businessId: 1 });
    const app2 = await setupApp({ userId: "user2", businessId: 2 });

    const res1 = await request(app1).get("/api/coupons");
    const res2 = await request(app2).get("/api/coupons");

    expect(res1.body).toEqual([{ id: 1, code: "X1" }]);
    expect(res2.body).toEqual([{ id: 2, code: "X2" }]);
  });

  it("returns stats for the authenticated business only", async () => {
    // Mock different users for different businesses
    mockStorage.getUserByClerkId
      .mockResolvedValueOnce({ id: 1, businessId: 1 })
      .mockResolvedValueOnce({ id: 2, businessId: 2 });

    const biz1 = {
      getDashboardStats: vi.fn().mockResolvedValue({ totalContacts: 1 }),
    };
    const biz2 = {
      getDashboardStats: vi.fn().mockResolvedValue({ totalContacts: 5 }),
    };

    mockStorage.forBusiness.mockReturnValueOnce(biz1).mockReturnValueOnce(biz2);

    const app1 = await setupApp({ businessId: 1 });
    const app2 = await setupApp({ businessId: 2 });

    const res1 = await request(app1).get("/api/dashboard/stats");
    const res2 = await request(app2).get("/api/dashboard/stats");

    expect(res1.body.totalContacts).toBe(1);
    expect(res2.body.totalContacts).toBe(5);
  });
});

describe("Credit Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock a user with businessId
    mockStorage.getUserByClerkId.mockResolvedValue({
      id: 1,
      businessId: 1,
      clerkId: "clerk_user_123",
    });
  });

  describe("GET /api/credits", () => {
    it("returns credit balance when credits exist", async () => {
      mockForBusiness.getCredits = vi.fn().mockResolvedValue({ balance: 150 });

      const app = await setupApp({ id: 1, businessId: 1 });
      const res = await request(app).get("/api/credits");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ balance: 150 });
      expect(mockStorage.forBusiness).toHaveBeenCalledWith(1);
      expect(mockForBusiness.getCredits).toHaveBeenCalled();
    });

    it("returns 0 balance when no credits record exists", async () => {
      mockForBusiness.getCredits = vi.fn().mockResolvedValue(undefined);

      const app = await setupApp({ id: 1, businessId: 1 });
      const res = await request(app).get("/api/credits");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ balance: 0 });
      expect(mockStorage.forBusiness).toHaveBeenCalledWith(1);
      expect(mockForBusiness.getCredits).toHaveBeenCalled();
    });

    it("returns 500 on storage error", async () => {
      mockForBusiness.getCredits = vi
        .fn()
        .mockRejectedValue(new Error("Database error"));

      const app = await setupApp({ id: 1, businessId: 1 });
      const res = await request(app).get("/api/credits");

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Failed to fetch credits");
    });

    it("returns 302 when user is not authenticated", async () => {
      const app = await setupApp();
      const res = await request(app).get("/api/credits");

      expect(res.status).toBe(302); // Redirect to sign-in
    });
  });

  describe("POST /api/credits/checkout", () => {
    it("returns a Stripe session URL on success", async () => {
      mockForBusiness.getBusiness = vi
        .fn()
        .mockResolvedValue({ plan: "starter" });
      const app = await setupApp({ id: 1, businessId: 1 });
      const res = await request(app).post("/api/credits/checkout").send({
        amount: 50,
        successUrl: "https://success",
        cancelUrl: "https://cancel",
      });
      expect(res.status).toBe(200);
      expect(res.body.url).toBe("https://stripe.test/session");
    });

    it("returns 400 if missing amount field", async () => {
      const app = await setupApp({ id: 1, businessId: 1 });
      const res = await request(app)
        .post("/api/credits/checkout")
        .send({ successUrl: "https://success", cancelUrl: "https://cancel" });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Missing required fields");
    });

    it("returns 400 if missing successUrl field", async () => {
      const app = await setupApp({ id: 1, businessId: 1 });
      const res = await request(app)
        .post("/api/credits/checkout")
        .send({ amount: 50, cancelUrl: "https://cancel" });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Missing required fields");
    });

    it("returns 400 if missing cancelUrl field", async () => {
      const app = await setupApp({ id: 1, businessId: 1 });
      const res = await request(app)
        .post("/api/credits/checkout")
        .send({ amount: 50, successUrl: "https://success" });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Missing required fields");
    });

    it("returns 302 when user is not authenticated", async () => {
      const app = await setupApp();
      const res = await request(app).post("/api/credits/checkout").send({
        amount: 50,
        successUrl: "https://success",
        cancelUrl: "https://cancel",
      });
      expect(res.status).toBe(302); // Redirect to sign-in
    });
  });

  describe("POST /api/webhooks/stripe", () => {
    it("returns 200 and adjusts credits on valid checkout.session.completed webhook", async () => {
      mockForBusiness.adjustCredits = vi.fn().mockResolvedValue(undefined);
      mockForBusiness.getCreditTransactions = vi.fn().mockResolvedValue([]);

      const app = await setupApp();
      const res = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "valid")
        .send(Buffer.from("{}"));

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
      expect(mockStorage.forBusiness).toHaveBeenCalledWith(1);
      expect(mockForBusiness.adjustCredits).toHaveBeenCalledWith(
        50,
        "purchase",
        "Stripe purchase",
        {
          stripeSessionId: "sess_123",
          amountPaid: 50,
          currency: "usd",
        }
      );
    });

    it("returns 500 but handles credit adjustment errors gracefully", async () => {
      mockForBusiness.adjustCredits = vi
        .fn()
        .mockRejectedValue(new Error("Database error"));
      mockForBusiness.getCreditTransactions = vi.fn().mockResolvedValue([]);

      const app = await setupApp();
      const res = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "valid")
        .send(Buffer.from("{}"));

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to process payment");
      expect(mockForBusiness.adjustCredits).toHaveBeenCalled();
    });

    it("returns 400 on invalid signature", async () => {
      const app = await setupApp();
      const res = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "invalid")
        .send(Buffer.from("{}"));
      expect(res.status).toBe(400);
      expect(res.text).toContain("Webhook Error");
    });

    it("returns 400 when stripe-signature header is missing", async () => {
      const app = await setupApp();
      const res = await request(app)
        .post("/api/webhooks/stripe")
        .send(Buffer.from("{}"));
      expect(res.status).toBe(400);
      expect(res.text).toContain("Webhook Error");
    });
  });
});
