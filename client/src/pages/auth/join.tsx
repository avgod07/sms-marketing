import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { handleApiError } from "@/lib/handleApiError";
import { PhoneInput, normalizePhoneNumber } from "@/components/ui/phone-input";

interface JoinPageProps {
  params: {
    businessId: string;
  };
}

export default function JoinPage({ params }: JoinPageProps) {
  const { businessId } = params;
  const { toast } = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const joinMutation = useMutation({
    mutationFn: (normalizedPhone: string) =>
      apiRequest({
        method: "POST",
        url: "/public/contacts",
        data: {
          businessId: Number(businessId),
          firstName,
          lastName,
          phoneNumber: normalizedPhone,
          email: email || undefined,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setSubmitted(true);
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: handleApiError(err),
        variant: "destructive",
      });
    },
  });

  if (submitted) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 fade-in">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Thanks!</h1>
          <p>You've been added to our contact list.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50 fade-in">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const normalizedPhone = normalizePhoneNumber(phoneNumber);
          joinMutation.mutate(normalizedPhone);
        }}
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-md space-y-4"
      >
        <h1 className="text-2xl font-bold text-center">Join Contact List</h1>
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
          <Label htmlFor="phoneNumber">Phone Number</Label>
          <PhoneInput
            id="phoneNumber"
            value={phoneNumber}
            onChange={setPhoneNumber}
            required
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="optional"
          />
        </div>
        <Button type="submit" className="w-full" disabled={joinMutation.isPending}>
          {joinMutation.isPending ? "Submitting..." : "Join"}
        </Button>
      </form>
    </div>
  );
}
