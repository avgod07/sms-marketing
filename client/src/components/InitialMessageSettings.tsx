import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { handleApiError } from "@/lib/handleApiError";

interface InitialMessageData {
  initialMessage: string;
  onboardingComplete: boolean;
}

export default function InitialMessageSettings() {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const complianceText = "Text STOP to unsubscribe.";

  // Query to get current initial message
  const { data: messageData, isLoading, error } = useQuery<InitialMessageData>({
    queryKey: ["/api/business/initial-message"],
    queryFn: async () => {
      const res = await apiRequest({ method: "GET", url: "/api/business/initial-message" });
      return res.json();
    },
  });

  useEffect(() => {
    if (messageData) {
      setMessage(messageData.initialMessage || "");
      setIsDirty(false);
    }
  }, [messageData]);

  useEffect(() => {
    const finalMessage = message.includes(complianceText) 
      ? message 
      : `${message} ${complianceText}`;
    setCharCount(finalMessage.length);
  }, [message, complianceText]);

  const saveMutation = useMutation({
    mutationFn: (data: { initialMessage: string }) =>
      apiRequest({
        method: "POST",
        url: "/api/business/initial-message",
        data,
      }),
    onSuccess: (response) => {
      toast({ title: "Success", description: "Welcome message updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/business/initial-message"] });
      setIsDirty(false);
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: handleApiError(err),
        variant: "destructive",
      });
    },
  });

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    setIsDirty(value !== (messageData?.initialMessage || ""));
  };

  const handleSave = () => {
    if (message.trim()) {
      saveMutation.mutate({ initialMessage: message.trim() });
    }
  };

  const isFormValid = message.trim() && charCount <= 160;

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center space-x-2 text-red-600">
        <AlertCircle className="h-4 w-4" />
        <span>Error loading welcome message</span>
      </div>
    );
  }

  if (!messageData?.onboardingComplete) {
    return (
      <div className="text-gray-500">
        <p>Complete onboarding to set your welcome message.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="initial-message">Welcome Message</Label>
        <Textarea
          id="initial-message"
          value={message}
          onChange={handleMessageChange}
          placeholder="Welcome to our service! We're excited to have you join us."
          rows={3}
          className="resize-none"
          disabled={saveMutation.isPending}
        />
        <p className="text-sm text-gray-500 mt-1">
          This message will be automatically sent to new contacts when they join your list.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">
            Final message (with compliance text):
          </span>
          <span className={`font-mono ${charCount > 160 ? 'text-red-600' : 'text-gray-600'}`}>
            {charCount}/160
          </span>
        </div>
        <div className="p-3 bg-gray-50 rounded-md border">
          <p className="text-sm text-gray-700">
            {message || "Your message will appear here..."} 
            {message && !message.includes(complianceText) && (
              <span className="text-gray-500"> {complianceText}</span>
            )}
          </p>
        </div>
        {charCount > 160 && (
          <p className="text-sm text-red-600">
            Message exceeds 160 characters. Please shorten your message.
          </p>
        )}
      </div>

      <Button
        onClick={handleSave}
        disabled={!isFormValid || !isDirty || saveMutation.isPending}
      >
        {saveMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          "Save Changes"
        )}
      </Button>
    </div>
  );
} 