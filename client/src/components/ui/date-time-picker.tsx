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
      return format(date, "PPP 'at' h:mm a");
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
          className="w-auto p-0 max-h-[400px] overflow-y-auto" 
          align="start"
          side="bottom"
          sideOffset={8}
          collisionPadding={10}
          avoidCollisions={true}
        >
          <div className="p-4 space-y-3">
            {/* Calendar */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Date</Label>
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
              />
            </div>

            {/* Time Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Time</Label>
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedHour} onValueChange={(value) => handleTimeChange(value, selectedMinute, selectedPeriod)}>
                  <SelectTrigger className="w-20">
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
                <span className="text-muted-foreground">:</span>
                <Select value={selectedMinute} onValueChange={(value) => handleTimeChange(selectedHour, value, selectedPeriod)}>
                  <SelectTrigger className="w-20">
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
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AM">AM</SelectItem>
                    <SelectItem value="PM">PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>



            {/* Action Buttons */}
            <div className="flex justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedDate(undefined);
                  onChange(undefined);
                  setIsOpen(false);
                }}
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => setIsOpen(false)}
                disabled={!selectedDate}
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