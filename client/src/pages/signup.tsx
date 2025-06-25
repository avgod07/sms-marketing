import { useState } from "react";
import { useSignUp } from "@clerk/clerk-react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { handleApiError } from "@/lib/handleApiError";

export default function Signup() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    try {
      await signUp.create({
        emailAddress: email,
        password,
        firstName,
        lastName,
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: any) {
      toast({
        title: "Error",
        description: handleApiError(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        navigate("/onboarding");
      } else {
        toast({
          title: "Error",
          description: "Invalid verification code",
          variant: "destructive",
        });
      }
    } catch (err: any) {
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
      {!pendingVerification ? (
        <form
          onSubmit={handleSignup}
          className="bg-white p-8 rounded-lg shadow-md w-full max-w-md space-y-4"
        >
          <h1 className="text-2xl font-bold text-center">Sign Up</h1>
          <div>
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            {loading ? "Creating account..." : "Sign Up"}
          </Button>
          <p className="text-center text-sm">
            Already have an account? <a href="/login" className="text-blue-600 hover:underline">Sign in</a>
          </p>
        </form>
      ) : (
        <form
          onSubmit={handleVerify}
          className="bg-white p-8 rounded-lg shadow-md w-full max-w-md space-y-4"
        >
          <h1 className="text-2xl font-bold text-center">Verify Email</h1>
          <div>
            <Label htmlFor="code">Verification Code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !isLoaded}>
            {loading ? "Verifying..." : "Verify"}
          </Button>
        </form>
      )}
    </div>
  );
}
