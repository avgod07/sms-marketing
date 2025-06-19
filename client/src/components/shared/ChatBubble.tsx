import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  message: string;
  incoming?: boolean;
  timestamp?: string;
  className?: string;
}

export default function ChatBubble({
  message,
  incoming = false,
  timestamp,
  className,
}: ChatBubbleProps) {
  return (
    <div className={cn("flex flex-col space-y-1", incoming ? "items-start" : "items-end")}> 
      <div
        className={cn(
          "max-w-xs rounded-2xl px-4 py-2 text-sm",
          incoming ? "bg-gray-100 text-gray-900" : "bg-blue-500 text-white",
          className
        )}
      >
        {message}
      </div>
      {timestamp && (
        <span className="text-xs text-gray-500">{timestamp}</span>
      )}
    </div>
  );
}
