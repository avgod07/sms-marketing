import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import type { SetupStatus } from "@shared/api-types";

export function useSetupStatus(enabled = true) {
  const { isLoaded, user } = useUser();
  return useQuery<SetupStatus>({
    queryKey: ["/api/setup/status"],
    enabled: enabled && isLoaded && !!user,
  });
}
