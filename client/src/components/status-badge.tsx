import { cn, getStatusColor } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
  className?: string;
  children?: React.ReactNode;
}

export default function StatusBadge({ status, className, children }: StatusBadgeProps) {
  return (
    <Badge className={cn(getStatusColor(status), className)}>
      {children ?? status}
    </Badge>
  );
}
