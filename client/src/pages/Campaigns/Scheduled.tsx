import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Calendar, Clock, Edit2, Trash2, Send, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { handleApiError } from "@/lib/handleApiError";
import type { ScheduledCampaignListItem } from "@shared/api-types";

export default function ScheduledCampaignsPage() {
  const { toast } = useToast();

  // Fetch scheduled campaigns
  const { data: scheduledCampaigns, isLoading, error } = useQuery<ScheduledCampaignListItem[]>({
    queryKey: ["/api/campaigns/scheduled"],
    refetchInterval: 30000, // Refresh every 30 seconds to update countdowns
  });

  // Cancel scheduled campaign mutation
  const cancelCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const response = await apiRequest({
        method: "DELETE",
        url: `/api/campaigns/${campaignId}/schedule`,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/scheduled"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Campaign Cancelled",
        description: "The scheduled campaign has been cancelled successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: handleApiError(error),
        variant: "destructive",
      });
    },
  });

  const handleCancelCampaign = (campaignId: number, campaignName: string) => {
    if (confirm(`Are you sure you want to cancel the scheduled campaign "${campaignName}"?`)) {
      cancelCampaignMutation.mutate(campaignId);
    }
  };

  const formatDateTime = (dateString: string, timezone: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      timeZone: timezone,
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getStatusBadge = (campaign: ScheduledCampaignListItem) => {
    const now = new Date();
    const scheduledTime = new Date(campaign.scheduledSendTime);
    
    if (scheduledTime <= now) {
      return <Badge variant="outline" className="text-orange-600">Ready to Send</Badge>;
    }
    
    return <Badge variant="outline" className="text-blue-600">Scheduled</Badge>;
  };

  if (isLoading) {
    return (
      <div className="fade-in">
        <header className="bg-white border-b border-gray-200 px-8 py-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Scheduled Campaigns</h1>
            <p className="text-gray-600 mt-1">Manage your scheduled SMS campaigns.</p>
          </div>
        </header>
        <div className="p-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fade-in">
        <header className="bg-white border-b border-gray-200 px-8 py-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Scheduled Campaigns</h1>
            <p className="text-gray-600 mt-1">Manage your scheduled SMS campaigns.</p>
          </div>
        </header>
        <div className="p-8">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load scheduled campaigns. Please try again.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Scheduled Campaigns</h1>
            <p className="text-gray-600 mt-1">
              {scheduledCampaigns?.length || 0} scheduled campaign{scheduledCampaigns?.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button asChild>
            <a href="/campaigns/new">Schedule New Campaign</a>
          </Button>
        </div>
      </header>

      <div className="p-8 max-w-6xl mx-auto">
        {!scheduledCampaigns || scheduledCampaigns.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Scheduled Campaigns</h3>
              <p className="text-gray-600 mb-4">
                You don't have any campaigns scheduled for future delivery.
              </p>
              <Button asChild>
                <a href="/campaigns/new">Create Your First Scheduled Campaign</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {scheduledCampaigns.map((campaign) => (
              <Card key={campaign.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg">{campaign.name}</CardTitle>
                        {getStatusBadge(campaign)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDateTime(campaign.scheduledSendTime, campaign.businessTimezone)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {campaign.countdown?.timeUntilSend || "Ready to send"}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // TODO: Implement reschedule functionality
                          toast({
                            title: "Coming Soon",
                            description: "Reschedule functionality will be available soon.",
                          });
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelCampaign(campaign.id, campaign.name)}
                        disabled={cancelCampaignMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Message Preview */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Message</h4>
                      <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded border">
                        {campaign.message}
                      </p>
                    </div>

                    {/* Campaign Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-900">
                          {campaign.totalContacts}
                        </div>
                        <div className="text-xs text-gray-500">Recipients</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-900">
                          {campaign.estimatedCredits}
                        </div>
                        <div className="text-xs text-gray-500">Credits</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-900">
                          {campaign.businessTimezone}
                        </div>
                        <div className="text-xs text-gray-500">Timezone</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-900">
                          {new Date(campaign.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">Created</div>
                      </div>
                    </div>

                    {/* Schedule Notes */}
                    {campaign.scheduleNotes && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Notes</h4>
                        <p className="text-sm text-gray-600 italic">
                          {campaign.scheduleNotes}
                        </p>
                      </div>
                    )}

                    {/* Countdown Alert for Soon-to-Send Campaigns */}
                    {campaign.countdown?.timeUntilSend.includes("minute") && (
                      <Alert>
                        <Clock className="h-4 w-4" />
                        <AlertDescription>
                          This campaign will send {campaign.countdown.timeUntilSend}. 
                          Make sure your message is ready!
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 