import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CampaignTable from "@/components/campaigns/campaign-table";
import { Plus, Send, Target, Calendar } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import type { CampaignStats, CampaignWithQueue } from "@shared/api-types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { handleApiError } from "@/lib/handleApiError";

export default function Campaigns() {
  const [deletingCampaign, setDeletingCampaign] = useState<CampaignWithQueue | null>(null);
  const [cancellingCampaign, setCancellingCampaign] = useState<CampaignWithQueue | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const { toast } = useToast();
  const { data: user } = useAuth();

  const { data: campaignStats, isLoading: statsLoading } = useQuery<CampaignStats>({
    queryKey: ["/api/campaigns/stats"],
    enabled: !!user,
  });

  const { data: campaigns, isLoading: campaignsLoading } = useQuery<CampaignWithQueue[]>({
    queryKey: ["/api/campaigns"],
    enabled: !!user,
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: () =>
      apiRequest({
        method: "DELETE",
        url: `/api/campaigns/${deletingCampaign!.id}`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/stats"] });
      setIsDeleteOpen(false);
      setDeletingCampaign(null);
      toast({ title: "Campaign Deleted" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: handleApiError(error),
        variant: "destructive",
      });
    },
  });

  const cancelCampaignMutation = useMutation({
    mutationFn: () =>
      apiRequest({
        method: "DELETE",
        url: `/api/campaigns/${cancellingCampaign!.id}/schedule`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/stats"] });
      setIsCancelOpen(false);
      setCancellingCampaign(null);
      toast({ title: "Campaign Cancelled" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: handleApiError(error),
        variant: "destructive",
      });
    },
  });

  const handleDelete = (campaign: CampaignWithQueue) => {
    setDeletingCampaign(campaign);
    setIsDeleteOpen(true);
  };

  const handleCancel = (campaign: CampaignWithQueue) => {
    setCancellingCampaign(campaign);
    setIsCancelOpen(true);
  };

  const handleReschedule = (campaign: CampaignWithQueue) => {
    // TODO: Implement reschedule modal
    toast({ 
      title: "Coming Soon", 
      description: "Reschedule functionality will be available soon.",
      variant: "default"
    });
  };

  const confirmDelete = () => {
    deleteCampaignMutation.mutate();
  };

  const confirmCancel = () => {
    cancelCampaignMutation.mutate();
  };

  const stats = [
    {
      title: "In Progress Campaigns",
      value: campaignStats?.activeCampaigns || 0,
      icon: Send,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Campaigns This Month",
      value: campaignStats?.campaignsThisMonth || 0,
      icon: Target,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Scheduled Campaigns",
      value: campaignStats?.scheduledCampaigns || 0,
      icon: Calendar,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <div className="fade-in">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Campaign Management</h1>
            <p className="text-gray-600 mt-1">
              Manage your SMS campaigns.
            </p>
          </div>
          <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
              </AlertDialogHeader>
              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to delete {deletingCampaign?.name}? This action cannot be undone.
              </p>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      {/* Content */}
      <div className="p-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="card-hover">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-gray-600 font-medium">{stat.title}</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {typeof stat.value === 'number' ? formatNumber(stat.value) : stat.value}
                      </p>
                    </div>
                    <div className={`w-12 h-12 ${stat.bgColor} rounded-full flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* All Campaigns */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Campaigns</CardTitle>
              <Button asChild>
                <Link href="/campaigns/new">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Campaign
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <CampaignTable 
              campaigns={campaigns || []} 
              isLoading={campaignsLoading}
              onDelete={handleDelete}
              onCancel={handleCancel}
              onReschedule={handleReschedule}
            />
          </CardContent>
        </Card>
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={isCancelOpen} onOpenChange={setIsCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Campaign</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Are you sure you want to cancel {cancellingCampaign?.name}? 
            {cancellingCampaign?.status === "scheduled" 
              ? " This will prevent the campaign from being sent at the scheduled time."
              : " This will stop any pending messages from being sent."}
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Campaign</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} className="bg-amber-600 hover:bg-amber-700">
              Cancel Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
