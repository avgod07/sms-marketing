import { useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function MagicLogin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";

  const loginMutation = useMutation({
    mutationFn: () =>
      apiRequest({ method: "POST", url: "/api/auth/magic-login", data: { token } }),
    onSuccess: async () => {
      queryClient.clear();
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/setup/status"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      toast({ title: "Logged in" });
      navigate("/");
    },
    onError: (err: any) => {
      toast({
        title: "Login Failed",
        description: err.message || "Unable to sign in",
        variant: "destructive",
      });
      navigate("/login");
    },
  });

  useEffect(() => {
    if (token) loginMutation.mutate();
    else navigate("/login");
  }, []);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <p>Signing in...</p>
    </div>
  );
}
