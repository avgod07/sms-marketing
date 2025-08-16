import StatusBadge from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatNumber, formatBusinessDate, formatCampaignStatus } from "@/lib/utils";
import { useBusinessTimezone } from "@/hooks/use-business-timezone";
import type { CampaignWithQueue } from "@shared/api-types";
import { MoreHorizontal, Trash2, X, Calendar, Edit, Send } from "lucide-react";

// Get appropriate status badge with queue support
function getStatusBadge(campaign: CampaignWithQueue, timezone: string) {
  // Handle ALL status types comprehensively
  switch (campaign.status) {
    case "scheduled":
      return (
        <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200">
          📅 Scheduled for {campaign.scheduledSendTime ? formatBusinessDate(campaign.scheduledSendTime, timezone) : 'later'}
        </Badge>
      );
      
    case "processing":
      return (
        <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200">
          ⏳ Sending Messages...
        </Badge>
      );
      
    case "completed":
      // Legacy queue support (for existing campaigns with queued messages)
      if (campaign.hasQueuedMessages) {
        return (
          <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200">
            🟡 Queued for Business Hours
          </Badge>
        );
      }
      return (
        <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">
          ✅ Completed
        </Badge>
      );
      
    case "cancelled":
      return (
        <Badge variant="outline" className="text-gray-600 bg-gray-50 border-gray-200">
          ❌ Cancelled
        </Badge>
      );
      
    case "failed": 
      return (
        <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200">
          🚫 Failed
        </Badge>
      );
      
    case "in_progress":
    default:
      return (
        <StatusBadge status={campaign.status} className="whitespace-nowrap">
          {formatCampaignStatus(campaign.status)}
        </StatusBadge>
      );
  }
}

interface CampaignTableProps {
  campaigns: CampaignWithQueue[];
  isLoading: boolean;
  onDelete: (campaign: CampaignWithQueue) => void;
  onCancel?: (campaign: CampaignWithQueue) => void;
  onReschedule?: (campaign: CampaignWithQueue) => void;
}

// Get actions available for a campaign based on its status
function getCampaignActions(campaign: CampaignWithQueue) {
  const actions = [];
  
  // Cancel button for cancellable campaigns
  if (campaign.status === "scheduled" || 
      campaign.status === "processing" ||
      (campaign.status === "completed" && campaign.hasQueuedMessages)) {
    actions.push({
      id: "cancel",
      label: "Cancel",
      icon: X,
      className: "text-amber-600 focus:text-amber-600"
    });
  }
  
  // Reschedule only for scheduled campaigns
  // TODO: Implement reschedule modal - backend API exists
  // if (campaign.status === "scheduled") {
  //   actions.push({
  //     id: "reschedule",
  //     label: "Reschedule", 
  //     icon: Calendar,
  //     className: "text-blue-600 focus:text-blue-600"
  //   });
  // }
  
  // Delete only for completed/cancelled/failed campaigns
  if (["completed", "cancelled", "failed"].includes(campaign.status) && !campaign.hasQueuedMessages) {
    actions.push({
      id: "delete",
      label: "Delete",
      icon: Trash2,
      className: "text-red-600 focus:text-red-600"
    });
  }
  
  return actions;
}

export default function CampaignTable({
  campaigns,
  isLoading,
  onDelete,
  onCancel,
  onReschedule,
}: CampaignTableProps) {
  const { timezone } = useBusinessTimezone();
  
  const handleAction = (campaign: CampaignWithQueue, actionId: string) => {
    switch (actionId) {
      case "cancel":
        onCancel?.(campaign);
        break;
      case "delete":
        onDelete(campaign);
        break;
      case "reschedule":
        onReschedule?.(campaign);
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="text-gray-500">Loading campaigns...</div>
      </div>
    );
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Send className="w-6 h-6 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No campaigns yet</h3>
        <p className="text-gray-500">Create your first SMS campaign to get started</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-medium text-gray-500">
              Campaign
            </th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">
              Message Preview
            </th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">
              Sent
            </th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">
              Delivered
            </th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">
              Status
            </th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {campaigns.map((campaign) => {
            const actions = getCampaignActions(campaign);
            
            return (
              <tr key={campaign.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-4 px-4">
                  <div>
                    <span className="font-medium text-gray-900">{campaign.name}</span>
                                          <div className="text-sm text-gray-500">
                        {formatBusinessDate(campaign.createdAt, timezone)}
                      </div>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="max-w-xs">
                    <span className="text-gray-900 text-sm line-clamp-2">
                      {campaign.message.length > 100
                        ? `${campaign.message.substring(0, 100)}...`
                        : campaign.message}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <span className="text-gray-900">{formatNumber(campaign.sentCount || 0)}</span>
                </td>
                <td className="py-4 px-4">
                  <span className="text-gray-900">{formatNumber(campaign.deliveredCount || 0)}</span>
                </td>
                <td className="py-4 px-4 align-middle">
                  {getStatusBadge(campaign, timezone)}
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center space-x-2">
                    {actions.length > 0 ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {actions.map((action) => {
                            const Icon = action.icon;
                            return (
                              <DropdownMenuItem 
                                key={action.id}
                                onSelect={() => handleAction(campaign, action.id)} 
                                className={action.className}
                              >
                                <Icon className="mr-2 h-4 w-4" /> {action.label}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="text-gray-400 text-sm">No actions</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
