import { useQuery } from "@tanstack/react-query";
import type { BusinessTimezoneInfo } from "@shared/api-types";

/**
 * Hook to get the current business timezone
 * Uses the existing /api/business/timezone endpoint
 */
export function useBusinessTimezone() {
  const { data: timezoneInfo, isLoading } = useQuery<BusinessTimezoneInfo>({
    queryKey: ["/api/business/timezone"],
    staleTime: 5 * 60 * 1000, // 5 minutes - timezone doesn't change often
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    timezone: timezoneInfo?.current.timezone || "America/New_York",
    isLoading,
    timezoneInfo,
  };
}
