import ChatBubble from "@/components/shared/ChatBubble";

interface SmsPreviewProps {
  message: string;
}

export default function SmsPreview({ message }: SmsPreviewProps) {
  const truncated = message.length > 160 ? message.slice(0, 160) + "..." : message;
  const showWarning = message.length > 160;
  return (
    <div className="w-[300px] mx-auto lg:mx-0">
      <div className="bg-gray-100 p-4 rounded-xl border">
        <div className="h-[500px] bg-white rounded-lg p-4 flex flex-col justify-end">
          <ChatBubble message={truncated || "Your message preview"} incoming />
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
