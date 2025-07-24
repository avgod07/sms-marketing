import BusinessInfoForm from "@/components/onboarding/business-info-form";
import MonthlyVolumeForm from "@/components/onboarding/monthly-volume-form";
import UseCaseForm from "@/components/onboarding/use-case-form";
import TollFreeNumberForm from "@/components/onboarding/toll-free-number-form";
import InitialMessageForm from "@/components/onboarding/initial-message-form";
import StepIndicator from "@/components/onboarding/step-indicator";
import { OnboardingProvider, useOnboarding } from "@/components/onboarding/onboarding-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const steps = [
  "Business Info",
  "Monthly Volume",
  "SMS Use Cases",
  "Auto-Welcome Message",
  "Toll-Free Number",
];

function Content() {
  const queryClient = useQueryClient();
  
  const {
    step,
    setStep,
    businessInfo,
    setBusinessInfo,
    monthlyVolume,
    setMonthlyVolume,
    useCases,
    setUseCases,
    initialMessage,
    setInitialMessage,
    saveProgress,
    completeOnboarding,
    isLoading,
    isSaving,
    isCompleting,
  } = useOnboarding();
  const [, navigate] = useLocation();

  const handleClose = async () => {
    try {
      await saveProgress();
      navigate("/");
    } catch (error) {
      console.error("Failed to save progress:", error);
      // Still navigate away even if save fails
      navigate("/");
    }
  };

  const handleStepChange = async (newStep: number) => {
    try {
      await saveProgress();
      setStep(newStep);
    } catch (error) {
      console.error("Failed to save progress:", error);
      // Still change step even if save fails
      setStep(newStep);
    }
  };

  const handleBack = (newStep: number) => {
    // For back navigation, change step immediately and save in background
    setStep(newStep);
    // Save progress in background without waiting
    saveProgress().catch((error) => {
      console.error("Failed to save progress on back navigation:", error);
    });
  };

  const handleCompleteOnboarding = async (data?: { initialMessage: string }) => {
    try {
      if (data) {
        // If initial message data is provided, use it
        await completeOnboarding(data);
      } else {
        // If no data provided, use the saved initial message
        if (!initialMessage?.initialMessage) {
          throw new Error("No initial message found");
        }
        await completeOnboarding(initialMessage);
      }
      navigate("/");
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
    }
  };

  if (isLoading) {
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
            <CardContent className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Loading your progress...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
            <p className="text-gray-600 mt-1">Let's set up your account.</p>
          </div>
          {(isSaving || isCompleting) && (
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{isCompleting ? "Completing..." : "Saving..."}</span>
            </div>
          )}
        </div>
      </header>

      <div className="p-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <StepIndicator current={step} steps={steps} />
          </CardHeader>
          <CardContent>
            {step === 1 && (
              <BusinessInfoForm
                initialValues={businessInfo}
                onSubmit={async (data) => {
                  setBusinessInfo(data);
                  await saveProgress();
                  handleStepChange(2);
                }}
                isSaving={isSaving}
              />
            )}
            {step === 2 && (
              <MonthlyVolumeForm
                initialValues={{ volume: monthlyVolume }}
                onSubmit={async (data) => {
                  setMonthlyVolume(data.volume);
                  await saveProgress();
                  handleStepChange(3);
                }}
                onBack={() => handleBack(1)}
                isSaving={isSaving}
              />
            )}
            {step === 3 && (
              <UseCaseForm
                initialValues={{ useCases }}
                onSubmit={async (data) => {
                  setUseCases(data.useCases);
                  await saveProgress();
                  handleStepChange(4);
                }}
                onBack={() => handleBack(2)}
                isSaving={isSaving}
              />
            )}
            {step === 4 && (
              <InitialMessageForm
                initialValues={initialMessage}
                onSubmit={async (data) => {
                  setInitialMessage(data);
                  await saveProgress();
                  handleStepChange(5);
                }}
                onBack={() => handleBack(3)}
                isSaving={isSaving}
              />
            )}
            {step === 5 && (
              <TollFreeNumberForm
                onSuccess={() => handleCompleteOnboarding()}
                onBack={() => handleBack(4)}
                isSaving={isCompleting}
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
