import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TimezoneValidationResponse } from "@shared/api-types";
import TimezoneConfirmationModal from "./TimezoneConfirmationModal";

// US Timezone options with state mappings for smart suggestions
const US_TIMEZONES = [
  {
    value: "America/New_York",
    label: "Eastern Time",
    states: ["NY", "FL", "GA", "VA", "NC", "SC", "OH", "PA", "CT", "MA", "ME", "NH", "VT", "RI", "NJ", "DE", "MD", "WV", "KY", "TN", "IN", "MI"]
  },
  {
    value: "America/Chicago", 
    label: "Central Time",
    states: ["TX", "IL", "WI", "MN", "IA", "MO", "AR", "LA", "MS", "AL", "OK", "KS", "NE", "SD", "ND"]
  },
  {
    value: "America/Denver",
    label: "Mountain Time", 
    states: ["CO", "WY", "MT", "UT", "NM", "AZ"]
  },
  {
    value: "America/Los_Angeles",
    label: "Pacific Time",
    states: ["CA", "WA", "OR", "NV"]
  },
  {
    value: "America/Anchorage",
    label: "Alaska Time",
    states: ["AK"]
  },
  {
    value: "Pacific/Honolulu",
    label: "Hawaii Time",
    states: ["HI"]
  }
];

interface TimezoneChangeModalProps {
  open: boolean;
  onClose: () => void;
  currentTimezone: string;
}

export default function TimezoneChangeModal({ 
  open, 
  onClose, 
  currentTimezone 
}: TimezoneChangeModalProps) {
  const [selectedTimezone, setSelectedTimezone] = useState(currentTimezone);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { toast } = useToast();

  // Reset selected timezone when modal opens
  useEffect(() => {
    if (open) {
      setSelectedTimezone(currentTimezone);
    }
  }, [open, currentTimezone]);

  // Validate timezone change when selection changes
  const { data: validationData, isLoading: validating } = useQuery<TimezoneValidationResponse>({
    queryKey: ["/api/business/timezone/validate", selectedTimezone],
    queryFn: async () => {
      if (selectedTimezone === currentTimezone) return null;
      
      const res = await apiRequest({ 
        method: "POST", 
        url: "/api/business/timezone/validate",
        data: { newTimezone: selectedTimezone }
      });
      return res.json();
    },
    enabled: open && selectedTimezone !== currentTimezone,
  });

  // Get current time in selected timezone for preview
  const getPreviewTime = (timezone: string) => {
    try {
      return new Date().toLocaleString("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZoneName: "short"
      });
    } catch {
      return "Invalid timezone";
    }
  };

  const handleTimezoneSelect = (newTimezone: string) => {
    setSelectedTimezone(newTimezone);
  };

  const handleChangeClick = () => {
    if (selectedTimezone === currentTimezone) {
      toast({
        title: "No Change",
        description: "Please select a different timezone.",
        variant: "destructive",
      });
      return;
    }
    
    setShowConfirmation(true);
  };

  const handleConfirmationSuccess = () => {
    setShowConfirmation(false);
    onClose();
    
    // Refresh timezone data
    queryClient.invalidateQueries({ queryKey: ["/api/business/timezone"] });
    queryClient.invalidateQueries({ queryKey: ["/api/business/hours-check"] });
    
    toast({
      title: "Timezone Updated",
      description: `Business timezone changed to ${US_TIMEZONES.find(tz => tz.value === selectedTimezone)?.label}`,
    });
  };

  const getCurrentTimezoneInfo = () => {
    return US_TIMEZONES.find(tz => tz.value === currentTimezone);
  };

  const getSelectedTimezoneInfo = () => {
    return US_TIMEZONES.find(tz => tz.value === selectedTimezone);
  };

  return (
    <>
      <Dialog open={open && !showConfirmation} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Change Business Timezone</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Current Timezone Display */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Current Setting</h3>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">
                    {getCurrentTimezoneInfo()?.label || currentTimezone}
                  </div>
                  <div className="text-sm text-gray-600">{currentTimezone}</div>
                </div>
                <div className="text-sm text-gray-600">
                  {getPreviewTime(currentTimezone)}
                </div>
              </div>
            </div>

            {/* Timezone Selector */}
            <div>
              <Label htmlFor="timezone-select" className="text-base font-medium">
                Select New Timezone
              </Label>
              <Select value={selectedTimezone} onValueChange={handleTimezoneSelect}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Choose a timezone" />
                </SelectTrigger>
                <SelectContent>
                  {US_TIMEZONES.map((timezone) => (
                    <SelectItem key={timezone.value} value={timezone.value}>
                      <div className="flex items-center justify-between w-full">
                        <span>{timezone.label}</span>
                        <span className="text-sm text-gray-500 ml-4">
                          {getPreviewTime(timezone.value)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Live Preview */}
            {selectedTimezone !== currentTimezone && (
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Preview New Settings
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600">Current</div>
                    <div className="font-medium">
                      {getCurrentTimezoneInfo()?.label} ({getPreviewTime(currentTimezone)})
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">New</div>
                    <div className="font-medium text-blue-600">
                      {getSelectedTimezoneInfo()?.label} ({getPreviewTime(selectedTimezone)})
                    </div>
                  </div>
                </div>

                {validating && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Validating change...
                  </div>
                )}

                {validationData && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="text-sm text-gray-600">Business hours will change to:</div>
                      <div className="font-medium">{validationData.impact.newBusinessHours}</div>
                    </div>

                    {validationData.impact.queuedMessagesAffected > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                        <div className="text-sm text-blue-800">
                          <strong>Queue Impact:</strong> {validationData.impact.queuedMessagesAffected} messages currently queued will send at the original scheduled time.
                        </div>
                      </div>
                    )}

                    {validationData.warnings.length > 0 && (
                      <div className="space-y-2">
                        {validationData.warnings.map((warning, index) => (
                          <div key={index} className="bg-amber-50 border border-amber-200 rounded-md p-3">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                              <div className="text-sm text-amber-800">{warning}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {validationData.suggestions.length > 0 && (
                      <div className="space-y-2">
                        {validationData.suggestions.map((suggestion, index) => (
                          <div key={index} className="bg-blue-50 border border-blue-200 rounded-md p-3">
                            <div className="text-sm text-blue-800">💡 {suggestion}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleChangeClick}
              disabled={selectedTimezone === currentTimezone || validating}
            >
              {validating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Validating...
                </>
              ) : (
                "Change Timezone"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      <TimezoneConfirmationModal
        open={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        currentTimezone={currentTimezone}
        newTimezone={selectedTimezone}
        validationData={validationData || null}
        onSuccess={handleConfirmationSuccess}
      />
    </>
  );
} 