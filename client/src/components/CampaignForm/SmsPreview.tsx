import ChatBubble from "@/components/shared/ChatBubble";
import { 
  calculateTwilioSegmentation, 
  formatMessageTypeDisplay, 
  getCostExplanation 
} from "@/lib/twilio-segmentation";

interface SmsPreviewProps {
  message: string;
  imageUrl?: string;
}

export default function SmsPreview({ message, imageUrl }: SmsPreviewProps) {
  const messageInfo = calculateTwilioSegmentation(message, !!imageUrl);
  
  const displayMessage = message || "This is how your message will appear to customers.";
  
  return (
    <div className="w-[300px] mx-auto lg:mx-0">
      <div className="bg-gray-200 p-4 rounded-3xl">
        <div className="relative h-[500px] bg-white rounded-2xl flex flex-col justify-between">
          <span className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-gray-300 rounded-full" />
          <div className="flex-1 pt-6 pb-2 pl-2 pr-4 flex flex-col items-start overflow-y-auto">
            {messageInfo.type === 'MMS' && imageUrl && (
              <img
                src={imageUrl}
                alt="MMS Preview"
                className="mb-2 max-h-40 rounded border object-contain bg-gray-50"
                style={{ maxWidth: '100%' }}
              />
            )}
            
            {/* Always show as one message - how recipients actually see it */}
            <ChatBubble
              incoming
              message={displayMessage}
              className="text-xs"
            />
          </div>
          <div className="px-4 pb-4">
            <div className="h-8 border border-gray-300 rounded-full bg-white" />
          </div>
        </div>
      </div>
      
      {/* Simplified status indicator */}
      <div className="mt-2 text-center">
        <div className="flex items-center justify-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            messageInfo.type === 'MMS' ? 'bg-purple-500' : 
            messageInfo.segments > 1 ? 'bg-orange-500' : 'bg-green-500'
          }`} />
          <span className="text-xs font-medium text-gray-700">
            {messageInfo.type === 'MMS' ? `MMS • ${message.length} chars` :
             messageInfo.segments === 1 ? `SMS • ${message.length} chars` :
             `${messageInfo.segments} SMS parts • ${message.length} chars`}
          </span>
        </div>
        
        {/* Cost explanation */}
        {messageInfo.type === 'MMS' && (
          <p className="text-xs text-purple-600 mt-1">
            3 credits (includes image)
          </p>
        )}
        
        {messageInfo.type === 'SMS' && messageInfo.segments === 1 && (
          <p className="text-xs text-green-600 mt-1">
            1 credit
          </p>
        )}
        
        {messageInfo.type === 'SMS' && messageInfo.segments > 1 && (
          <p className="text-xs text-orange-600 mt-1">
            {messageInfo.credits} credits ({messageInfo.segments} parts)
          </p>
        )}
      </div>
    </div>
  );
}
