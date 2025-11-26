import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

interface SubscriptionResponse {
  plan: string;
  trialEndsAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
}

export function useSubscription() {
  const { data: user } = useAuth();

  return useQuery<SubscriptionResponse>({
    queryKey: ["/api/subscriptions/current"],
    enabled: !!user,
  });
}

export function useSubscriptionPlans() {
  const { data: user } = useAuth();

  return useQuery({
    queryKey: ["/api/subscriptions/plans"],
    enabled: !!user,
  });
}
