import ChatBubble from "@/components/shared/ChatBubble";

interface SmsPreviewProps {
  message: string;
  imageUrl?: string;
}

export default function SmsPreview({ message, imageUrl }: SmsPreviewProps) {
  const isLongMessage = message.length > 160;
  const isMMS = !!imageUrl || isLongMessage;
  
  // For SMS: truncate at 160, for MMS: show full message
  const displayMessage = isMMS ? message : (message.length > 160 ? message.slice(0, 160) + "..." : message);
  
  return (
    <div className="w-[300px] mx-auto lg:mx-0">
      <div className="bg-gray-200 p-4 rounded-3xl">
        <div className="relative h-[500px] bg-white rounded-2xl flex flex-col justify-between">
          <span className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-gray-300 rounded-full" />
          <div className="flex-1 pt-6 pb-2 pl-2 pr-4 flex flex-col items-start">
            {isMMS && imageUrl && (
              <img
                src={imageUrl}
                alt="MMS Preview"
                className="mb-2 max-h-40 rounded border object-contain bg-gray-50"
                style={{ maxWidth: '100%' }}
              />
            )}
            <ChatBubble
              incoming
              message={displayMessage || "This is how your message will appear to customers."}
              className="text-xs"
            />
          </div>
          <div className="px-4 pb-4">
            <div className="h-8 border border-gray-300 rounded-full bg-white" />
          </div>
        </div>
      </div>
      
      {/* Status indicator */}
      <div className="mt-2 text-center">
        <div className="flex items-center justify-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isMMS ? 'bg-purple-500' : 'bg-green-500'}`} />
          <span className="text-xs font-medium text-gray-700">
            {isMMS ? 'MMS' : 'SMS'} ({message.length} characters)
          </span>
        </div>
        
        {isMMS && (
          <p className="text-xs text-purple-600 mt-1">
            {isLongMessage && imageUrl ? 'MMS due to length & image' :
             isLongMessage ? 'MMS due to length >160 chars' :
             'MMS due to attached image'}
          </p>
        )}
        
        {!isMMS && message.length > 140 && (
          <p className="text-xs text-yellow-600 mt-1">
            {160 - message.length} characters remaining for SMS
          </p>
        )}
      </div>
    </div>
  );
}
