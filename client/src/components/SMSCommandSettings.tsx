import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Plus, Trash2, Clock, MessageSquare, Shield, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { handleApiError } from "@/lib/handleApiError";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "wouter";

interface SMSCommandSender {
  id: number;
  phoneNumber: string;
  isActive: boolean;
  addedByUserId: number;
  createdAt: string;
  updatedAt: string;
}

interface SMSCommandInfo {
  isEnabled: boolean;
  authorizedSendersCount: number;
  businessPhoneNumber: string;
  rateLimitStatus: {
    hasRateLimit: boolean;
    lastCommandAt?: string;
    nextAvailableAt?: string;
    canSendNow: boolean;
    minutesUntilNext?: number;
  };
  tfvStatus: {
    isVerified: boolean;
    status: string;
    hasPhoneNumbers: boolean;
  };
  rateLimit: {
    intervalHours: number;
    description: string;
  };
  usage: {
    description: string;
    example: string;
  };
}

export default function SMSCommandSettings() {
  const { toast } = useToast();
  const [newSenderPhone, setNewSenderPhone] = useState("");

  // Fetch SMS command info
  const { data: commandInfo, isLoading: infoLoading } = useQuery<SMSCommandInfo>({
    queryKey: ["/api/sms-commands/info"],
    queryFn: async () => {
      const res = await apiRequest({ 
        method: "GET", 
        url: "/api/sms-commands/info" 
      });
      return res.json();
    },
  });

  // Fetch authorized senders
  const { data: senders, isLoading: sendersLoading } = useQuery<SMSCommandSender[]>({
    queryKey: ["/api/sms-commands/senders"],
    queryFn: async () => {
      const res = await apiRequest({ 
        method: "GET", 
        url: "/api/sms-commands/senders" 
      });
      return res.json();
    },
  });

  // Add sender mutation
  const addSenderMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const res = await apiRequest({
        method: "POST",
        url: "/api/sms-commands/senders",
        data: { phoneNumber },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms-commands/senders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sms-commands/info"] });
      setNewSenderPhone("");
      toast({
        title: "Success",
        description: "Authorized sender added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: handleApiError(error),
        variant: "destructive",
      });
    },
  });

  // Remove sender mutation
  const removeSenderMutation = useMutation({
    mutationFn: async (senderId: number) => {
      const res = await apiRequest({
        method: "DELETE",
        url: `/api/sms-commands/senders/${senderId}`,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms-commands/senders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sms-commands/info"] });
      toast({
        title: "Success",
        description: "Authorized sender removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: handleApiError(error),
        variant: "destructive",
      });
    },
  });

  const handleAddSender = () => {
    if (!newSenderPhone.trim()) {
      toast({
        title: "Error",
        description: "Please enter a phone number",
        variant: "destructive",
      });
      return;
    }
    addSenderMutation.mutate(newSenderPhone);
  };

  const handleRemoveSender = (senderId: number) => {
    removeSenderMutation.mutate(senderId);
  };

  const formatNextAvailable = (dateString: string): string => {
    return new Date(dateString).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  if (infoLoading || sendersLoading) {
    return <div className="text-gray-500">Loading SMS command settings...</div>;
  }

  // Check TFV verification status
  if (commandInfo && !commandInfo.tfvStatus.isVerified) {
    const getTFVAlertConfig = () => {
      switch (commandInfo.tfvStatus.status) {
        case "no_phone_numbers":
          return {
            title: "Phone Number Required",
            message: "Complete your onboarding and get a verified phone number to use SMS commands.",
            buttonText: "Complete Setup",
            buttonLink: "/onboarding"
          };
        case "not_submitted":
          return {
            title: "Phone Number Must Be Verified",
            message: "Your business phone number must be verified before you can use SMS commands.",
            buttonText: "Contact Support",
            buttonLink: "/help"
          };
        case "PENDING_REVIEW":
          return {
            title: "Waiting for Phone Number Verification",
            message: "Your phone number verification is under review. SMS commands will be available once your number is verified. This typically takes 2-5 business days.",
            buttonText: "Contact Support",
            buttonLink: "/help"
          };
        case "TWILIO_REJECTED":
          return {
            title: "Phone Number Verification Issue",
            message: "Your phone number verification requires additional review before SMS commands can be enabled.",
            buttonText: "Contact Support",
            buttonLink: "/help"
          };
        default:
          return {
            title: "Phone Number Verification Required",
            message: "SMS commands require your business phone number to be verified first.",
            buttonText: "Contact Support",
            buttonLink: "/help"
          };
      }
    };

    const alertConfig = getTFVAlertConfig();

    return (
      <div className="space-y-4">
        {/* TFV Verification Alert - Using consistent site style */}
        <Alert className="mb-6 bg-yellow-50 border-yellow-400 text-yellow-700">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{alertConfig.title}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{alertConfig.message}</p>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={alertConfig.buttonLink}>{alertConfig.buttonText}</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>

        {/* Feature Preview (Disabled) */}
        <div className="opacity-50 pointer-events-none bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h3 className="font-medium text-gray-900 mb-3">SMS Command Preview</h3>
          <p className="text-sm text-gray-600 mb-4">
            <em>Once your phone number is verified, this feature will be fully enabled with color-coded status indicators.</em>
          </p>
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              <strong>How it works:</strong> Send "SEND: your message" to your verified business number
            </p>
            <p className="font-mono bg-gray-100 p-2 rounded">
              Example: SEND: Flash sale today! 50% off everything. Reply STOP to opt out.
            </p>
            <p>
              <MessageSquare className="h-4 w-4 inline mr-1" />
              Messages are sent to all your contacts automatically
            </p>
            <p>
              <Clock className="h-4 w-4 inline mr-1" />
              Rate limit: 1 command per hour per business
            </p>
            <p>
              <Shield className="h-4 w-4 inline mr-1" />
              Only verified, authorized phone numbers can send commands
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Warning Banner */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
        <div className="flex">
          <AlertTriangle className="h-5 w-5 text-yellow-400" />
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              <strong>Warning:</strong> Authorized phone numbers will be able to send SMS campaigns 
              to all your contacts by texting "SEND: your message" to your business number{" "}
              {commandInfo?.businessPhoneNumber && (
                <span className="font-mono">({commandInfo.businessPhoneNumber})</span>
              )}.
            </p>
          </div>
        </div>
      </div>

      {/* Usage Instructions */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="flex">
          <MessageSquare className="h-5 w-5 text-blue-400" />
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>How to use:</strong> {commandInfo?.usage.description}
            </p>
            <p className="text-sm text-blue-600 mt-1 font-mono">
              Example: {commandInfo?.usage.example}
            </p>
            <p className="text-sm text-blue-600 mt-1">
              <Clock className="h-4 w-4 inline mr-1" />
              Rate limit: {commandInfo?.rateLimit.description}
            </p>
          </div>
        </div>
      </div>

      {/* Rate Limit Status */}
      {commandInfo?.rateLimitStatus.hasRateLimit && (
        <div className={`p-3 rounded border ${
          commandInfo.rateLimitStatus.canSendNow 
            ? "bg-green-50 border-green-200" 
            : "bg-red-50 border-red-200"
        }`}>
          <p className={`text-sm ${
            commandInfo.rateLimitStatus.canSendNow 
              ? "text-green-700" 
              : "text-red-700"
          }`}>
            {commandInfo.rateLimitStatus.canSendNow ? (
              "✅ Ready to send commands"
            ) : (
              `⏱️ Rate limited. Next available: ${
                commandInfo.rateLimitStatus.nextAvailableAt 
                  ? formatNextAvailable(commandInfo.rateLimitStatus.nextAvailableAt)
                  : "Unknown"
              }`
            )}
          </p>
        </div>
      )}

      {/* Current Authorized Senders */}
      {senders && senders.length > 0 ? (
        <div>
          <Label className="text-base font-medium">Authorized Senders</Label>
          <div className="mt-2 space-y-2">
            {senders.map((sender) => (
              <div 
                key={sender.id} 
                className="flex items-center justify-between p-3 bg-gray-50 rounded border"
              >
                <div>
                  <span className="font-mono">{sender.phoneNumber}</span>
                  <span className="text-sm text-gray-500 ml-2">
                    Added {new Date(sender.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRemoveSender(sender.id)}
                  disabled={removeSenderMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-gray-500">No authorized senders configured</p>
      )}

      {/* Add New Authorized Sender */}
      <div className="space-y-2">
        <Label htmlFor="new-sender">Add Authorized Sender</Label>
        <div className="flex gap-2">
          <Input
            id="new-sender"
            placeholder="+1234567890"
            value={newSenderPhone}
            onChange={(e) => setNewSenderPhone(e.target.value)}
            disabled={addSenderMutation.isPending}
          />
          <Button
            onClick={handleAddSender}
            disabled={addSenderMutation.isPending || !newSenderPhone.trim()}
          >
            <Plus className="h-4 w-4 mr-2" />
            {addSenderMutation.isPending ? "Adding..." : "Add"}
          </Button>
        </div>
        <p className="text-sm text-gray-500">
          Enter the phone number that should be authorized to send SMS commands
        </p>
      </div>
    </div>
  );
} 