import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CampaignTable from "@/components/campaigns/campaign-table";
import { Plus, Send, Target, BarChart3 } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export default function Campaigns() {
  const { data: campaignStats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/campaigns/stats"],
  });

  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ["/api/campaigns"],
  });

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
          <Button className="flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Create Campaign</span>
          </Button>
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
