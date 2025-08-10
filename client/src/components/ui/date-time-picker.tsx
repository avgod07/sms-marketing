import React, { useState, useEffect } from "react";
import { format, parseISO, addDays, setHours, setMinutes } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DateTimePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  timezone?: string;
  minDate?: Date;
  maxDate?: Date;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date and time",
  disabled = false,
  className,
  timezone,
  minDate,
  maxDate,
}: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(value);
  const [selectedHour, setSelectedHour] = useState<string>("09");
  const [selectedMinute, setSelectedMinute] = useState<string>("00");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("AM");
  const [isOpen, setIsOpen] = useState(false);

  // Initialize time values from the current value
  useEffect(() => {
    if (value) {
      setSelectedDate(value);
      const hour = value.getHours();
      const minute = value.getMinutes();
      
      // Convert to 12-hour format
      const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const period = hour >= 12 ? "PM" : "AM";
      
      setSelectedHour(hour12.toString().padStart(2, '0'));
      setSelectedMinute(minute.toString().padStart(2, '0'));
      setSelectedPeriod(period);
    }
  }, [value]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      setSelectedDate(undefined);
      onChange(undefined);
      return;
    }

    setSelectedDate(date);
    updateDateTime(date, selectedHour, selectedMinute, selectedPeriod);
  };

  const handleTimeChange = (hour: string, minute: string, period: string) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
    setSelectedPeriod(period);

    if (selectedDate) {
      updateDateTime(selectedDate, hour, minute, period);
    }
  };

  const updateDateTime = (date: Date, hour: string, minute: string, period: string) => {
    // Convert 12-hour to 24-hour format
    let hour24 = parseInt(hour);
    if (period === "PM" && hour24 !== 12) {
      hour24 += 12;
    } else if (period === "AM" && hour24 === 12) {
      hour24 = 0;
    }

    const newDateTime = setMinutes(setHours(date, hour24), parseInt(minute));
    onChange(newDateTime);
  };

  const handleQuickSelect = (hoursToAdd: number) => {
    const now = new Date();
    const futureDate = addDays(now, Math.floor(hoursToAdd / 24));
    const finalDate = setHours(setMinutes(futureDate, 0), (now.getHours() + (hoursToAdd % 24)) % 24);
    
    setSelectedDate(finalDate);
    const hour = finalDate.getHours();
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const period = hour >= 12 ? "PM" : "AM";
    
    setSelectedHour(hour12.toString().padStart(2, '0'));
    setSelectedMinute('00');
    setSelectedPeriod(period);
    onChange(finalDate);
    setIsOpen(false);
  };

  const formatDateTime = (date: Date) => {
    try {
      const baseFormat = format(date, "PPP 'at' h:mm a");
      if (timezone) {
        return `${baseFormat} (${timezone})`;
      }
      return baseFormat;
    } catch {
      return "Invalid date";
    }
  };

  // Generate hour options
  const hourOptions = Array.from({ length: 12 }, (_, i) => {
    const hour = i + 1;
    return hour.toString().padStart(2, '0');
  });

  // Generate minute options (every 15 minutes)
  const minuteOptions = ['00', '15', '30', '45'];

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal",
              !value && "text-muted-foreground",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? formatDateTime(value) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0 max-w-[420px] sm:max-w-[380px] max-h-[85vh] overflow-hidden" 
          align="start"
          side="bottom"
          sideOffset={8}
          avoidCollisions={true}
          collisionPadding={16}
        >
          <div className="p-3 sm:p-4 space-y-3 max-h-[calc(85vh-2rem)] overflow-y-auto">
            {/* Quick Select Options - Always visible at top */}
            <div className="space-y-2 flex-shrink-0">
              <Label className="text-sm font-medium">Quick Select</Label>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSelect(1)}
                  className="text-xs h-8"
                >
                  In 1 hour
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSelect(24)}
                  className="text-xs h-8"
                >
                  Tomorrow
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSelect(168)}
                  className="text-xs h-8"
                >
                  Next week
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const nextMonday = addDays(new Date(), ((1 + 7 - new Date().getDay()) % 7));
                    const scheduled = setMinutes(setHours(nextMonday, 9), 0);
                    handleDateSelect(scheduled);
                  }}
                  className="text-xs h-8"
                >
                  Mon 9 AM
                </Button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="space-y-3 overflow-y-auto flex-1">
              {/* Calendar */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Date</Label>
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    disabled={(date) => {
                      if (minDate && date < minDate) return true;
                      if (maxDate && date > maxDate) return true;
                      return date < new Date(new Date().setHours(0, 0, 0, 0));
                    }}
                    initialFocus
                    className="rounded-md border"
                  />
                </div>
              </div>

              {/* Time Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Time</Label>
                <div className="flex items-center justify-center space-x-1 sm:space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Select value={selectedHour} onValueChange={(value) => handleTimeChange(value, selectedMinute, selectedPeriod)}>
                    <SelectTrigger className="w-16 sm:w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {hourOptions.map((hour) => (
                        <SelectItem key={hour} value={hour}>
                          {hour}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground text-sm">:</span>
                  <Select value={selectedMinute} onValueChange={(value) => handleTimeChange(selectedHour, value, selectedPeriod)}>
                    <SelectTrigger className="w-16 sm:w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {minuteOptions.map((minute) => (
                        <SelectItem key={minute} value={minute}>
                          {minute}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedPeriod} onValueChange={(value) => handleTimeChange(selectedHour, selectedMinute, value)}>
                    <SelectTrigger className="w-16 sm:w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Timezone Display */}
              {timezone && (
                <div className="text-xs sm:text-sm text-muted-foreground text-center">
                  Timezone: {timezone}
                </div>
              )}
            </div>

            {/* Action Buttons - Always visible at bottom */}
            <div className="flex justify-between pt-2 border-t flex-shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedDate(undefined);
                  onChange(undefined);
                  setIsOpen(false);
                }}
                className="flex-1 sm:flex-none"
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => setIsOpen(false)}
                disabled={!selectedDate}
                className="flex-1 sm:flex-none"
              >
                Done
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
} 