import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import CampaignForm, { type CampaignFormValues } from "@/components/campaigns/campaign-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function NewCampaignPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const createCampaignMutation = useMutation({
    mutationFn: (data: CampaignFormValues) =>
      apiRequest({ method: "POST", url: "/api/campaigns", data }),
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
        <CampaignForm
          onSubmit={handleSubmit}
          onCancel={() => navigate("/campaigns")}
          pending={createCampaignMutation.isPending}
          submitLabel="Create Campaign"
        />
      </div>
    </div>
  );
}
