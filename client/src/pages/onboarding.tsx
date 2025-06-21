import { useEffect } from "react";
import { useLocation } from "wouter";
import { useSetupStatus } from "@/hooks/use-setup-status";

export default function OnboardingPage() {
  const { data: setup, isLoading } = useSetupStatus();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && setup) {
      if (!setup.phoneConfigured) {
        navigate("/settings");
      } else if (!setup.hasContacts) {
        navigate("/contacts");
      } else if (!setup.hasCoupons) {
        navigate("/coupons");
      } else {
        navigate("/");
      }
    }
  }, [isLoading, setup, navigate]);

  return (
    <div className="flex items-center justify-center h-full p-6">
      <p className="text-sm text-gray-600">Loading...</p>
    </div>
  );
}
