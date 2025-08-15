import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityItem } from "./activity-item";
import { Send, Plus } from "lucide-react";
import { Link } from "wouter";
import type { RecentCampaign } from "@shared/api-types";

interface RecentCampaignsCardProps {
  campaigns: RecentCampaign[];
  isLoading?: boolean;
}

export function RecentCampaignsCard({ campaigns, isLoading }: RecentCampaignsCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "success" as const;
      case "in_progress":
        return "warning" as const;
      case "draft":
        return "default" as const;
      case "failed":
        return "destructive" as const;
      default:
        return "default" as const;
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "completed":
        return "Sent";
      case "in_progress":
        return "Scheduled";
      case "draft":
        return "Draft";
      case "failed":
        return "Failed";
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <Card className="card-hover">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Campaigns</CardTitle>
          <Send className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (campaigns.length === 0) {
    return (
      <Card className="card-hover">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Campaigns</CardTitle>
          <Send className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Send className="w-8 h-8 mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500 mb-2">
              No campaigns created yet
            </p>
            <p className="text-xs text-gray-400">
              Start your first one!
            </p>
            <Link
              href="/campaigns"
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-2"
            >
              <Plus className="w-3 h-3" />
              Create Campaign
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-hover h-80">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Campaigns</CardTitle>
        <Send className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-1 overflow-y-auto max-h-48">
          {campaigns.map((campaign) => (
            <ActivityItem
              key={campaign.id}
              title={campaign.name}
              status={getStatusDisplay(campaign.status)}
              statusColor={getStatusColor(campaign.status)}
              timestamp={campaign.createdAt}
              href={`/campaigns/${campaign.id}`}
            />
          ))}
        </div>
        {campaigns.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <Link
              href="/campaigns"
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
            >
              View all campaigns
              <Plus className="w-3 h-3" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 