import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiMutation } from "@/lib/queryClient";
import type { BusinessInfoFormValues } from "@/components/onboarding/business-info-form";
import type { VolumeOption } from "@/components/onboarding/monthly-volume-form";
import type { UseCaseOption } from "@/components/onboarding/use-case-form";
import type { InitialMessageFormValues } from "@/components/onboarding/initial-message-form";

export interface OnboardingProgress {
  step: number;
  businessInfo: BusinessInfoFormValues | null;
  monthlyVolume: VolumeOption | null;
  useCases: UseCaseOption[] | null;
  initialMessage?: InitialMessageFormValues | null;
}

export interface SaveProgressData {
  step: number;
  businessInfo?: BusinessInfoFormValues;
  monthlyVolume?: VolumeOption;
  useCases?: UseCaseOption[];
  initialMessage?: InitialMessageFormValues;
}

export function useOnboardingProgress() {
  return useQuery<OnboardingProgress>({
    queryKey: ["onboarding-progress"],
    queryFn: async () => {
      const response = await fetch("/api/onboarding/progress", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch onboarding progress");
      }
      const data = await response.json();
      return data;
    },
    staleTime: 0, // Always refetch when component mounts
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

export function useSaveOnboardingProgress() {
  const queryClient = useQueryClient();

  return useMutation<OnboardingProgress, Error, SaveProgressData>({
    mutationFn: async (data) => {
      return apiMutation({
        method: "POST",
        url: "/api/onboarding/save-progress",
        data,
      });
    },
    onSuccess: (data) => {
      // Update the cache directly instead of invalidating to prevent refetch
      queryClient.setQueryData(["onboarding-progress"], data);
    },
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  return useMutation<any, Error, InitialMessageFormValues>({
    mutationFn: async (data) => {
      return apiMutation({
        method: "POST",
        url: "/api/onboarding/complete",
        data,
      });
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["onboarding-progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/setup/status"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/business/account-info"],
      });
    },
  });
}
