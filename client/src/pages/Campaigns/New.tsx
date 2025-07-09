import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import CampaignForm, { type CampaignFormValues } from "@/components/CampaignForm";
import TestMessageModal from "@/components/CampaignForm/TestMessageModal";
import SmsPreview from "@/components/CampaignForm/SmsPreview";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { handleApiError } from "@/lib/handleApiError";
import type { SetupStatus, CampaignSendSummary } from "@shared/api-types";

export default function NewCampaignPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [previewMessage, setPreviewMessage] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState<string | undefined>(undefined);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  const { data: setup } = useQuery<SetupStatus>({
    queryKey: ["/api/setup/status"],
  });

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
      const sent = data.sentCount ?? 0;
      const failed = data.failedCount ?? 0;
      toast({
        title: "Campaign Created",
        description: `Campaign completed: ${sent} sent, ${failed} failed.`,
      });
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

  const disabled =
    !setup?.phoneConfigured || !setup?.hasContacts;

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
        {disabled && (
          <Alert className="mb-6 bg-yellow-50 border-yellow-400 text-yellow-700">
            <AlertTitle>Finish Setup</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                { !setup?.phoneConfigured && !setup?.hasContacts
                  ? 'Add a phone number and contacts before creating a campaign.'
                  : !setup?.phoneConfigured
                  ? 'Add a phone number before creating a campaign.'
                  : 'Add contacts before creating a campaign.' }
              </p>
              <div className="flex gap-2">
                {!setup?.phoneConfigured && (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/settings">Add Number</Link>
                  </Button>
                )}
                {!setup?.hasContacts && (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/contacts">Add Contacts</Link>
                  </Button>
                )}
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
