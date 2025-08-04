import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, AlertTriangle, CheckCircle2 } from "lucide-react";
import { BusinessTimezoneInfo } from "@shared/api-types";
import TimezoneChangeModal from "./TimezoneChangeModal";

interface TimezoneSettingsCardProps {
  timezoneInfo: BusinessTimezoneInfo;
}

export default function TimezoneSettingsCard({ timezoneInfo }: TimezoneSettingsCardProps) {
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);

  const formatLastUpdated = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="border rounded-lg p-6 bg-gray-50">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">Business Timezone</h3>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setIsChangeModalOpen(true)}
        >
          Change Timezone
        </Button>
      </div>

      <div className="space-y-4">
        {/* Current Timezone Display */}
        <div>
          <div className="text-xl font-semibold text-gray-900">
            {timezoneInfo.current.displayName}
          </div>
          <div className="text-sm text-gray-600">
            {timezoneInfo.current.timezone}
          </div>
        </div>

        {/* Current Time & Business Hours */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Current time</div>
            <div className="font-medium text-gray-900">
              {timezoneInfo.current.currentTime}
            </div>
          </div>
          <div>
            <div className="text-gray-600">Business hours</div>
            <div className="font-medium text-gray-900 flex items-center gap-2">
              {timezoneInfo.current.businessHours}
              {timezoneInfo.current.isBusinessHours ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <Clock className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>
        </div>

        {/* Detection Status */}
        <div className="flex items-center gap-2 text-sm">
          <Badge variant={timezoneInfo.detection.method === "auto" ? "secondary" : "default"}>
            {timezoneInfo.detection.method === "auto" ? "Auto-detected" : "Manually set"}
          </Badge>
          <span className="text-gray-600">
            Last updated: {formatLastUpdated(timezoneInfo.detection.lastUpdated)}
          </span>
        </div>

        {/* Address Mismatch Warning */}
        {!timezoneInfo.detection.addressMatch && timezoneInfo.detection.suggestedTimezone && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <div className="font-medium text-amber-800">Timezone Mismatch</div>
              <div className="text-amber-700">
                Your timezone doesn't match your business address. 
                Consider changing to {timezoneInfo.detection.suggestedTimezone}.
              </div>
            </div>
          </div>
        )}

        {/* Queue Info */}
        {timezoneInfo.queueInfo && timezoneInfo.queueInfo.pendingMessages > 0 && (
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <Clock className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <div className="font-medium text-blue-800">Queued Messages</div>
              <div className="text-blue-700">
                {timezoneInfo.queueInfo.pendingMessages} messages are currently queued 
                {timezoneInfo.queueInfo.nextSendTime && (
                  <span> and will send at {new Date(timezoneInfo.queueInfo.nextSendTime).toLocaleString()}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Timezone Change Modal */}
      <TimezoneChangeModal
        open={isChangeModalOpen}
        onClose={() => setIsChangeModalOpen(false)}
        currentTimezone={timezoneInfo.current.timezone}
      />
    </div>
  );
} 