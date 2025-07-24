import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PhoneInput, normalizePhoneNumber } from "@/components/ui/phone-input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { handleApiError } from "@/lib/handleApiError";
import { calculateTwilioSegmentation, formatMessageTypeDisplay } from "@/lib/twilio-segmentation";

interface TestMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  mediaUrl?: string;
  onSuccess?: () => void;
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
  const queryClient = useQueryClient();

  const sendTestMessageMutation = useMutation({
    mutationFn: async (data: { message: string; mediaUrl?: string; phoneNumber: string }) =>
      apiRequest({
        method: "POST",
        url: "/api/campaigns/test",
        data,
      }),
    onSuccess: (data) => {
      toast({
        title: "Test message sent!",
        description: `Message sent successfully. Credits used: ${creditsNeeded}`,
      });
      onSuccess?.();
      // Refresh user data to update credits display
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      onOpenChange(false);
      setPhoneNumber("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send test message",
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

  // Use accurate Twilio segmentation
  const messageInfo = calculateTwilioSegmentation(message, !!mediaUrl);
  const creditsNeeded = messageInfo.credits;

  return (
    <>
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
              <div className="mt-3 pt-2 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Message type:</span>
                  <span className="font-medium text-gray-800">
                    {formatMessageTypeDisplay(messageInfo)}
                  </span>
                </div>
                {messageInfo.type === 'SMS' && messageInfo.segments > 1 && (
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-600">Encoding:</span>
                    <span className="text-gray-700">{messageInfo.encoding}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-gray-600">Credits needed:</span>
                  <span className="font-medium text-gray-800">{creditsNeeded}</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                This will send a test message and deduct {creditsNeeded} credit{creditsNeeded > 1 ? 's' : ''} from your balance.
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
    </>
  );
} 