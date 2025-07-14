import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, User } from "lucide-react";
import { formatPhoneNumber } from "@/lib/utils";
import type { Contact } from "@shared/schema";

interface MessageComposeProps {
  contact: Contact;
  onSend: (message: string) => Promise<void>;
  onBack: () => void;
  isLoading?: boolean;
}

export default function MessageCompose({ contact, onSend, onBack, isLoading }: MessageComposeProps) {
  const [message, setMessage] = useState("");

  const handleSend = async () => {
    if (!message.trim()) return;
    
    try {
      await onSend(message.trim());
      setMessage(""); // Clear message after successful send
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-4">
      {/* Contact Header */}
      <div className="flex items-center space-x-3 p-3 border rounded-lg bg-gray-50">
        <Avatar className="w-10 h-10">
          <AvatarFallback className="bg-blue-100 text-blue-600 font-medium">
            {contact.firstName[0]}{contact.lastName[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="font-medium text-gray-900">
            {contact.firstName} {contact.lastName}
          </p>
          <p className="text-sm text-gray-500">
            {formatPhoneNumber(contact.phoneNumber)}
          </p>
        </div>
      </div>

      {/* Message Input */}
      <div className="space-y-2">
        <label htmlFor="message" className="text-sm font-medium text-gray-700">
          Message
        </label>
        <Textarea
          id="message"
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[100px] resize-none"
          maxLength={160}
        />
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>Press Enter to send, Shift+Enter for new line</span>
          <span className={message.length > 140 ? "text-red-500" : ""}>
            {message.length}/160
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isLoading}
        >
          Back to Contacts
        </Button>
        <Button
          onClick={handleSend}
          disabled={!message.trim() || isLoading}
          className="min-w-[100px]"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Send
            </>
          )}
        </Button>
      </div>
    </div>
  );
} 