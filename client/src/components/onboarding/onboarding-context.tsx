import React, { createContext, useContext, useState, useEffect } from "react";
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
  clearProgress: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

const STORAGE_KEY = "onboardingProgress";

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState(1);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfoFormValues | undefined>();
  const [monthlyVolume, setMonthlyVolume] = useState<VolumeOption>("Less than 1K");
  const [useCases, setUseCases] = useState<UseCaseOption[]>([]);

  // Load saved progress on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.step) setStep(data.step);
        if (data.businessInfo) setBusinessInfo(data.businessInfo);
        if (data.monthlyVolume) setMonthlyVolume(data.monthlyVolume);
        if (data.useCases) setUseCases(data.useCases);
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  // Persist progress whenever state changes
  useEffect(() => {
    const payload = {
      step,
      businessInfo,
      monthlyVolume,
      useCases,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [step, businessInfo, monthlyVolume, useCases]);

  const clearProgress = () => localStorage.removeItem(STORAGE_KEY);

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
        clearProgress,
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
