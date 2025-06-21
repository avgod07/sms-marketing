import BusinessInfoForm from "@/components/onboarding/business-info-form";
import MonthlyVolumeForm from "@/components/onboarding/monthly-volume-form";
import UseCaseForm from "@/components/onboarding/use-case-form";
import StepIndicator from "@/components/onboarding/step-indicator";
import { OnboardingProvider, useOnboarding } from "@/components/onboarding/onboarding-context";

const steps = [
  "Business Info",
  "Twilio Setup",
  "SMS Use Cases",
  "Import Contacts",
  "Complete",
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

  return (
    <div className="p-8 fade-in">
      <h1 className="text-2xl font-bold mb-6">Onboarding</h1>
      <StepIndicator current={step} steps={steps} />
      {step === 1 && (
        <BusinessInfoForm
          initialValues={businessInfo}
          onSubmit={(data) => {
            setBusinessInfo(data);
            setStep(2);
          }}
        />
      )}
      {step === 2 && (
        <MonthlyVolumeForm
          initialValues={{ volume: monthlyVolume }}
          onSubmit={(data) => {
            setMonthlyVolume(data.volume);
            setStep(3);
          }}
        />
      )}
      {step === 3 && (
        <UseCaseForm
          initialValues={{ useCases }}
          onSubmit={(data) => {
            setUseCases(data.useCases);
            setStep(4);
          }}
        />
      )}
      {step > 3 && (
        <div className="max-w-xl mx-auto text-center text-gray-600">
          <p className="mt-8">Next steps coming soon...</p>
        </div>
      )}
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
