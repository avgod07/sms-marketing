import React, { createContext, useContext, useState } from "react";
import type { BusinessInfoFormValues } from "./business-info-form";

interface OnboardingContextValue {
  step: number;
  setStep: (step: number) => void;
  businessInfo?: BusinessInfoFormValues;
  setBusinessInfo: (data: BusinessInfoFormValues) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState(1);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfoFormValues | undefined>();

  return (
    <OnboardingContext.Provider value={{ step, setStep, businessInfo, setBusinessInfo }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
