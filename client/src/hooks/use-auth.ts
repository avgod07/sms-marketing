import { useUser } from "@clerk/clerk-react";

export function useAuth() {
  const { isLoaded, user } = useUser();
  return { data: user || null, isLoading: !isLoaded };
}
