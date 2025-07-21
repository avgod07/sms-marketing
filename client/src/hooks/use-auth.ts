import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { handleApiError } from "@/lib/handleApiError";
import { useEffect } from "react";

interface LocalUserResponse {
  hasLocalAccount?: boolean;
  userId?: number;
  businessId?: number;
  tfvStatus?: {
    isVerified: boolean;
    status: string;
    hasPhoneNumbers: boolean;
  };
  [key: string]: any;
}

export function useAuth() {
  const { userId, isLoaded, isSignedIn } = useClerkAuth();
  const { toast } = useToast();

  // Call setup endpoint when user is authenticated
  const setupMutation = useMutation({
    mutationFn: () => apiRequest({ method: "POST", url: "/api/auth/setup" }),
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/setup/status"] });
    },
    onError: (error: any) => {
      console.error("Setup failed:", error);
      toast({
        title: "Setup Error",
        description: handleApiError(error),
        variant: "destructive",
      });
    },
  });

  // Check if local user exists - only when fully signed in
  const { data: localUser, isLoading: localUserLoading } =
    useQuery<LocalUserResponse>({
      queryKey: ["/api/me"],
      enabled: !!isSignedIn && !!userId,
      retry: false,
    });

  // Auto-setup when user is authenticated but no local user exists
  useEffect(() => {
    if (
      isSignedIn &&
      userId &&
      isLoaded &&
      !localUserLoading &&
      localUser &&
      !localUser.hasLocalAccount &&
      !setupMutation.isPending
    ) {
      setupMutation.mutate();
    }
  }, [
    isSignedIn,
    userId,
    isLoaded,
    localUserLoading,
    localUser?.hasLocalAccount, // Use specific property instead of entire object
    setupMutation.isPending,
  ]);

  // Return user data only if both Clerk user and local user exist
  const isFullyAuthenticated =
    isSignedIn && userId && localUser && localUser.hasLocalAccount;

  return {
    data: isFullyAuthenticated ? localUser : null,
    isLoading: !isLoaded || localUserLoading || setupMutation.isPending,
    isClerkAuthenticated: !!isSignedIn && !!userId, // Only true when fully signed in
  };
}
