import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export function useCredits() {
  const { data: user } = useAuth();

  return useQuery<number>({
    queryKey: ["/api/credits"],
    enabled: !!user, // Only make request when user is authenticated
  });
}
