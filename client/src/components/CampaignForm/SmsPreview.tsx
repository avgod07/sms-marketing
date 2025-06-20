import ChatBubble from "@/components/shared/ChatBubble";

interface SmsPreviewProps {
  message: string;
}

export default function SmsPreview({ message }: SmsPreviewProps) {
  const truncated = message.length > 160 ? message.slice(0, 160) + "..." : message;
  const showWarning = message.length > 160;
  return (
    <div className="w-[300px] mx-auto lg:mx-0">
      <div className="bg-gray-200 p-4 rounded-3xl">
        <div className="relative h-[500px] bg-white rounded-2xl flex flex-col justify-between">
          <span className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-gray-300 rounded-full" />
          <div className="flex-1 pt-6 pb-2 pl-2 pr-4 flex items-start">
            <ChatBubble
              incoming
              message={truncated || "This is how your message will appear to customers."}
              className="text-xs"
            />
          </div>
          <div className="px-4 pb-4">
            <div className="h-8 border border-gray-300 rounded-full bg-white" />
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
