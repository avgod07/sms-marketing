import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput, normalizePhoneNumber } from "@/components/ui/phone-input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { handleApiError } from "@/lib/handleApiError";

interface TestMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  mediaUrl?: string;
  onSuccess?: () => void;
}

interface TestMessageData {
  message: string;
  mediaUrl?: string;
  phoneNumber: string;
}

export default function TestMessageModal({
  open,
  onOpenChange,
  message,
  mediaUrl,
  onSuccess,
}: TestMessageModalProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const { toast } = useToast();

  const sendTestMessageMutation = useMutation({
    mutationFn: async (data: TestMessageData) => {
      const res = await apiRequest({
        method: "POST",
        url: "/api/campaigns/test",
        data,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Test Message Sent",
        description: `${data.messageType} test message sent successfully! Credits deducted: ${data.creditsDeducted}`,
      });
      onSuccess?.();
      onOpenChange(false);
      setPhoneNumber("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Test Message",
        description: handleApiError(error),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!phoneNumber.trim()) {
      toast({
        title: "Phone Number Required",
        description: "Please enter a phone number to send the test message.",
        variant: "destructive",
      });
      return;
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    const digits = normalizedPhone.replace(/\D/g, "");
    
    if (digits.length < 10 || digits.length > 11) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid 10-11 digit phone number.",
        variant: "destructive",
      });
      return;
    }

    sendTestMessageMutation.mutate({
      message,
      mediaUrl,
      phoneNumber: normalizedPhone,
    });
  };

  const handleCancel = () => {
    onOpenChange(false);
    setPhoneNumber("");
  };

  const isPhoneValid = () => {
    if (!phoneNumber.trim()) return false;
    const digits = phoneNumber.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 11;
  };

  const creditsNeeded = mediaUrl ? 3 : 1;
  const messageType = mediaUrl ? "MMS" : "SMS";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Test Message</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="test-phone">Send test message to</Label>
            <PhoneInput
              id="test-phone"
              value={phoneNumber}
              onChange={setPhoneNumber}
              placeholder="(555) 123-4567"
              className="mt-1"
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-600 mb-2">
              <strong>Test Message Preview:</strong>
            </p>
            <p className="text-sm text-gray-700 mb-2">{message}</p>
            {mediaUrl && (
              <div className="mt-2">
                <img 
                  src={mediaUrl} 
                  alt="Test message media" 
                  className="max-h-20 rounded border"
                />
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              This will send a {messageType} test message and deduct {creditsNeeded} credit{creditsNeeded > 1 ? 's' : ''}.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={sendTestMessageMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isPhoneValid() || sendTestMessageMutation.isPending}
          >
            {sendTestMessageMutation.isPending ? "Sending..." : "Send Test"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 