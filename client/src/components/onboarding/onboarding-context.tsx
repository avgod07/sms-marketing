import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useOnboardingProgress, useSaveOnboardingProgress, useCompleteOnboarding } from "@/hooks/useOnboardingProgress";
import type { BusinessInfoFormValues } from "./business-info-form";
import type { VolumeOption } from "./monthly-volume-form";
import type { UseCaseOption } from "./use-case-form";
import type { InitialMessageFormValues } from "./initial-message-form";

interface OnboardingContextValue {
  step: number;
  setStep: (step: number) => void;
  businessInfo?: BusinessInfoFormValues;
  setBusinessInfo: (data: BusinessInfoFormValues) => void;
  monthlyVolume: VolumeOption;
  setMonthlyVolume: (v: VolumeOption) => void;
  useCases: UseCaseOption[];
  setUseCases: (u: UseCaseOption[]) => void;
  initialMessage?: InitialMessageFormValues;
  setInitialMessage: (data: InitialMessageFormValues) => void;
  saveProgress: () => Promise<void>;
  completeOnboarding: (data: InitialMessageFormValues) => Promise<void>;
  isLoading: boolean;
  isSaving: boolean;
  isCompleting: boolean;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState(1);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfoFormValues | undefined>();
  const [monthlyVolume, setMonthlyVolume] = useState<VolumeOption>("Less than 1K");
  const [useCases, setUseCases] = useState<UseCaseOption[]>([]);
  const [initialMessage, setInitialMessage] = useState<InitialMessageFormValues | undefined>();
  
  // Track if we're in the middle of a user-initiated step change
  const isUserChangingStep = useRef(false);
  const hasInitialized = useRef(false);

  // Load saved progress
  const { data: savedProgress, isLoading } = useOnboardingProgress();
  const saveProgressMutation = useSaveOnboardingProgress();
  const completeOnboardingMutation = useCompleteOnboarding();

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
      if (savedProgress.initialMessage) {
        setInitialMessage(savedProgress.initialMessage);
      }
    }
  }, [savedProgress, isLoading]);

  const saveProgress = useCallback(async () => {
    await saveProgressMutation.mutateAsync({
      step,
      businessInfo,
      monthlyVolume,
      useCases,
      initialMessage,
    });
  }, [step, businessInfo, monthlyVolume, useCases, initialMessage, saveProgressMutation]);

  const completeOnboarding = useCallback(async (data: InitialMessageFormValues) => {
    await completeOnboardingMutation.mutateAsync(data);
  }, [completeOnboardingMutation]);

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
        initialMessage,
        setInitialMessage,
        saveProgress,
        completeOnboarding,
        isLoading,
        isSaving: saveProgressMutation.isPending,
        isCompleting: completeOnboardingMutation.isPending,
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
