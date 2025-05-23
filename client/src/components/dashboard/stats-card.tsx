import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { formatNumber, formatPercentage } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  iconColor: string;
  iconBgColor: string;
  isPercentage?: boolean;
}

export default function StatsCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor,
  iconBgColor,
  isPercentage = false,
}: StatsCardProps) {
  const formattedValue = isPercentage 
    ? formatPercentage(Number(value))
    : typeof value === 'number' 
      ? formatNumber(value) 
      : value;

  return (
    <Card className="card-hover">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-600 font-medium">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{formattedValue}</p>
          </div>
          <div className={`w-12 h-12 ${iconBgColor} rounded-full flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
        </div>
        {change !== undefined && (
          <div className="flex items-center text-sm">
            <span className="text-green-600 font-medium">
              {change > 0 ? '+' : ''}{change}%
            </span>
            {changeLabel && (
              <span className="text-gray-500 ml-1">{changeLabel}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
