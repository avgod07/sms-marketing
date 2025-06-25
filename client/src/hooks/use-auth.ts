import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { handleApiError } from "@/lib/handleApiError";
import { useEffect } from "react";

export function useAuth() {
  const { user, isLoaded } = useUser();
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

  // Check if local user exists
  const { data: localUser, isLoading: localUserLoading } = useQuery({
    queryKey: ["/api/me"],
    enabled: !!user,
    retry: false,
  });

  // Auto-setup when user is authenticated but no local user exists
  useEffect(() => {
    if (
      user &&
      isLoaded &&
      !localUserLoading &&
      !localUser &&
      !setupMutation.isPending
    ) {
      setupMutation.mutate();
    }
  }, [user, isLoaded, localUserLoading, localUser, setupMutation.isPending]);

  return {
    data: user ? localUser : null,
    isLoading: !isLoaded || localUserLoading || setupMutation.isPending,
  };
}
