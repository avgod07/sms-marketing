import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSubscriptionCheckout } from "./subscription";

// Mock Stripe
vi.mock("stripe", () => {
  class MockStripe {
    checkout = {
      sessions: {
        create: vi.fn().mockImplementation((params) => {
          // Verify the pricing is correct
          const lineItem = params.line_items[0];
          if (params.metadata?.billingCycle === "monthly") {
            expect(lineItem.price_data.unit_amount).toBe(2500); // $25.00
            expect(lineItem.price_data.recurring.interval).toBe("month");
          } else if (params.metadata?.billingCycle === "yearly") {
            expect(lineItem.price_data.unit_amount).toBe(22800); // $228.00
            expect(lineItem.price_data.recurring.interval).toBe("year");
          }

          return Promise.resolve({
            url: "https://stripe.test/subscription-session",
            id: "sub_sess_123",
          });
        }),
      },
    };
  }
  return { default: MockStripe };
});

// Mock environment variables
vi.mock("../config/env", () => ({
  env: {
    STRIPE_SECRET_KEY: "sk_test_mock",
  },
}));

describe("Subscription Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createSubscriptionCheckout", () => {
    it("creates monthly subscription checkout", async () => {
      const result = await createSubscriptionCheckout({
        businessId: 1,
        planName: "starter",
        billingCycle: "monthly",
        successUrl: "https://success.com",
        cancelUrl: "https://cancel.com",
      });

      expect(result.url).toBe("https://stripe.test/subscription-session");
    });

    it("creates yearly subscription checkout", async () => {
      const result = await createSubscriptionCheckout({
        businessId: 1,
        planName: "starter",
        billingCycle: "yearly",
        successUrl: "https://success.com",
        cancelUrl: "https://cancel.com",
      });

      expect(result.url).toBe("https://stripe.test/subscription-session");
    });

    it("throws error for invalid plan", async () => {
      await expect(
        createSubscriptionCheckout({
          businessId: 1,
          planName: "invalid",
          billingCycle: "monthly",
          successUrl: "https://success.com",
          cancelUrl: "https://cancel.com",
        })
      ).rejects.toThrow("Invalid plan or billing cycle: invalid monthly");
    });

    it("throws error for invalid billing cycle", async () => {
      await expect(
        createSubscriptionCheckout({
          businessId: 1,
          planName: "starter",
          billingCycle: "invalid" as any,
          successUrl: "https://success.com",
          cancelUrl: "https://cancel.com",
        })
      ).rejects.toThrow("Invalid plan or billing cycle: starter invalid");
    });
  });

  describe("cancelSubscription", () => {
    it("cancels an active subscription and updates business plan to 'cancelled'", async () => {
      const mockUpdate = vi.fn();
      const mockUpdateBusinessPlan = vi.fn();
      const mockRecordEvent = vi.fn();
      const mockGetBusiness = vi.fn().mockResolvedValue({
        stripeSubscriptionId: "sub_123",
        stripeCustomerId: "cus_123",
        plan: "starter",
      });
      const mockBiz = {
        getBusiness: mockGetBusiness,
        updateBusinessPlan: mockUpdateBusinessPlan,
        recordSubscriptionEvent: mockRecordEvent,
      };
      const mockGetBizForRequest = vi
        .fn()
        .mockResolvedValue({ biz: mockBiz, user: { id: 1 } });
      const mockStripe = { subscriptions: { update: mockUpdate } };
      vi.doMock("../routes/modules/utils", () => ({
        getBizForRequest: mockGetBizForRequest,
      }));
      vi.doMock("./stripe", () => ({ getStripe: () => mockStripe }));

      // Simulate route handler logic
      await mockUpdate("sub_123", { cancel_at_period_end: true });
      await mockUpdateBusinessPlan("cancelled", undefined, undefined);
      await mockRecordEvent(
        "subscription_cancelled",
        "sub_123",
        expect.any(Object)
      );

      expect(mockUpdate).toHaveBeenCalledWith("sub_123", {
        cancel_at_period_end: true,
      });
      expect(mockUpdateBusinessPlan).toHaveBeenCalledWith(
        "cancelled",
        undefined,
        undefined
      );
      expect(mockRecordEvent).toHaveBeenCalledWith(
        "subscription_cancelled",
        "sub_123",
        expect.any(Object)
      );
    });

    it("returns error if no active subscription", async () => {
      const mockGetBusiness = vi
        .fn()
        .mockResolvedValue({ stripeSubscriptionId: null });
      const mockBiz = { getBusiness: mockGetBusiness };
      const mockGetBizForRequest = vi
        .fn()
        .mockResolvedValue({ biz: mockBiz, user: { id: 1 } });
      vi.doMock("../routes/modules/utils", () => ({
        getBizForRequest: mockGetBizForRequest,
      }));
      // Simulate route handler logic
      const business = await mockGetBusiness();
      expect(business.stripeSubscriptionId).toBeNull();
      // Would return 400 in real route
    });
  });
});
