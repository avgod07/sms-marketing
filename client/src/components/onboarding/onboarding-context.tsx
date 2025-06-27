import React, { createContext, useContext, useState } from "react";
import type { BusinessInfoFormValues } from "./business-info-form";
import type { VolumeOption } from "./monthly-volume-form";
import type { UseCaseOption } from "./use-case-form";

interface OnboardingContextValue {
  step: number;
  setStep: (step: number) => void;
  businessInfo?: BusinessInfoFormValues;
  setBusinessInfo: (data: BusinessInfoFormValues) => void;
  monthlyVolume: VolumeOption;
  setMonthlyVolume: (v: VolumeOption) => void;
  useCases: UseCaseOption[];
  setUseCases: (u: UseCaseOption[]) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState(1);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfoFormValues | undefined>();
  const [monthlyVolume, setMonthlyVolume] = useState<VolumeOption>("Less than 1K");
  const [useCases, setUseCases] = useState<UseCaseOption[]>([]);

  return (
    <OnboardingContext.Provider
      value={{
        step,
        setStep,
        businessInfo,
        setBusinessInfo,
        monthlyVolume,
        setMonthlyVolume,
        useCases,
        setUseCases,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
