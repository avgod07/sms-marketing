import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TimezoneValidationResponse } from "@shared/api-types";

interface TimezoneConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  currentTimezone: string;
  newTimezone: string;
  validationData: TimezoneValidationResponse | null;
  onSuccess: () => void;
}

const CHANGE_REASONS = [
  { value: "business_moved", label: "Business moved to new location" },
  { value: "incorrect_detection", label: "Auto-detection was incorrect" },
  { value: "other", label: "Other reason" },
];

export default function TimezoneConfirmationModal({ 
  open, 
  onClose, 
  currentTimezone,
  newTimezone,
  validationData,
  onSuccess
}: TimezoneConfirmationModalProps) {
  const [changeReason, setChangeReason] = useState<string>("");
  const { toast } = useToast();

  const updateTimezoneMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest({
        method: "PUT",
        url: "/api/business/timezone",
        data: {
          timezone: newTimezone,
          confirmed: true,
          reason: changeReason || undefined
        }
      });
      return res.json();
    },
    onSuccess: (data) => {
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update timezone",
        variant: "destructive",
      });
    },
  });

  const handleConfirm = () => {
    updateTimezoneMutation.mutate();
  };

  const getTimezoneDisplayName = (timezone: string) => {
    const timezoneMap: Record<string, string> = {
      "America/New_York": "Eastern Time",
      "America/Chicago": "Central Time", 
      "America/Denver": "Mountain Time",
      "America/Los_Angeles": "Pacific Time",
      "America/Anchorage": "Alaska Time",
      "Pacific/Honolulu": "Hawaii Time"
    };
    
    return timezoneMap[timezone] || timezone;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            Confirm Timezone Change
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Change Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">You're changing from:</h3>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{getTimezoneDisplayName(currentTimezone)}</span>
              <span className="text-gray-400">→</span>
              <span className="font-medium text-blue-600">{getTimezoneDisplayName(newTimezone)}</span>
            </div>
          </div>

          {/* Impact Summary */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">This will affect:</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span>All future campaign scheduling</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span>Business hours for SMS commands</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span>Quiet hours compliance rules</span>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {validationData?.warnings && validationData.warnings.length > 0 && (
            <div>
              <h3 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Important Notes:
              </h3>
              <div className="space-y-2">
                {validationData.warnings.map((warning, index) => (
                  <div key={index} className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
                    • {warning}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reason for Change */}
          <div>
            <Label htmlFor="change-reason" className="text-sm font-medium text-gray-700">
              Reason for change (optional)
            </Label>
            <Select value={changeReason} onValueChange={setChangeReason}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {CHANGE_REASONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Confirmation Text */}
          <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-md p-3">
            <strong>Are you sure you want to make this change?</strong>
            <div className="mt-1">
              This will immediately update your business timezone and affect all future messaging.
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={updateTimezoneMutation.isPending}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={updateTimezoneMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {updateTimezoneMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Updating...
              </>
            ) : (
              "Yes, Update Timezone"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 