import BusinessInfoForm from "@/components/onboarding/business-info-form";
import StepIndicator from "@/components/onboarding/step-indicator";
import { OnboardingProvider, useOnboarding } from "@/components/onboarding/onboarding-context";

const steps = [
  "Business Info",
  "Twilio Setup",
  "Import Contacts",
  "Complete",
];

function Content() {
  const { step, setStep, businessInfo, setBusinessInfo } = useOnboarding();

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
      {step > 1 && (
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
