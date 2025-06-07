import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import CampaignTable from "@/components/campaigns/campaign-table";
import { Plus, Send, Target, BarChart3 } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import type { Campaign } from "@shared/schema";
import type { CampaignStats } from "@shared/api-types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

const campaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  message: z.string().min(1, "Message is required").max(160, "Message must be 160 characters or less"),
  audience: z.string().min(1, "Audience is required"),
});

type CampaignForm = z.infer<typeof campaignSchema>;

export default function Campaigns() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { toast } = useToast();

  const { data: campaignStats, isLoading: statsLoading } = useQuery<CampaignStats>({
    queryKey: ["/api/campaigns/stats"],
  });

  const { data: campaigns, isLoading: campaignsLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const form = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: "",
      message: "",
      audience: "all",
    },
  });

  const createCampaignMutation = useMutation({
    mutationFn: (data: CampaignForm) => apiRequest("/api/campaigns", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/stats"] });
      setIsCreateOpen(false);
      form.reset();
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

  const handleSubmit = (data: CampaignForm) => {
    createCampaignMutation.mutate(data);
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
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="name">Campaign Name</Label>
                  <Input
                    id="name"
                    {...form.register("name")}
                    placeholder="Enter campaign name"
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="audience">Audience</Label>
                  <Select onValueChange={(value) => form.setValue("audience", value)} defaultValue="all">
                    <SelectTrigger>
                      <SelectValue placeholder="Select audience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Customers</SelectItem>
                      <SelectItem value="vip">VIP Customers</SelectItem>
                      <SelectItem value="new_leads">New Leads</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.audience && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.audience.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    {...form.register("message")}
                    placeholder="Enter your SMS message (max 160 characters)"
                    className="resize-none"
                    rows={3}
                  />
                  <div className="flex justify-between mt-1">
                    {form.formState.errors.message && (
                      <p className="text-sm text-red-600">{form.formState.errors.message.message}</p>
                    )}
                    <p className="text-sm text-gray-500 ml-auto">
                      {form.watch("message")?.length || 0}/160
                    </p>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createCampaignMutation.isPending}
                    className="flex-1"
                  >
                    {createCampaignMutation.isPending ? "Creating..." : "Create Campaign"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
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
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Campaign
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <CampaignTable 
              campaigns={campaigns || []} 
              isLoading={campaignsLoading}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
