import ChatBubble from "@/components/shared/ChatBubble";

interface SmsPreviewProps {
  message: string;
}

export default function SmsPreview({ message }: SmsPreviewProps) {
  const truncated = message.length > 160 ? message.slice(0, 160) + "..." : message;
  const showWarning = message.length > 160;
  return (
    <div className="w-[300px] mx-auto lg:mx-0">
      <div className="bg-black p-4 rounded-3xl">
        <div className="relative h-[500px] bg-gray-900 rounded-2xl flex flex-col justify-end">
          <span className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-gray-700 rounded-full" />
          <div className="px-4 pb-4 flex justify-end">
            <ChatBubble message={truncated || "Your message preview will appear here"} className="text-sm" />
          </div>
        </div>
      </div>
      {showWarning && (
        <p className="text-xs text-red-500 mt-2 text-center">
          SMS messages are limited to 160 characters.
        </p>
      )}
    </div>
  );
}
