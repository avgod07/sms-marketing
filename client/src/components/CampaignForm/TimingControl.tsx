import React, { useState, useEffect } from "react";
import { Clock, Calendar, AlertTriangle, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useBusinessHours } from "@/hooks/use-business-hours";
import type { SchedulingValidationResult } from "@shared/api-types";
import type { BusinessHoursCheck } from "@/services/business-hours";

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

  // Check current business hours status using shared hook
  const { data: hoursCheck } = useBusinessHours();

  const canCreateImmediate = hoursCheck?.isBusinessHours ?? true; // Default to true while loading

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
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to validate schedule time';
        
        // Handle specific error types
        if (response.status === 403) {
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.code === 'TFV_NOT_VERIFIED') {
              errorMessage = errorData.message || 'Business verification required. Messaging features will be available once your verification is approved.';
            } else {
              errorMessage = errorData.message || 'Access denied. Please check your account permissions.';
            }
          } catch {
            errorMessage = 'Access denied. Please check your account permissions.';
          }
        } else if (response.status === 401) {
          errorMessage = 'Session expired. Please refresh the page and try again.';
        } else if (response.status === 404) {
          errorMessage = 'Business configuration not found. Please contact support.';
        } else if (response.status === 500) {
          errorMessage = 'Service temporarily unavailable. Please try again in a moment.';
        } else {
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorMessage;
          } catch {
            // If not JSON, use the text response or default message
            errorMessage = errorText || errorMessage;
          }
        }
        
        throw new Error(`${response.status}: ${errorMessage}`);
      }
      
      const result = await response.json();
      setValidation(result);
    } catch (error) {
      console.error('Schedule validation failed:', error);
      
      // Extract meaningful error message
      let errorMessage = 'Failed to validate schedule time';
      if (error instanceof Error) {
        if (error.message.includes('Network error') || error.message.includes('fetch')) {
          errorMessage = 'Connection issue. Please check your internet connection and try again.';
        } else if (error.message.includes('403:')) {
          // Extract TFV or permission error message
          errorMessage = error.message.split(':', 2)[1]?.trim() || 'Access denied. Please check your account permissions.';
        } else if (error.message.includes('401:')) {
          errorMessage = 'Session expired. Please refresh the page and try again.';
        } else if (error.message.includes('404:')) {
          errorMessage = 'Business configuration not found. Please contact support.';
        } else if (error.message.includes('500:')) {
          errorMessage = 'Service temporarily unavailable. Please try again in a moment.';
        } else if (error.message.includes(':')) {
          // Extract message after status code
          errorMessage = error.message.split(':', 2)[1]?.trim() || errorMessage;
        }
      }
      
      setValidation({
        isValid: false,
        errors: [errorMessage]
      });
    } finally {
      setValidationLoading(false);
    }
  };

  const handleModeChange = (mode: 'immediate' | 'scheduled') => {
    // Prevent switching to immediate mode outside business hours
    if (mode === 'immediate' && !canCreateImmediate) {
      return;
    }

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
      
      <Card className="border-gray-200 bg-white">
        <CardContent className="p-4">
          {/* Radio Button Group */}
          <div className="space-y-3">
          {/* Send Now Option */}
          <label className={`flex items-center space-x-3 ${!canCreateImmediate ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
            <input
              type="radio"
              name="timing"
              value="immediate"
              checked={value.mode === 'immediate'}
              onChange={() => handleModeChange('immediate')}
              disabled={disabled || !canCreateImmediate}
              className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">Send now</div>
              <div className="text-sm text-gray-500">
                {canCreateImmediate 
                  ? "Sends the moment you click \"Create Campaign\""
                  : "Available during business hours only (8 AM - 8 PM)"
                }
              </div>
            </div>
          </label>

          {/* Business Hours Warning */}
          {!canCreateImmediate && (
            <div className="ml-7 text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
              ⏰ <strong>Outside business hours</strong> • Current business time: {hoursCheck?.currentTime}
              {hoursCheck?.nextBusinessHour && (
                <> • Next available: {hoursCheck.nextBusinessHour}</>
              )}
            </div>
          )}

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
              <Label className="text-sm font-medium">Quick Select</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {getQuickSelectOptions().map((option, index) => (
                  <Button
                    key={index}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleScheduledTimeChange(option.date)}
                    disabled={disabled}
                    className="text-xs"
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
                  value={value.scheduleNotes || ""}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  disabled={disabled}
                  placeholder="Add any notes about this scheduled campaign..."
                  className="mt-1"
                  rows={2}
                />
            </div>

            {/* Validation Results */}
            {validationLoading && (
              <div className="text-sm text-gray-500">
                Validating schedule time...
              </div>
            )}

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
        </CardContent>
      </Card>
    </div>
  );
} 