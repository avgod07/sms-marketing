import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { handleApiError } from "@/lib/handleApiError";
import { Phone, Loader2, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TollFreeNumberFormProps {
  onSuccess: () => void;
  onBack?: () => void;
  isSaving?: boolean;
}

export default function TollFreeNumberForm({
  onSuccess,
  onBack,
  isSaving = false,
}: TollFreeNumberFormProps) {
  const [selected, setSelected] = useState<string>("");
  const [page, setPage] = useState(0);
  const [skipNumberSelection, setSkipNumberSelection] = useState(false);
  const { toast } = useToast();

  const { data: numbers, isFetching } = useQuery<string[]>({
    queryKey: [`/api/twilio/available-tollfree?page=${page}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !skipNumberSelection,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (skipNumberSelection) {
        // Skip phone number selection and complete onboarding directly
        const response = await apiRequest({
          method: "POST",
          url: "/api/onboarding/complete",
          data: { 
            initialMessage: "Welcome! Thank you for signing up. Text STOP to unsubscribe." 
          },
        });
        return response.json();
      }
      
      if (!selected) throw new Error("No number selected");
      const response = await apiRequest({
        method: "POST",
        url: "/api/onboarding/reserve-number",
        data: { phoneNumber: selected },
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/setup/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/business/account-info"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      
      if (skipNumberSelection) {
        toast({
          title: "Onboarding Complete!",
          description: "Your account setup is complete. You can add a phone number later in settings.",
        });
      } else {
        toast({
          title: "Setup Complete!",
          description: data.tfvSid 
            ? "Your toll-free number is secured and verification has been submitted to Twilio. You can start sending SMS immediately!"
            : "Your toll-free number is secured. Your SMS platform is ready to use!",
        });
      }
      
      onSuccess();
    },
    onError: (error: any) => {
      const errorMessage = handleApiError(error);
      
      // If it's a Twilio configuration error, offer to skip number selection
      if (errorMessage.includes("Twilio not configured") || errorMessage.includes("Twilio not connected")) {
        toast({
          title: "Phone Number Setup Unavailable",
          description: "Twilio is not configured. You can complete onboarding and add a phone number later in settings.",
          variant: "destructive",
        });
        setSkipNumberSelection(true);
        return;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    mutation.mutate();
  };

  const handleSkipAndComplete = () => {
    setSkipNumberSelection(true);
    mutation.mutate();
  };

  if (skipNumberSelection) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Complete Onboarding</h2>
          <p className="text-gray-600">
            Phone number configuration is not available right now. You can complete onboarding and add a phone number later.
          </p>
        </div>

        <Alert>
          <AlertDescription>
            Don't worry! You can add and configure your phone number later in the Settings page under the Account tab.
          </AlertDescription>
        </Alert>

        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={onBack}
            disabled={mutation.isPending}
            className="flex-1"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="flex-1"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Completing...
              </>
            ) : (
              "Complete Onboarding"
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Choose Your Toll-Free Number</h2>
        <p className="text-gray-600">
          Select a toll-free number for your SMS campaigns. This will be your business number.
        </p>
      </div>

      {isFetching ? (
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading available numbers...</p>
        </div>
      ) : numbers && numbers.length > 0 ? (
        <div className="space-y-4">
          <Label>Available Toll-Free Numbers</Label>
          <RadioGroup value={selected} onValueChange={setSelected}>
            <div className="grid gap-2 max-h-64 overflow-y-auto">
              {numbers.map((number, index) => (
                <div key={number} className="flex items-center space-x-2">
                  <RadioGroupItem value={number} id={`number-${index}`} />
                  <Label 
                    htmlFor={`number-${index}`} 
                    className="cursor-pointer flex-1 p-2 rounded hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4" />
                      <span className="font-mono">{number}</span>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>

          {page > 0 && (
            <Button
              variant="outline"
              onClick={() => setPage(page - 1)}
              disabled={isFetching}
              size="sm"
            >
              Previous Page
            </Button>
          )}
          
          <Button
            variant="outline"
            onClick={() => setPage(page + 1)}
            disabled={isFetching}
            size="sm"
          >
            Load More Numbers
          </Button>
        </div>
      ) : (
        <Alert>
          <AlertDescription>
            No toll-free numbers are currently available. Please try again later or contact support.
          </AlertDescription>
        </Alert>
      )}

      <div className="border-t pt-4">
        <Alert>
          <AlertDescription>
            Having trouble? You can{" "}
            <button
              onClick={handleSkipAndComplete}
              className="text-blue-600 hover:text-blue-800 underline"
              disabled={mutation.isPending}
            >
              skip phone number setup
            </button>
            {" "}and add it later in settings.
          </AlertDescription>
        </Alert>
      </div>

      <div className="flex space-x-3">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={mutation.isPending}
          className="flex-1"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!selected || mutation.isPending}
          className="flex-1"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {isSaving ? "Completing..." : "Securing Number..."}
            </>
          ) : (
            "Secure Number & Complete"
          )}
        </Button>
      </div>
    </div>
  );
}
