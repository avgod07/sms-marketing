import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Building2, Clock, MapPin, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { BusinessTimezoneInfo } from "@shared/api-types";
import { useSetupStatus } from "@/hooks/use-setup-status";
import TimezoneSettingsCard from "./TimezoneSettingsCard";

export default function BusinessSettingsTab() {
  const { data: setup, isLoading: setupLoading } = useSetupStatus();
  
  const { data: timezoneInfo, isLoading: timezoneLoading } = useQuery<BusinessTimezoneInfo>({
    queryKey: ["/api/business/timezone"],
    queryFn: async () => {
      const res = await apiRequest({ method: "GET", url: "/api/business/timezone" });
      return res.json();
    },
    enabled: setup?.onboardingComplete, // Only fetch if onboarding is complete
  });

  // Show loading state
  if (setupLoading || (setup?.onboardingComplete && timezoneLoading)) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="w-5 h-5" />
              <span>Business Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show onboarding completion message if not complete
  if (!setup?.onboardingComplete) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="w-5 h-5" />
              <span>Business Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Complete Onboarding First</AlertTitle>
              <AlertDescription className="text-amber-700 space-y-3">
                <p>
                  Business settings will appear once you complete your onboarding process. 
                  This includes timezone management, business profile information, and other preferences.
                </p>
                <div>
                  <Button asChild size="sm" variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100">
                    <Link href="/onboarding">Complete Onboarding</Link>
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show business settings when onboarding is complete
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building2 className="w-5 h-5" />
            <span>Business Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Timezone Settings Section */}
          {timezoneInfo && (
            <TimezoneSettingsCard 
              timezoneInfo={timezoneInfo}
            />
          )}
          
          {/* Future: Other business settings can be added here */}
          {/* - Business profile information */}
          {/* - Phone number settings */}
          {/* - Operating hours customization */}
        </CardContent>
      </Card>
    </div>
  );
} 