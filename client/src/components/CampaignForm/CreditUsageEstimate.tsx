import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calculator, Users, MessageSquare, Image } from "lucide-react";
import type { ContactStats } from "@shared/api-types";
import { 
  calculateTwilioSegmentation
} from "@/lib/twilio-segmentation";
import { useAuth } from "@/hooks/use-auth";

interface CreditUsageEstimateProps {
  hasImage: boolean;
  message: string;
}

export default function CreditUsageEstimate({ hasImage, message }: CreditUsageEstimateProps) {
  const { data: user } = useAuth();
  
  const { data: contactStats, isLoading } = useQuery<ContactStats>({
    queryKey: ["/api/contacts/stats"],
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Calculator className="w-4 h-4 text-blue-600 animate-pulse" />
            <span className="text-sm text-blue-600">Calculating credit usage...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const contactCount = contactStats?.allContacts || 0;
  
  // Always show contact warning when no contacts exist
  if (contactCount === 0) {
    return (
      <Alert className="border-yellow-200 bg-yellow-50">
        <Users className="w-4 h-4 text-yellow-600" />
        <AlertDescription className="text-yellow-800">
          No contacts found. Add contacts to your list to send campaigns.
        </AlertDescription>
      </Alert>
    );
  }
  
  // Don't show credit estimate for empty messages (but contacts warning was already handled above)
  if (!message.trim()) {
    return null;
  }
  
  // Use accurate Twilio segmentation
  const messageInfo = calculateTwilioSegmentation(message, hasImage);
  const creditsPerMessage = messageInfo.credits;
  const totalCredits = contactCount * creditsPerMessage;

  // Simple message type display
  const getMessageTypeDisplay = () => {
    if (messageInfo.type === 'MMS') return 'MMS';
    if (messageInfo.segments === 1) return 'SMS';
    return `${messageInfo.segments} SMS parts`;
  };

  const getExplanation = () => {
    if (messageInfo.type === 'MMS') {
      return 'MMS messages include images and cost 3 credits each';
    }
    if (messageInfo.segments === 1) {
      return 'Standard SMS message';
    }
    return `Long message split into ${messageInfo.segments} parts`;
  };

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="p-4">
        <div className="flex items-center space-x-2 mb-3">
          <Calculator className="w-4 h-4 text-blue-600" />
          <span className="font-medium text-blue-900">Estimated Credit Usage</span>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-blue-700">Active contacts:</span>
            </div>
            <span className="font-medium text-blue-900">{contactCount}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {messageInfo.type === 'MMS' ? (
                <Image className="w-4 h-4 text-blue-600" />
              ) : (
                <MessageSquare className="w-4 h-4 text-blue-600" />
              )}
              <span className="text-blue-700">Message type:</span>
            </div>
            <span className="font-medium text-blue-900">
              {getMessageTypeDisplay()}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calculator className="w-4 h-4 text-blue-600" />
              <span className="text-blue-700">Credits per message:</span>
            </div>
            <span className="font-medium text-blue-900">{creditsPerMessage}</span>
          </div>
          
          <div className="border-t border-blue-200 pt-2 mt-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-blue-900">Total estimated credits:</span>
              <span className="text-lg font-bold text-blue-900">{totalCredits}</span>
            </div>
          </div>
        </div>
        
        <p className="text-xs text-blue-700 mt-3">
          {getExplanation()}
        </p>
      </CardContent>
    </Card>
  );
} 