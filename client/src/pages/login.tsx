import { useState } from "react";
import { useSignIn } from "@clerk/clerk-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { handleApiError } from "@/lib/handleApiError";

export default function Login() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    try {
      console.debug("Login attempt", {
        identifier,
        password: "*".repeat(password.length),
      });
      const result = await signIn.create({ identifier, password });
      console.debug("Clerk signIn response", result);
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        navigate("/");
      } else {
        toast({
          title: "Error",
          description: "Additional verification required.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("signIn error", err);
      toast({
        title: "Error",
        description: handleApiError(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 fade-in">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-md space-y-4"
      >
        <h1 className="text-2xl font-bold text-center">Sign In</h1>
        <div>
          <Label htmlFor="identifier">Email or Phone</Label>
          <Input
            id="identifier"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading || !isLoaded}>
          {loading ? "Signing in..." : "Sign In"}
        </Button>
        <p className="text-center text-sm">
          Don't have an account? <a href="/signup" className="text-blue-600 hover:underline">Sign up</a>
        </p>
      </form>
    </div>
  );
}
