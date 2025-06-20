import { useQuery } from "@tanstack/react-query";

export function useCredits() {
  return useQuery<number>({
    queryKey: ["/api/credits"],
  });
}

