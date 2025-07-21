import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import StatusBadge from "@/components/status-badge";
import { MoreHorizontal, Trash2, MessageSquare, Hash, Play, Pause } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { KeywordCampaign } from "@shared/schema";

interface KeywordTableProps {
  keywords: KeywordCampaign[];
  isLoading: boolean;
  onActivate: (keyword: KeywordCampaign) => void;
  onDeactivate: (keyword: KeywordCampaign) => void;
  onViewResponses: (keyword: KeywordCampaign) => void;
  onDelete: (keyword: KeywordCampaign) => void;
}

export default function KeywordTable({
  keywords,
  isLoading,
  onActivate,
  onDeactivate,
  onViewResponses,
  onDelete,
}: KeywordTableProps) {
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

  if (keywords.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Hash className="w-6 h-6 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No keywords found</h3>
        <p className="text-gray-500">Create your first keyword to get started</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-medium text-gray-500">Keyword</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Message Preview</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Expires</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Created</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody>
          {keywords.map((keyword) => (
            <tr key={keyword.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-4 px-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Hash className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 uppercase">{keyword.keyword}</p>
                  </div>
                </div>
              </td>
              <td className="py-4 px-4">
                <p className="text-gray-900 truncate max-w-xs">
                  {keyword.message.length > 50
                    ? `${keyword.message.substring(0, 50)}...`
                    : keyword.message}
                </p>
              </td>
              <td className="py-4 px-4">
                <StatusBadge
                  status={
                    !keyword.isActive 
                      ? 'inactive' 
                      : keyword.expiresAt && new Date(keyword.expiresAt) < new Date()
                        ? 'expired'
                        : 'active'
                  }
                  className="whitespace-nowrap"
                />
              </td>
              <td className="py-4 px-4">
                <span className="text-gray-900">
                  {keyword.expiresAt 
                    ? formatDate(keyword.expiresAt)
                    : "Never"
                  }
                </span>
              </td>
              <td className="py-4 px-4">
                <span className="text-gray-900">{formatDate(keyword.createdAt)}</span>
              </td>
              <td className="py-4 px-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {keyword.isActive ? (
                      <DropdownMenuItem onSelect={() => onDeactivate(keyword)}>
                        <Pause className="mr-2 h-4 w-4" /> Deactivate
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onSelect={() => onActivate(keyword)}>
                        <Play className="mr-2 h-4 w-4" /> Activate
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => onViewResponses(keyword)}>
                      <MessageSquare className="mr-2 h-4 w-4" /> View Responses
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => onDelete(keyword)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 