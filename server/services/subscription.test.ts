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
            expect(lineItem.price_data.unit_amount).toBe(2000); // $20.00
            expect(lineItem.price_data.recurring.interval).toBe("month");
          } else if (params.metadata?.billingCycle === "yearly") {
            expect(lineItem.price_data.unit_amount).toBe(18000); // $180.00
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
});
