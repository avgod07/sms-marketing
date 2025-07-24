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
  
  // For SMS: show full message (Twilio handles segmentation automatically)
  // For MMS: also show full message since MMS supports up to 1600 chars
  const displayMessage = message || "This is how your message will appear to customers.";
  
  return (
    <div className="w-[300px] mx-auto lg:mx-0">
      <div className="bg-gray-200 p-4 rounded-3xl">
        <div className="relative h-[500px] bg-white rounded-2xl flex flex-col justify-between">
          <span className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-gray-300 rounded-full" />
          <div className="flex-1 pt-6 pb-2 pl-2 pr-4 flex flex-col items-start">
            {messageInfo.type === 'MMS' && imageUrl && (
              <img
                src={imageUrl}
                alt="MMS Preview"
                className="mb-2 max-h-40 rounded border object-contain bg-gray-50"
                style={{ maxWidth: '100%' }}
              />
            )}
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
      
      {/* Status indicator */}
      <div className="mt-2 text-center">
        <div className="flex items-center justify-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            messageInfo.type === 'MMS' ? 'bg-purple-500' : 
            messageInfo.segments > 1 ? 'bg-orange-500' : 'bg-green-500'
          }`} />
          <span className="text-xs font-medium text-gray-700">
            {formatMessageTypeDisplay(messageInfo)} • {message.length} chars
          </span>
        </div>
        
        {/* Encoding indicator for multi-segment SMS */}
        {messageInfo.type === 'SMS' && messageInfo.segments > 1 && (
          <p className="text-xs text-orange-600 mt-1">
            {messageInfo.encoding} encoding • ~{messageInfo.charactersPerSegment} chars/segment
          </p>
        )}
        
        {/* MMS indicator */}
        {messageInfo.type === 'MMS' && (
          <p className="text-xs text-purple-600 mt-1">
            {getCostExplanation(messageInfo, !!imageUrl)}
          </p>
        )}
        
        {/* Single SMS indicator */}
        {messageInfo.type === 'SMS' && messageInfo.segments === 1 && (
          <p className="text-xs text-green-600 mt-1">
            Single SMS • {messageInfo.encoding} encoding
          </p>
        )}
        
        {/* Character limit warning for SMS */}
        {messageInfo.type === 'SMS' && !imageUrl && (
          <div className="mt-1">
            {message.length > messageInfo.characterLimit - 20 && (
              <p className="text-xs text-yellow-600">
                {messageInfo.characterLimit - message.length} chars remaining in segment
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
