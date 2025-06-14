import { useQuery } from "@tanstack/react-query";
import type { SetupStatus } from "@shared/api-types";

export function useSetupStatus(enabled = true) {
  return useQuery<SetupStatus>({
    queryKey: ["/api/setup/status"],
    enabled,
  });
}
