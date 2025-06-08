import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation, Link } from "wouter";

export default function Signup() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const signupMutation = useMutation({
    mutationFn: () =>
      apiRequest({ method: "POST", url: "/api/signup", data: { username, password } }),
    onSuccess: async () => {
      toast({ title: "Account Created" });
      navigate("/");
    },
    onError: (error: any) => {
      toast({
        title: "Sign Up Failed",
        description: error.message || "Unable to sign up",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50 fade-in">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-center">Create Account</h1>
        <div className="space-y-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
          </div>
          <Button
            className="w-full"
            onClick={() => signupMutation.mutate()}
            disabled={signupMutation.isPending}
          >
            {signupMutation.isPending ? "Signing up..." : "Sign Up"}
          </Button>
          <p className="text-center text-sm">
            Already have an account? <Link href="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
