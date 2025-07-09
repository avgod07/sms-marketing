import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useOnboardingProgress, useSaveOnboardingProgress } from "@/hooks/useOnboardingProgress";
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
  saveProgress: () => Promise<void>;
  isLoading: boolean;
  isSaving: boolean;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState(1);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfoFormValues | undefined>();
  const [monthlyVolume, setMonthlyVolume] = useState<VolumeOption>("Less than 1K");
  const [useCases, setUseCases] = useState<UseCaseOption[]>([]);
  
  // Track if we're in the middle of a user-initiated step change
  const isUserChangingStep = useRef(false);
  const hasInitialized = useRef(false);

  // Load saved progress
  const { data: savedProgress, isLoading } = useOnboardingProgress();
  const saveProgressMutation = useSaveOnboardingProgress();

  // Initialize state from saved progress (only on first load)
  useEffect(() => {
    if (savedProgress && !isLoading && !hasInitialized.current) {
      hasInitialized.current = true;
      setStep(savedProgress.step);
      if (savedProgress.businessInfo) {
        setBusinessInfo(savedProgress.businessInfo);
      }
      if (savedProgress.monthlyVolume) {
        setMonthlyVolume(savedProgress.monthlyVolume);
      }
      if (savedProgress.useCases) {
        setUseCases(savedProgress.useCases);
      }
    }
  }, [savedProgress, isLoading]);

  const saveProgress = useCallback(async () => {
    await saveProgressMutation.mutateAsync({
      step,
      businessInfo,
      monthlyVolume,
      useCases,
    });
  }, [step, businessInfo, monthlyVolume, useCases, saveProgressMutation]);

  const handleSetStep = useCallback((newStep: number) => {
    isUserChangingStep.current = true;
    setStep(newStep);
    // Reset the flag after a short delay to allow for any async operations
    setTimeout(() => {
      isUserChangingStep.current = false;
    }, 100);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        step,
        setStep: handleSetStep,
        businessInfo,
        setBusinessInfo,
        monthlyVolume,
        setMonthlyVolume,
        useCases,
        setUseCases,
        saveProgress,
        isLoading,
        isSaving: saveProgressMutation.isPending,
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
