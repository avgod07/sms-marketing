import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Login() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const sendMutation = useMutation({
    mutationFn: () =>
      apiRequest({ method: "POST", url: "/api/auth/magic-link", data: { email } }),
    onSuccess: () => {
      setSent(true);
      toast({ title: "Magic link sent" });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to send link",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50 fade-in">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-center">Sign In</h1>
        <div className="space-y-4">
          <Button className="w-full" disabled>
            Continue with Google
          </Button>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <Button
            className="w-full"
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || sent}
          >
            {sendMutation.isPending ? "Sending..." : sent ? "Link Sent" : "Send Magic Link"}
          </Button>
        </div>
      </div>
    </div>
  );
}
