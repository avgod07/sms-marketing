import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Keyword {
  id: number;
  keyword: string;
  welcomeMessage: string;
  isActive: boolean;
  optInCount: number;
  createdAt: string;
  updatedAt: string;
}

interface TestMessageDialogProps {
  open: boolean;
  onClose: () => void;
  keyword?: Keyword | null;
}

export function TestMessageDialog({ open, onClose, keyword }: TestMessageDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const { toast } = useToast();

  const testMutation = useMutation({
    mutationFn: (data: { phoneNumber: string }) =>
      api.post(`/api/keywords/${keyword?.id}/test`, data),
    onSuccess: () => {
      toast({ title: "Test message sent successfully" });
      onClose();
      setPhoneNumber("");
    },
    onError: (error: any) => {
      if (error.response?.data?.error) {
        toast({ title: error.response.data.error, variant: "destructive" });
      } else {
        toast({ title: "Failed to send test message", variant: "destructive" });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber.trim()) {
      toast({ title: "Please enter a phone number", variant: "destructive" });
      return;
    }

    testMutation.mutate({ phoneNumber: phoneNumber.trim() });
  };

  const handleClose = () => {
    onClose();
    setPhoneNumber("");
  };

  if (!keyword) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test Keyword Message</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input
              id="phoneNumber"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1234567890"
              required
            />
            <p className="text-xs text-muted-foreground">
              Enter the phone number where you want to send the test message
            </p>
          </div>

          <Alert>
            <AlertDescription>
              <strong>Test Message Preview:</strong><br />
              <span className="font-mono">{keyword.keyword}</span> → {keyword.welcomeMessage} Text STOP to unsubscribe.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={testMutation.isPending || !phoneNumber.trim()}
            >
              {testMutation.isPending ? "Sending..." : "Send Test Message"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 