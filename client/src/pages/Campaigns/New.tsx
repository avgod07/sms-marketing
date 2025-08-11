import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import CampaignForm from "@/components/CampaignForm";
import SmsPreview from "@/components/CampaignForm/SmsPreview";
import TestMessageModal from "@/components/CampaignForm/TestMessageModal";

import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { handleApiError } from "@/lib/handleApiError";
import type { CampaignSendSummary, BusinessTimezoneInfo } from "@shared/api-types";
import type { CampaignFormValues } from "@/components/CampaignForm";
import { useSetupStatus } from "@/hooks/use-setup-status";
import { Link } from "wouter";

export default function NewCampaignPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [previewMessage, setPreviewMessage] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState<string | undefined>(undefined);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const { data: setup } = useSetupStatus();

  // Browser timezone detection for pre-onboarding users
  const getBrowserTimezone = () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "America/New_York"; // Ultimate fallback
    }
  };

  // Get business timezone info for scheduling
  const { data: businessTimezoneInfo } = useQuery<BusinessTimezoneInfo>({
    queryKey: ["/api/business/timezone"],
    enabled: !!setup?.onboardingComplete,
  });

  // Immediate campaign creation (existing functionality)
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
    onSuccess: (data: CampaignSendSummary & { campaign: any }) => {
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

  // Scheduled campaign creation (new functionality)
  const createScheduledCampaignMutation = useMutation({
    mutationFn: async (data: CampaignFormValues & { scheduledSendTime: string; scheduleNotes?: string }) => {
      const response = await apiRequest({
        method: 'POST',
        url: '/api/campaigns/scheduled',
        data: {
          name: data.name,
          message: data.message,
          mediaUrl: data.mediaUrl,
          scheduledSendTime: data.scheduledSendTime,
          scheduleNotes: data.scheduleNotes
        }
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      
      toast({
        title: "Campaign Scheduled",
        description: `Campaign scheduled for ${new Date(data.scheduledFor).toLocaleString()}`,
      });
      navigate("/campaigns");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: handleApiError(error),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: CampaignFormValues) => {
    // Fixed flow: Single API call based on scheduling mode
    if (data.scheduling?.mode === 'scheduled' && data.scheduling.scheduledTime) {
      // Create scheduled campaign (does NOT execute immediately)
      createScheduledCampaignMutation.mutate({
        name: data.name,
        message: data.message,
        mediaUrl: data.mediaUrl,
        scheduledSendTime: data.scheduling.scheduledTime.toISOString(),
        scheduleNotes: data.scheduling.scheduleNotes
      });
    } else {
      // Create and execute immediate campaign (existing functionality)
      createCampaignMutation.mutate(data);
    }
  };

  const disabled = !setup?.onboardingComplete;

  const handleSendTest = () => {
    setIsTestModalOpen(true);
  };

  const handleTestSuccess = () => {
    setIsTestModalOpen(false);
    toast({
      title: "Test message sent",
      description: "Check your phone for the test message.",
    });
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Campaign</h1>
            <p className="text-gray-600 mt-1">Craft your SMS campaign.</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto">
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
                pending={createCampaignMutation.isPending || createScheduledCampaignMutation.isPending}
                submitLabel="Create Campaign"
                disabled={disabled}
                onMessageChange={setPreviewMessage}
                onImageChange={setPreviewImageUrl}
                onSendTest={handleSendTest}
                businessTimezone={businessTimezoneInfo?.current?.timezone || getBrowserTimezone()}
                businessHours={businessTimezoneInfo?.current?.businessHours || "8 AM - 8 PM"}
              />
            </div>
            <SmsPreview message={previewMessage} imageUrl={previewImageUrl} />
          </Card>
        </div>
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
