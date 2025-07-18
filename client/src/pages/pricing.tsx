import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowLeft, CreditCard } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { apiRequest } from "@/lib/queryClient";

// You may want to import your CreditsBanner component if it's reusable
// import CreditsBanner from "@/components/CreditsBanner";

const STARTER_FEATURES = [
  "Send bulk SMS campaigns",
  "Direct messages & inbox",
  "Contact list segmentation",
  "Human support based in the USA",
];

export default function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const { data: subscription } = useSubscription();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [, navigate] = useLocation();

  const isCurrentPlan = subscription?.plan === "starter";

  const annualPrice = 180;
  const monthlyPrice = 20;
  const effectiveMonthly = 15;
  const annualSavings = 25; // percent

  const price = billing === "monthly" ? 20 : 180;
  const priceLabel = billing === "monthly" ? "$20/mo" : "$180/year ($15/mo)";

  const handleUpgrade = async () => {
    setIsUpgrading(true);
    try {
      const response = await apiRequest({
        method: "POST",
        url: "/api/subscriptions/checkout",
        data: {
          planName: "starter",
          billingCycle: billing,
          successUrl: `${window.location.origin}/subscription-success`,
          cancelUrl: `${window.location.origin}/pricing`,
        },
      });
      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      alert("Failed to start upgrade. Please try again or contact support.");
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full mt-12">
      <div className="w-full max-w-2xl mx-auto bg-white rounded-xl shadow p-8">
        <button
          className="flex items-center text-gray-500 hover:text-primary mb-6"
          onClick={() => navigate("/settings?tab=billing")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to billing
        </button>

        <h1 className="text-3xl font-bold mb-2 text-gray-900 text-center">Simple, affordable pricing</h1>
        <p className="text-gray-600 mb-6 text-center">
          Pick your plan and unlock the world's best messaging rates ($0.01 per SMS) with zero hidden fees.
        </p>

        <div className="flex items-center justify-center space-x-2 mb-8">
          <Button
            variant={billing === "monthly" ? "default" : "outline"}
            onClick={() => setBilling("monthly")}
          >
            Monthly
          </Button>
          <Button
            variant={billing === "yearly" ? "default" : "outline"}
            onClick={() => setBilling("yearly")}
          >
            Yearly
          </Button>
        </div>

        <div className="flex flex-col items-center">
          <Card className="w-full max-w-md mb-8">
            <CardHeader className="flex flex-col items-center">
              <CardTitle className="text-2xl font-bold flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-primary" /> Starter
              </CardTitle>
              <div className="mt-2 text-3xl font-extrabold text-gray-900">
                {billing === "monthly" ? "$20" : "$180"}
                <span className="text-lg font-medium text-gray-500 ml-1">
                  {billing === "monthly" ? "/mo" : "/year"}
                </span>
              </div>
              {billing === "yearly" && (
                <div className="text-green-600 text-sm font-semibold mt-1">$15/mo billed annually</div>
              )}
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 my-6">
                {STARTER_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-center text-gray-700">
                    <CheckCircle className="w-5 h-5 text-primary mr-2" /> {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full mt-2"
                onClick={handleUpgrade}
                disabled={isCurrentPlan || isUpgrading}
              >
                {isCurrentPlan ? "Current Plan" : isUpgrading ? "Processing..." : `Upgrade for ${priceLabel}`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 