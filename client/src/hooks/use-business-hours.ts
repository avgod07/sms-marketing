import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  businessHoursService,
  type BusinessHoursCheck,
} from "@/services/business-hours";

/**
 * Shared Business Hours Hook
 * Uses centralized service to eliminate duplicate API calls
 * Automatically manages subscription lifecycle and authentication state
 */
export function useBusinessHours() {
  const { data: user } = useAuth();
  const [hoursCheck, setHoursCheck] = useState<BusinessHoursCheck | null>(
    businessHoursService.getCurrentStatus()
  );
  const [isLoading, setIsLoading] = useState<boolean>(!hoursCheck && !!user);

  useEffect(() => {
    // Enable/disable service based on authentication
    businessHoursService.setEnabled(!!user);

    if (!user) {
      setHoursCheck(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(!businessHoursService.getCurrentStatus());

    // Subscribe to business hours updates
    const unsubscribe = businessHoursService.subscribe((status) => {
      setHoursCheck(status);
      setIsLoading(false);
    });

    // Cleanup subscription on unmount or user change
    return unsubscribe;
  }, [user]);

  return {
    data: hoursCheck,
    isLoading,
    isError: false, // Service handles errors internally, maintains last known good state
  };
}
