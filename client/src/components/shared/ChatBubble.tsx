import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  message: string;
  incoming?: boolean;
  timestamp?: string;
  status?: string;
  className?: string;
}

export default function ChatBubble({
  message,
  incoming = false,
  timestamp,
  status,
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
      {(timestamp || (!incoming && status)) && (
        <span className="text-xs text-gray-500">
          {timestamp}
          {!incoming && status ? ` · ${status}` : ""}
        </span>
      )}
    </div>
  );
}
