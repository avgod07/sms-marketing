import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";

export function useCredits() {
  const { isLoaded, user } = useUser();
  return useQuery<number>({
    queryKey: ["/api/credits"],
    enabled: isLoaded && !!user,
  });
}

