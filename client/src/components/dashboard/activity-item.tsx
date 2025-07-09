import { formatRelativeTime } from "@/lib/utils";
// import { ExternalLink } from "lucide-react";

interface ActivityItemProps {
  title: string;
  subtitle?: string;
  timestamp: string;
  href?: string;
  status?: string;
  statusColor?: "default" | "success" | "warning" | "destructive";
}

export function ActivityItem({
  title,
  subtitle,
  timestamp,
  href,
  status,
  statusColor = "default",
}: ActivityItemProps) {
  const statusColors = {
    default: "bg-gray-100 text-gray-800",
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    destructive: "bg-red-100 text-red-800",
  };

  return (
    <div className="flex items-start justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
          {status && (
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[statusColor]}`}
            >
              {status}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-sm text-gray-500 truncate mt-1">{subtitle}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">
          {formatRelativeTime(timestamp)}
        </p>
      </div>
      {/* Removed external link icon and anchor */}
    </div>
  );
} 