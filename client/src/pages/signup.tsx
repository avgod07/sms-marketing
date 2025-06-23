import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FaSpinner } from "react-icons/fa";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { handleApiError } from "@/lib/handleApiError";
import { useLocation, Link } from "wouter";

export default function Signup() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const signupMutation = useMutation({
    mutationFn: () =>
      apiRequest({
        method: "POST",
        url: "/api/signup",
        data: { username, password },
      }),
    onSuccess: async () => {
      queryClient.clear();
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/setup/status"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      toast({ title: "Account Created" });
      navigate("/");
    },
    onError: (error: any) => {
      const message = handleApiError(error);
      setError(message);
      toast({
        title: "Sign Up Failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 fade-in">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <img src="/generated-icon.png" alt="SMS Marketing" className="mx-auto w-12 h-12" />
          <h1 className="text-3xl font-bold">Create Account</h1>
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="username" className="text-sm text-gray-600">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="mt-1 focus:shadow-sm"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-sm text-gray-600">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="mt-1 focus:shadow-sm"
            />
          </div>
          {error && <p className="text-center text-sm text-red-500">{error}</p>}
          <Button
            className="w-full transition-transform hover:scale-[1.02]"
            onClick={() => signupMutation.mutate()}
            disabled={signupMutation.isPending}
          >
            {signupMutation.isPending ? (
              <>
                <FaSpinner className="animate-spin" /> Signing up...
              </>
            ) : (
              "Sign Up"
            )}
          </Button>
          <div className="flex justify-center gap-2 pt-2" aria-hidden>
          </div>
          <p className="text-center text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
