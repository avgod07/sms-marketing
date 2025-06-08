import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CampaignForm, { type CampaignFormValues } from "@/components/campaigns/campaign-form";
import CampaignTable from "@/components/campaigns/campaign-table";
import { Plus, Send, Target, BarChart3 } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import type { Campaign } from "@shared/schema";
import type { CampaignStats } from "@shared/api-types";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function Campaigns() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const { toast } = useToast();

  const { data: campaignStats, isLoading: statsLoading } = useQuery<CampaignStats>({
    queryKey: ["/api/campaigns/stats"],
  });

  const { data: campaigns, isLoading: campaignsLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const createCampaignMutation = useMutation({
    mutationFn: (data: CampaignFormValues) =>
      apiRequest({ method: "POST", url: "/api/campaigns", data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsCreateOpen(false);
      toast({
        title: "Campaign Created",
        description: "Your SMS campaign has been created successfully.",
      });
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

  const updateCampaignMutation = useMutation({
    mutationFn: (data: CampaignFormValues) =>
      apiRequest({
        method: "PATCH",
        url: `/api/campaigns/${editingCampaign!.id}`,
        data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsEditOpen(false);
      setEditingCampaign(null);
      toast({ title: "Campaign Updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update campaign",
        variant: "destructive",
      });
    },
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
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsDeleteOpen(false);
      setDeletingCampaign(null);
      toast({ title: "Campaign Deleted" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete campaign",
        variant: "destructive",
      });
    },
  });

  const duplicateCampaignMutation = useMutation({
    mutationFn: (campaign: Campaign) =>
      apiRequest({ method: "POST", url: `/api/campaigns/${campaign.id}/duplicate` }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Campaign Duplicated" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to duplicate campaign",
        variant: "destructive",
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (campaign: Campaign) => {
      const status = campaign.status === "active" ? "paused" : "active";
      return apiRequest({
        method: "PATCH",
        url: `/api/campaigns/${campaign.id}`,
        data: { status },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Campaign Updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update campaign",
        variant: "destructive",
      });
    },
  });

  const handleEditSubmit = (data: CampaignFormValues) => {
    updateCampaignMutation.mutate(data);
  };

  const handleEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setIsEditOpen(true);
  };

  const handleDuplicate = (campaign: Campaign) => {
    duplicateCampaignMutation.mutate(campaign);
  };

  const handleToggleStatus = (campaign: Campaign) => {
    toggleStatusMutation.mutate(campaign);
  };

  const handleDelete = (campaign: Campaign) => {
    setDeletingCampaign(campaign);
    setIsDeleteOpen(true);
  };

  const confirmDelete = () => {
    deleteCampaignMutation.mutate();
  };

  const stats = [
    {
      title: "Active Campaigns",
      value: campaignStats?.activeCampaigns || 0,
      icon: Send,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Messages This Month",
      value: campaignStats?.messagesThisMonth || 0,
      icon: Target,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Avg. Click Rate",
      value: `${campaignStats?.avgClickRate || 0}%`,
      icon: BarChart3,
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
              Create and manage your SMS campaigns.
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>Create Campaign</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Campaign</DialogTitle>
              </DialogHeader>
              <CampaignForm
                onSubmit={(data: CampaignFormValues) => createCampaignMutation.mutate(data)}
                onCancel={() => setIsCreateOpen(false)}
                pending={createCampaignMutation.isPending}
                submitLabel="Create Campaign"
              />
            </DialogContent>
          </Dialog>
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Campaign</DialogTitle>
              </DialogHeader>
              <CampaignForm
                initialValues={editingCampaign as CampaignFormValues | undefined}
                onSubmit={handleEditSubmit}
                onCancel={() => setIsEditOpen(false)}
                pending={updateCampaignMutation.isPending}
                submitLabel="Save Changes"
              />
            </DialogContent>
          </Dialog>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Campaign
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <CampaignTable
              campaigns={campaigns || []}
              isLoading={campaignsLoading}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onToggleStatus={handleToggleStatus}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
