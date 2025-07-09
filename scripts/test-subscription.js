#!/usr/bin/env node

/**
 * Test script for subscription endpoints
 * Run with: node scripts/test-subscription.js
 */

const BASE_URL = "http://localhost:5000";

async function testSubscriptionEndpoints() {
  console.log("🧪 Testing Subscription Endpoints...\n");

  try {
    // Test 1: Get current subscription (should work without auth for testing)
    console.log("1. Testing GET /api/subscriptions/current...");
    const currentResponse = await fetch(
      `${BASE_URL}/api/subscriptions/current`
    );
    console.log(`   Status: ${currentResponse.status}`);
    if (currentResponse.ok) {
      const data = await currentResponse.json();
      console.log(`   Response:`, data);
    } else {
      console.log(`   Error: ${currentResponse.statusText}`);
    }

    // Test 2: Get subscription plans
    console.log("\n2. Testing GET /api/subscriptions/plans...");
    const plansResponse = await fetch(`${BASE_URL}/api/subscriptions/plans`);
    console.log(`   Status: ${plansResponse.status}`);
    if (plansResponse.ok) {
      const data = await plansResponse.json();
      console.log(`   Response:`, data);
    } else {
      console.log(`   Error: ${plansResponse.statusText}`);
    }

    // Test 3: Test subscription checkout (should fail without auth)
    console.log("\n3. Testing POST /api/subscriptions/checkout...");
    const checkoutResponse = await fetch(
      `${BASE_URL}/api/subscriptions/checkout`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planName: "starter",
          billingCycle: "monthly",
          successUrl: "https://success.com",
          cancelUrl: "https://cancel.com",
        }),
      }
    );
    console.log(`   Status: ${checkoutResponse.status}`);
    if (checkoutResponse.ok) {
      const data = await checkoutResponse.json();
      console.log(`   Response:`, data);
    } else {
      console.log(`   Error: ${checkoutResponse.statusText}`);
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }

  console.log("\n✅ Subscription endpoint tests completed!");
}

// Run the tests
testSubscriptionEndpoints();
