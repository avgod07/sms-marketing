import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useSetupStatus } from "@/hooks/use-setup-status";
import { useAuth } from "@/hooks/use-auth";

interface BusinessHoursCheck {
  isBusinessHours: boolean;
  currentTime: string;
  nextBusinessHour: string | null;
  willBeQueued: boolean;
  businessTimezone: string;
  businessHours: string;
}

interface BusinessHoursWarningProps {
  onHoursCheck?: (check: BusinessHoursCheck) => void;
}

export default function BusinessHoursWarning({ onHoursCheck }: BusinessHoursWarningProps) {
  const { data: user } = useAuth();
  const { data: setup } = useSetupStatus();
  
  const { data: hoursCheck, isLoading } = useQuery<BusinessHoursCheck>({
    queryKey: ["/api/business/hours-check"],
    enabled: !!user,
    queryFn: async () => {
      const res = await apiRequest({ method: "GET", url: "/api/business/hours-check" });
      return res.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  useEffect(() => {
    if (hoursCheck && onHoursCheck) {
      onHoursCheck(hoursCheck);
    }
  }, [hoursCheck, onHoursCheck]);

  if (isLoading || !hoursCheck) return null;

  // Format current time consistently with the rest of the app
  const currentTime = new Date().toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit", 
    hour12: true
  });

  // Format next business hour consistently  
  const nextBusinessTime = hoursCheck.nextBusinessHour 
    ? new Date(hoursCheck.nextBusinessHour).toLocaleString("en-US", {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      })
    : null;

  // Determine link destination based on onboarding status
  const getTimezoneSettingsLink = () => {
    if (setup?.onboardingComplete) {
      return '/settings?tab=business';
    } else {
      return '/onboarding';
    }
  };

  const getTimezoneSettingsText = () => {
    if (setup?.onboardingComplete) {
      return 'Timezone settings';
    } else {
      return 'Complete setup';
    }
  };

  if (hoursCheck.isBusinessHours) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-md border border-emerald-200 mb-6">
        <CheckCircle2 className="h-4 w-4" />
        <span className="flex-1">
          <span className="font-medium">Business hours active</span> • Messages will send immediately
        </span>
        <button 
          onClick={() => window.open(getTimezoneSettingsLink(), '_blank')}
          className="text-xs underline opacity-75 hover:opacity-100"
        >
          {getTimezoneSettingsText()}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-md border border-amber-200 mb-6">
      <Clock className="h-4 w-4" />
      <span className="flex-1">
        <span className="font-medium">Outside business hours</span> • Messages will be scheduled for {nextBusinessTime}
      </span>
      <button 
        onClick={() => window.open(getTimezoneSettingsLink(), '_blank')}
        className="text-xs underline opacity-75 hover:opacity-100"
      >
        {getTimezoneSettingsText()}
      </button>
    </div>
  );
} 