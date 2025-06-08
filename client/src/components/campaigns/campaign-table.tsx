import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber, formatDate, getStatusColor } from "@/lib/utils";
import { Campaign } from "@shared/schema";
import { MoreHorizontal, Edit, Play, Pause } from "lucide-react";

interface CampaignTableProps {
  campaigns: Campaign[];
  isLoading: boolean;
}

export default function CampaignTable({ campaigns, isLoading }: CampaignTableProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-4 border-b">
            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/3"></div>
            </div>
            <div className="h-6 bg-gray-200 rounded w-16"></div>
            <div className="h-6 bg-gray-200 rounded w-16"></div>
          </div>
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Play className="w-6 h-6 text-gray-400" />
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
            <th className="text-left py-3 px-4 font-medium text-gray-500">Campaign</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Audience</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Sent</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Delivered</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Clicks</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr key={campaign.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-4 px-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-medium">
                      {campaign.name[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{campaign.name}</p>
                    <p className="text-sm text-gray-500">
                      {campaign.message.length > 50 
                        ? `${campaign.message.substring(0, 50)}...` 
                        : campaign.message}
                    </p>
                  </div>
                </div>
              </td>
              <td className="py-4 px-4">
                <span className="text-gray-900 capitalize">
                  {campaign.audience === 'all'
                    ? 'All Contacts'
                    : campaign.audience === 'inactive'
                    ? 'Inactive Users'
                    : campaign.audience}
                </span>
              </td>
              <td className="py-4 px-4">
                <span className="text-gray-900">{formatDate(campaign.createdAt)}</span>
              </td>
              <td className="py-4 px-4">
                <span className="text-gray-900">{formatNumber(campaign.sentCount || 0)}</span>
              </td>
              <td className="py-4 px-4">
                <span className="text-gray-900">{formatNumber(campaign.deliveredCount || 0)}</span>
              </td>
              <td className="py-4 px-4">
                <span className="text-gray-900">{formatNumber(campaign.clickCount || 0)}</span>
              </td>
              <td className="py-4 px-4">
                <Badge className={getStatusColor(campaign.status)}>
                  {campaign.status}
                </Badge>
              </td>
              <td className="py-4 px-4">
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    {campaign.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
