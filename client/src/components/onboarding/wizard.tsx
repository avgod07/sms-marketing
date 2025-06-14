import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import BusinessInfoStep, { type BusinessInfoData } from "./business-info-step";
import TwilioStep from "./twilio-step";
import PhoneNumberStep from "./phone-number-step";
import ConfirmationStep from "./confirmation-step";

export interface OnboardingData extends BusinessInfoData {}

interface WizardProps {
  onComplete: () => void;
}

const totalSteps = 4;

export default function OnboardingWizard({ onComplete }: WizardProps) {
  const [step, setStep] = useState(() => {
    const saved = localStorage.getItem("onboardingStep");
    return saved ? Number(saved) : 1;
  });

  const [data, setData] = useState<OnboardingData>(() => {
    const saved = localStorage.getItem("onboardingData");
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem("onboardingStep", String(step));
  }, [step]);

  useEffect(() => {
    localStorage.setItem("onboardingData", JSON.stringify(data));
  }, [data]);

  const updateData = useCallback(
    (updates: Partial<OnboardingData>) =>
      setData((d) => ({ ...d, ...updates })),
    [],
  );

  const nextDisabled =
    (step === 1 && !data.businessName) || step > totalSteps;

  const handleNext = () => {
    if (step === totalSteps) {
      localStorage.setItem("onboardingComplete", "true");
      localStorage.removeItem("onboardingStep");
      localStorage.removeItem("onboardingData");
      onComplete();
    } else {
      setStep((s) => Math.min(totalSteps, s + 1));
    }
  };

  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  let content: JSX.Element;
  switch (step) {
    case 1:
      content = <BusinessInfoStep data={data} onChange={updateData} />;
      break;
    case 2:
      content = <TwilioStep />;
      break;
    case 3:
      content = <PhoneNumberStep />;
      break;
    default:
      content = <ConfirmationStep />;
  }

  return (
    <div className="p-8 max-w-md mx-auto space-y-6 fade-in">
      <div>
        <p className="text-sm font-medium mb-2">Step {step} of {totalSteps}</p>
        <Progress value={(step / totalSteps) * 100} />
      </div>
      {content}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={handleBack} disabled={step === 1}>
          Back
        </Button>
        <Button onClick={handleNext} disabled={nextDisabled}>
          {step === totalSteps ? "Finish" : "Next"}
        </Button>
      </div>
    </div>
  );
}
