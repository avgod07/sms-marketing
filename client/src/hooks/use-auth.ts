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

// Global state to track setup attempts across all component instances
const SETUP_STATES = new Map<string, boolean>();

export function useAuth() {
  const { userId, isLoaded, isSignedIn } = useClerkAuth();
  const { toast } = useToast();

  // Create a unique key for this user's setup state
  const setupKey = `setup-${userId}`;

  // Call setup endpoint when user is authenticated - with global deduplication
  const setupMutation = useMutation({
    mutationKey: ["auth-setup", userId], // Keep React Query deduplication
    mutationFn: async () => {
      // Double-check global state before making the request
      if (SETUP_STATES.get(setupKey)) {
        throw new Error("Setup already in progress or completed");
      }

      // Mark as in progress globally
      SETUP_STATES.set(setupKey, true);

      try {
        const response = await apiRequest({
          method: "POST",
          url: "/api/auth/setup",
        });
        return response.json();
      } catch (error) {
        // Reset on error so it can be retried
        SETUP_STATES.delete(setupKey);
        throw error;
      }
    },
    onSuccess: (data: any) => {
      // Handle both success responses properly
      if (
        data.message === "User created successfully" ||
        data.message === "User already exists"
      ) {
        // Only invalidate essential query immediately
        queryClient.invalidateQueries({ queryKey: ["/api/me"] });

        // Defer other invalidations to prevent cascade effects
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
          queryClient.invalidateQueries({ queryKey: ["/api/setup/status"] });
        }, 100);
      }
    },
    onError: (error: any) => {
      // Only show error if it's not our deduplication error
      if (!error.message?.includes("Setup already in progress")) {
        console.error("Setup failed:", error);
        toast({
          title: "Setup Error",
          description: handleApiError(error),
          variant: "destructive",
        });
      }
    },
    retry: false, // Don't retry to avoid additional race conditions
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
    // Early exit if setup already attempted for this user
    if (SETUP_STATES.get(setupKey)) {
      return;
    }

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
    setupKey,
  ]);

  // Clean up global state when user changes (logout/login scenarios)
  useEffect(() => {
    if (!isSignedIn || !userId) {
      // Clean up any setup state for previous users
      Array.from(SETUP_STATES.keys()).forEach((key) => {
        if (key.startsWith("setup-")) {
          SETUP_STATES.delete(key);
        }
      });
    }
  }, [isSignedIn, userId]);

  // Return user data only if both Clerk user and local user exist
  const isFullyAuthenticated =
    isSignedIn && userId && localUser && localUser.hasLocalAccount;

  return {
    data: isFullyAuthenticated ? localUser : null,
    isLoading: !isLoaded || localUserLoading || setupMutation.isPending,
    isClerkAuthenticated: !!isSignedIn && !!userId, // Only true when fully signed in
  };
}
