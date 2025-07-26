import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import CampaignForm, { type CampaignFormValues } from "@/components/CampaignForm";
import TestMessageModal from "@/components/CampaignForm/TestMessageModal";
import SmsPreview from "@/components/CampaignForm/SmsPreview";
import BusinessHoursWarning from "@/components/BusinessHoursWarning";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { handleApiError } from "@/lib/handleApiError";
import type { SetupStatus, CampaignSendSummary } from "@shared/api-types";
import { useSetupStatus } from "@/hooks/use-setup-status";

export default function NewCampaignPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [previewMessage, setPreviewMessage] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState<string | undefined>(undefined);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const { data: setup } = useSetupStatus();

  const createCampaignMutation = useMutation({
    mutationFn: async (
      data: CampaignFormValues,
    ): Promise<CampaignSendSummary & { campaign: any }> => {
      const res = await apiRequest({
        method: "POST",
        url: "/api/campaigns",
        data: { name: data.name, message: data.message, mediaUrl: data.mediaUrl },
      });
      return await res.json();
    },
    onSuccess: (data: CampaignSendSummary) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      
      const immediateCount = (data.sentCount ?? 0) - (data.queuedCount ?? 0);
      const queuedCount = data.queuedCount ?? 0;
      const failed = data.failedCount ?? 0;
      
      // Smart success messaging based on queue status
      if (data.hasQueuedMessages && queuedCount > 0) {
        // Messages were queued for business hours
        const nextSendTime = data.nextSendTime ? new Date(data.nextSendTime) : null;
        const timeStr = nextSendTime ? nextSendTime.toLocaleString("en-US", {
          weekday: "short",
          hour: "numeric", 
          minute: "2-digit",
          hour12: true
        }) : "business hours";
        
        toast({
          title: "Campaign Scheduled",
          description: `Campaign queued for ${queuedCount} contacts. Messages will send at ${timeStr} (${data.queueInfo?.businessHours || "8 AM - 8 PM"}).`,
        });
      } else if (immediateCount > 0) {
        // Messages sent immediately
        toast({
          title: "Campaign Sent", 
          description: `Campaign sent to ${immediateCount} contacts immediately.${failed > 0 ? ` ${failed} failed.` : ''}`,
        });
      } else {
        // Fallback for edge cases
        toast({
          title: "Campaign Processed",
          description: `Campaign completed: ${data.sentCount} processed, ${failed} failed.`,
        });
      }
      
      navigate("/campaigns");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: handleApiError(error),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: CampaignFormValues) => {
    createCampaignMutation.mutate(data);
  };

  const handleSendTest = () => {
    if (!previewMessage.trim()) {
      toast({
        title: "Message Required",
        description: "Please enter a message before sending a test.",
        variant: "destructive",
      });
      return;
    }
    setIsTestModalOpen(true);
  };

  const handleTestSuccess = () => {
    // Refresh user data to update credits display
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
  };

  // Only disable if onboarding is not complete
  const disabled = !setup?.onboardingComplete;

  return (
    <div className="fade-in">
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create New Campaign</h1>
            <p className="text-gray-600 mt-1">Craft your SMS campaign.</p>
          </div>
        </div>
      </header>
      <div className="p-8 max-w-4xl mx-auto">
        {!disabled && <BusinessHoursWarning />}
        {disabled && (
          <Alert className="mb-6 bg-yellow-50 border-yellow-400 text-yellow-700">
            <AlertTitle>Finish Setup</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>Complete your onboarding to start creating campaigns.</p>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href="/onboarding">Complete Setup</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        <Card className="flex flex-col lg:flex-row gap-8 p-6 shadow-md">
          <div className="flex-1">
            <CampaignForm
              onSubmit={handleSubmit}
              onCancel={() => navigate("/campaigns")}
              pending={createCampaignMutation.isPending}
              submitLabel="Create Campaign"
              disabled={disabled}
              onMessageChange={setPreviewMessage}
              onImageChange={setPreviewImageUrl}
              onSendTest={handleSendTest}
            />
          </div>
          <SmsPreview message={previewMessage} imageUrl={previewImageUrl} />
        </Card>
      </div>

      <TestMessageModal
        open={isTestModalOpen}
        onOpenChange={setIsTestModalOpen}
        message={previewMessage}
        mediaUrl={previewImageUrl}
        onSuccess={handleTestSuccess}
      />
    </div>
  );
}
