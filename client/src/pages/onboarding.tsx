import BusinessInfoForm from "@/components/onboarding/business-info-form";
import MonthlyVolumeForm from "@/components/onboarding/monthly-volume-form";
import UseCaseForm from "@/components/onboarding/use-case-form";
import TollFreeNumberForm from "@/components/onboarding/toll-free-number-form";
import StepIndicator from "@/components/onboarding/step-indicator";
import { OnboardingProvider, useOnboarding } from "@/components/onboarding/onboarding-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

const steps = [
  "Business Info",
  "Monthly Volume",
  "SMS Use Cases",
  "Toll-Free Number",
];

function Content() {
  const {
    step,
    setStep,
    businessInfo,
    setBusinessInfo,
    monthlyVolume,
    setMonthlyVolume,
    useCases,
    setUseCases,
  } = useOnboarding();
  const [, navigate] = useLocation();

  const handleClose = () => navigate("/");

  return (
    <div className="fade-in">
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
            <p className="text-gray-600 mt-1">Let's set up your account.</p>
          </div>
        </div>
      </header>

      <div className="p-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <StepIndicator current={step} steps={steps} />
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 1 && (
              <BusinessInfoForm
                initialValues={businessInfo}
                onSubmit={(data) => {
                  setBusinessInfo(data);
                  setStep(2);
                }}
                onCancel={handleClose}
              />
            )}
            {step === 2 && (
              <MonthlyVolumeForm
                initialValues={{ volume: monthlyVolume }}
                onSubmit={(data) => {
                  setMonthlyVolume(data.volume);
                  setStep(3);
                }}
                onBack={() => setStep(1)}
                onCancel={handleClose}
              />
            )}
            {step === 3 && (
              <UseCaseForm
                initialValues={{ useCases }}
                onSubmit={(data) => {
                  setUseCases(data.useCases);
                  setStep(4);
                }}
                onBack={() => setStep(2)}
                onCancel={handleClose}
              />
            )}
            {step === 4 && (
              <TollFreeNumberForm
                onSuccess={() => navigate("/")}
                onBack={() => setStep(3)}
                onCancel={handleClose}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <OnboardingProvider>
      <Content />
    </OnboardingProvider>
  );
}
