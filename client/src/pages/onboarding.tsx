import { useLocation } from "wouter";
import OnboardingWizard from "@/components/onboarding/wizard";

export default function OnboardingPage() {
  const [, navigate] = useLocation();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <OnboardingWizard onComplete={() => navigate("/")} />
    </div>
  );
}
