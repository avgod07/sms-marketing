import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import BusinessInfoStep, { type BusinessInfoData } from "./business-info-step";
import TwilioStep from "./twilio-step";
import PhoneNumberStep from "./phone-number-step";
import ConfirmationStep from "./confirmation-step";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface OnboardingData extends BusinessInfoData {}

const profileSchema = z.object({
  businessName: z.string().min(1),
  addressStreet: z.string().min(1),
  addressCity: z.string().min(1),
  addressState: z.string().min(1),
  addressPostalCode: z.string().min(1),
  addressCountry: z.string().min(1),
  organizationType: z.string().min(1),
  companyStatus: z.string().min(1),
  stockTicker: z.string().optional(),
  taxId: z.string().min(1),
  industrySector: z.string().min(1),
  regionsOfOperation: z.string().min(1),
  repName: z.string().min(1),
  repTitle: z.string().min(1),
  repEmail: z.string().email(),
  repPhone: z.string().regex(/^\+?[0-9]{7,15}$/),
  useCase: z.string().min(1),
  campaignDescription: z.string().min(1),
  sample1: z.string().min(1),
  sample2: z.string().min(1),
});

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

  const [twilioConnected, setTwilioConnected] = useState(() => {
    return localStorage.getItem("twilioConnected") === "true";
  });

  const [numbersConfigured, setNumbersConfigured] = useState(() => {
    return localStorage.getItem("numbersConfigured") === "true";
  });

  const [errors, setErrors] = useState<
    Partial<Record<keyof OnboardingData, string[]>>
  >({});
  const { toast } = useToast();

  const saveProfile = useMutation({
    mutationFn: (payload: OnboardingData) =>
      apiRequest({ method: "POST", url: "/api/business-profile", data: payload }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/business-profile"] });
      setStep(2);
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to save profile",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    localStorage.setItem("onboardingStep", String(step));
  }, [step]);

  useEffect(() => {
    localStorage.setItem("onboardingData", JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem("twilioConnected", String(twilioConnected));
  }, [twilioConnected]);

  useEffect(() => {
    localStorage.setItem("numbersConfigured", String(numbersConfigured));
  }, [numbersConfigured]);

  const updateData = useCallback(
    (updates: Partial<OnboardingData>) =>
      setData((d) => ({ ...d, ...updates })),
    [],
  );

  const nextDisabled =
    (step === 1 && !profileSchema.safeParse(data).success) ||
    (step === 2 && !twilioConnected) ||
    (step === 3 && !numbersConfigured) ||
    step > totalSteps;

  const handleNext = () => {
    if (step === 1) {
      const result = profileSchema.safeParse(data);
      if (!result.success) {
        setErrors(result.error.formErrors.fieldErrors as any);
        return;
      }
      setErrors({});
      saveProfile.mutate(data);
      return;
    }

    if (step === totalSteps) {
      localStorage.setItem("onboardingComplete", "true");
      localStorage.removeItem("onboardingStep");
      localStorage.removeItem("onboardingData");
      localStorage.removeItem("twilioConnected");
      localStorage.removeItem("numbersConfigured");
      onComplete();
    } else {
      setStep((s) => Math.min(totalSteps, s + 1));
    }
  };

  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  let content: JSX.Element;
  switch (step) {
    case 1:
      content = (
        <BusinessInfoStep data={data} onChange={updateData} errors={errors} />
      );
      break;
    case 2:
      content = <TwilioStep onSuccess={() => setTwilioConnected(true)} />;
      break;
    case 3:
      content = <PhoneNumberStep onSuccess={() => setNumbersConfigured(true)} />;
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
