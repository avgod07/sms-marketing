import React, { createContext, useContext, useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
  saveProgress: (data: Partial<{
    step: number;
    businessInfo: BusinessInfoFormValues;
    monthlyVolume: VolumeOption;
    useCases: UseCaseOption[];
  }>) => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState(1);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfoFormValues | undefined>();
  const [monthlyVolume, setMonthlyVolume] = useState<VolumeOption>("Less than 1K");
  const [useCases, setUseCases] = useState<UseCaseOption[]>([]);

  const { data } = useQuery<{ step: number; businessInfo?: BusinessInfoFormValues; monthlyVolume?: VolumeOption; useCases?: UseCaseOption[] }>(
    { queryKey: ["/api/onboarding/progress"] }
  );

  useEffect(() => {
    if (data) {
      setStep(data.step || 1);
      if (data.businessInfo) setBusinessInfo(data.businessInfo);
      if (data.monthlyVolume) setMonthlyVolume(data.monthlyVolume);
      if (data.useCases) setUseCases(data.useCases);
    }
  }, [data]);

  const { mutateAsync } = useMutation({
    mutationFn: (payload: any) =>
      apiRequest({ method: "POST", url: "/api/onboarding/save-progress", data: payload }),
  });

  async function saveProgress(payload: any) {
    await mutateAsync(payload);
  }

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
        saveProgress,
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
