import React, { useState, useEffect } from "react";
import { Clock, Calendar, AlertTriangle, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import type { SchedulingValidationResult } from "@shared/api-types";

export interface SchedulingOptions {
  mode: 'immediate' | 'scheduled';
  scheduledTime?: Date;
  scheduleNotes?: string;
}

interface TimingControlProps {
  value: SchedulingOptions;
  onChange: (options: SchedulingOptions) => void;
  disabled?: boolean;
  timezone?: string;
  businessHours?: string;
  className?: string;
}

export function TimingControl({
  value,
  onChange,
  disabled = false,
  timezone = "America/New_York",
  businessHours = "8 AM - 8 PM",
  className,
}: TimingControlProps) {
  const [validation, setValidation] = useState<SchedulingValidationResult | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);

  // Validate scheduling time when it changes
  useEffect(() => {
    if (value.mode === 'scheduled' && value.scheduledTime) {
      validateScheduleTime(value.scheduledTime);
    } else {
      setValidation(null);
    }
  }, [value.scheduledTime, value.mode]);

  const validateScheduleTime = async (scheduledTime: Date) => {
    try {
      setValidationLoading(true);
      const response = await apiRequest({
        method: 'POST',
        url: '/api/campaigns/validate-schedule',
        data: {
          scheduledSendTime: scheduledTime.toISOString()
        }
      });
      const result = await response.json();
      setValidation(result);
    } catch (error) {
      console.error('Failed to validate schedule time:', error);
      setValidation({
        isValid: false,
        errors: ['Failed to validate schedule time']
      });
    } finally {
      setValidationLoading(false);
    }
  };

  const handleModeChange = (mode: 'immediate' | 'scheduled') => {
    if (mode === 'immediate') {
      onChange({
        mode,
        scheduledTime: undefined,
        scheduleNotes: undefined
      });
    } else {
      onChange({
        ...value,
        mode,
        scheduledTime: value.scheduledTime || getDefaultScheduleTime()
      });
    }
  };

  const handleScheduledTimeChange = (date: Date | undefined) => {
    onChange({
      ...value,
      scheduledTime: date
    });
  };

  const handleNotesChange = (notes: string) => {
    onChange({
      ...value,
      scheduleNotes: notes || undefined
    });
  };

  const getDefaultScheduleTime = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // Default to 9 AM tomorrow
    return tomorrow;
  };

  const formatCountdown = (scheduledTime: Date) => {
    const now = new Date();
    const diffMs = scheduledTime.getTime() - now.getTime();
    
    if (diffMs <= 0) return "Ready to send";
    
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
    
    if (days > 0) {
      return `in ${days} day${days !== 1 ? 's' : ''} and ${hours} hour${hours !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `in ${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      return `in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  };

  const getQuickSelectOptions = () => {
    const now = new Date();
    const options = [
      {
        label: "Tomorrow 9AM",
        date: (() => {
          const tomorrow = new Date(now);
          tomorrow.setDate(now.getDate() + 1);
          tomorrow.setHours(9, 0, 0, 0);
          return tomorrow;
        })()
      },
      {
        label: "Next Week",
        date: (() => {
          const nextWeek = new Date(now);
          nextWeek.setDate(now.getDate() + 7);
          nextWeek.setHours(9, 0, 0, 0);
          return nextWeek;
        })()
      },
      {
        label: "+1 Hour",
        date: new Date(now.getTime() + 60 * 60 * 1000)
      }
    ];
    
    return options.filter(option => option.date > now);
  };

  return (
    <div className={className}>
      {/* Form Field Label - matches other form fields */}
      <Label htmlFor="timing" className="text-sm font-medium">
        Timing Control
      </Label>
      
      {/* Radio Button Group */}
      <div className="mt-2 space-y-3">
        {/* Send Now Option */}
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="radio"
            name="timing"
            value="immediate"
            checked={value.mode === 'immediate'}
            onChange={() => handleModeChange('immediate')}
            disabled={disabled}
            className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">Send now</div>
            <div className="text-sm text-gray-500">
              Sends the moment you click "Create Campaign"
            </div>
          </div>
        </label>

        {/* Custom Date & Time Option */}
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="radio"
            name="timing"
            value="scheduled"
            checked={value.mode === 'scheduled'}
            onChange={() => handleModeChange('scheduled')}
            disabled={disabled}
            className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">Custom date & time</div>
            <div className="text-sm text-gray-500">
              Schedule for a specific date and time
            </div>
          </div>
        </label>
      </div>

      {/* Helper Text for Immediate Mode */}
      {value.mode === 'immediate' && (
        <div className="mt-2 text-sm text-gray-500">
          If sent outside business hours ({businessHours}), messages will be queued until the next business hour.
        </div>
      )}

      {/* Scheduling Options - Revealed when Custom Date selected */}
      {value.mode === 'scheduled' && (
        <div className="mt-4 space-y-4">
          {/* Scheduled Date & Time */}
          <div>
            <Label htmlFor="scheduledDateTime" className="text-sm font-medium">
              Scheduled Date & Time
            </Label>
            <div className="mt-1">
              <DateTimePicker
                value={value.scheduledTime}
                onChange={handleScheduledTimeChange}
                disabled={disabled}
                timezone={timezone}
                minDate={new Date()}
                placeholder="Select date and time"
              />
            </div>
            
            {/* Countdown Display */}
            {value.scheduledTime && (
              <div className="mt-1 text-sm text-gray-500">
                Will send {formatCountdown(value.scheduledTime)} • {timezone}
              </div>
            )}
          </div>

          {/* Quick Select Options */}
          <div>
            <Label className="text-sm font-medium text-gray-700">Quick Options</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {getQuickSelectOptions().map((option, index) => (
                <Button
                  key={index}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleScheduledTimeChange(option.date)}
                  disabled={disabled}
                  className="text-xs h-8 px-3"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Schedule Notes */}
          <div>
            <Label htmlFor="scheduleNotes" className="text-sm font-medium">
              Notes (Optional)
            </Label>
            <Textarea
              id="scheduleNotes"
              value={value.scheduleNotes || ''}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Add notes about this scheduled campaign..."
              disabled={disabled}
              rows={2}
              className="mt-1 text-sm resize-none"
            />
          </div>

          {/* Validation Loading */}
          {validationLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
              Validating schedule time...
            </div>
          )}

          {/* Validation Results */}
          {validation && !validationLoading && (
            <div className="space-y-2">
              {/* Errors */}
              {validation.errors && validation.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {validation.errors.join(". ")}
                  </AlertDescription>
                </Alert>
              )}

              {/* Warnings */}
              {validation.warnings && validation.warnings.length > 0 && (
                <Alert className="bg-orange-50 border-orange-200">
                  <Info className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-sm text-orange-800">
                    {validation.warnings.join(". ")}
                  </AlertDescription>
                </Alert>
              )}

              {/* Business Hours Impact */}
              {validation.businessHoursImpact?.isOutsideBusinessHours && (
                <div className="text-sm text-orange-600">
                  ⚠️ Scheduled outside business hours ({businessHours})
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 