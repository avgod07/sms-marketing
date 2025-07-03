import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  current: number;
  steps: string[];
}

export default function StepIndicator({ current, steps }: StepIndicatorProps) {
  return (
    <div className="flex justify-between items-center max-w-lg mx-auto mb-8">
      {steps.map((label, idx) => {
        const stepNum = idx + 1;
        const active = stepNum <= current;
        return (
          <div key={label} className="flex-1 flex flex-col items-center">
            <div
              className={cn(
                "w-4 h-4 rounded-full",
                active ? "bg-primary" : "bg-gray-300"
              )}
            />
            <span className="text-xs mt-2 text-center text-gray-700 line-clamp-1">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
