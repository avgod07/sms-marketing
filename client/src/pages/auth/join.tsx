import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { handleApiError } from "@/lib/handleApiError";
import { PhoneInput, normalizePhoneNumber } from "@/components/ui/phone-input";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Shield, CheckCircle2, MapPin, Globe, AlertTriangle } from "lucide-react";

interface JoinPageProps {
  params: {
    businessId: string;
  };
}

interface BusinessInfo {
  businessName: string;
  websiteUrl?: string;
  city?: string;
  state?: string;
  country?: string;
  isAcceptingContacts: boolean;
  tfvStatus: {
    isVerified: boolean;
    status: string;
    hasPhoneNumbers: boolean;
  };
}

export default function JoinPage({ params }: JoinPageProps) {
  const { businessId } = params;
  const { toast } = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [hasConsented, setHasConsented] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Fetch business information
  const { data: businessInfo, isLoading: businessLoading, error: businessError } = useQuery<BusinessInfo>({
    queryKey: [`/business/${businessId}`],
    queryFn: async () => {
      const response = await fetch(`/business/${businessId}`);
      if (!response.ok) {
        throw new Error('Business not found or not accepting contacts');
      }
      return response.json();
    },
    retry: false,
  });

  const joinMutation = useMutation({
    mutationFn: (normalizedPhone: string) =>
      apiRequest({
        method: "POST",
        url: "/contacts",
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
      let errorMessage = handleApiError(err);
      
      // Check if error is due to incomplete onboarding
      if (err?.data?.code === "ONBOARDING_INCOMPLETE") {
        errorMessage = "This business is not currently accepting new contacts. Please try again later.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Error state
  if (businessError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-red-600" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Unavailable</h1>
            <p className="text-gray-600">
              This signup form is currently unavailable. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900">Welcome!</h1>
              <p className="text-gray-600">
                You've successfully joined {businessInfo?.businessName || "our"} contact list.
              </p>
              <p className="text-sm text-gray-500">
                You'll receive a welcome message shortly.
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-xs text-blue-800">
                <Shield className="w-4 h-4 inline mr-1" />
                You can reply STOP to any message to unsubscribe at any time.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (businessLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <Skeleton className="h-4 w-3/4 mx-auto" />
            <Skeleton className="h-8 w-full" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const isFormValid = firstName && lastName && phoneNumber && hasConsented;
  const businessName = businessInfo?.businessName || "this business";
  
  // Check if TFV is verified to allow contact creation
  const canCreateContact = businessInfo?.tfvStatus?.isVerified || false;
  const isButtonDisabled = !isFormValid || joinMutation.isPending || !canCreateContact;
  const location = [businessInfo?.city, businessInfo?.state].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-blue-600" />
          </div>
          
          <div className="space-y-2">
            <Badge variant="secondary" className="mb-2">
              SMS Signup
            </Badge>
            <h1 className="text-2xl font-bold text-gray-900">
              Join {businessName}
            </h1>
            <p className="text-gray-600 text-sm">
              Get exclusive updates and offers via text message
            </p>
          </div>

          {/* Business info */}
          <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
            {businessInfo?.websiteUrl && (
              <div className="flex items-center space-x-1">
                <Globe className="w-3 h-3" />
                <span className="truncate max-w-20">{businessInfo.websiteUrl.replace(/^https?:\/\//, '')}</span>
              </div>
            )}
            {location && (
              <div className="flex items-center space-x-1">
                <MapPin className="w-3 h-3" />
                <span>{location}</span>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const normalizedPhone = normalizePhoneNumber(phoneNumber);
              joinMutation.mutate(normalizedPhone);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName" className="text-sm font-medium">
                  First Name
                </Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="lastName" className="text-sm font-medium">
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  required
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="phoneNumber" className="text-sm font-medium">
                Phone Number
              </Label>
              <PhoneInput
                id="phoneNumber"
                value={phoneNumber}
                onChange={setPhoneNumber}
                placeholder="(555) 123-4567"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email Address
                <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="mt-1"
              />
            </div>

            {/* Consent checkbox */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="consent"
                  checked={hasConsented}
                  onCheckedChange={(checked) => setHasConsented(checked === true)}
                  className="mt-0.5"
                />
                <div className="text-sm leading-relaxed">
                  <Label htmlFor="consent" className="cursor-pointer">
                    I agree to receive text messages from <strong>{businessName}</strong> at the number provided. 
                    I understand these messages may be sent using an automatic telephone dialing system. 
                    Message frequency varies. Message and data rates may apply. 
                    Consent is not required to make a purchase or use services.
                  </Label>
                </div>
              </div>
              
              <div className="text-xs text-gray-600 space-y-1">
                <p>• Reply STOP to opt out at any time</p>
                <p>• Reply HELP for customer support</p>
                <p>• View our <a href="/privacy" className="underline">Privacy Policy</a> and <a href="/terms" className="underline">Terms of Service</a></p>
                <p>• Your information will not be shared with third parties</p>
              </div>
            </div>

            {/* TFV Warning Message */}
            {!canCreateContact && businessInfo?.tfvStatus && (
              <div className="flex items-start space-x-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800">
                    New contacts cannot be created at this time
                  </p>
                  <p className="text-amber-700 mt-1">
                    This business is completing their messaging verification. 
                    Please check back in a few days.
                  </p>
                </div>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-11 text-base font-medium" 
              disabled={isButtonDisabled}
            >
              {joinMutation.isPending ? "Joining..." : `Join ${businessName}`}
            </Button>
          </form>

          {/* Trust indicators */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
              <div className="flex items-center space-x-1">
                <Shield className="w-3 h-3" />
                <span>Secure signup</span>
              </div>
              <div className="flex items-center space-x-1">
                <MessageSquare className="w-3 h-3" />
                <span>Easy unsubscribe</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
