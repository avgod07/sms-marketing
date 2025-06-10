import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import CampaignForm, { type CampaignFormValues } from "@/components/campaigns/campaign-form";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SetupStatus } from "@shared/api-types";

export default function NewCampaignPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: setup } = useQuery<SetupStatus>({
    queryKey: ["/api/setup/status"],
  });

  const createCampaignMutation = useMutation({
    mutationFn: (data: CampaignFormValues) => {
      const payload: Record<string, any> = {
        name: data.name,
        message: data.message,
        audience: data.audience,
      };
      if (data.sendTime === "scheduled" && data.scheduledAt) {
        payload.scheduledAt = data.scheduledAt;
      }
      return apiRequest({ method: "POST", url: "/api/campaigns", data: payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Campaign Created",
        description: "Your SMS campaign has been created successfully.",
      });
      navigate("/campaigns");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create campaign",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: CampaignFormValues) => {
    createCampaignMutation.mutate(data);
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
          <Button variant="outline" onClick={() => navigate("/campaigns")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </header>
      <div className="p-8 max-w-md mx-auto">
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
        <CampaignForm
          onSubmit={handleSubmit}
          onCancel={() => navigate("/campaigns")}
          pending={createCampaignMutation.isPending}
          submitLabel="Create Campaign"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
