import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { handleApiError, extractSubscriptionError } from "@/lib/handleApiError";
import { emitMessageSend } from "@/lib/socket";
import { SubscriptionErrorDialog } from "@/components/subscription-error-dialog";
import ContactPicker from "./contact-picker";
import MessageCompose from "./message-compose";
import type { Contact } from "@shared/schema";
import type { Message as ApiMessage } from "@shared/schema";

interface NewMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMessageSent?: (message: ApiMessage) => void;
  preSelectedContact?: Contact | null;
}

export default function NewMessageModal({ 
  isOpen, 
  onClose, 
  onMessageSent,
  preSelectedContact 
}: NewMessageModalProps) {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(preSelectedContact || null);
  const [isLoading, setIsLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<{
    message: string;
    code: string;
    guidance?: string;
    currentPlan?: string;
    trialUsed?: boolean;
    upgradeUrl?: string;
  } | null>(null);
  const { toast } = useToast();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedContact(preSelectedContact || null);
    } else {
      setSelectedContact(null);
    }
  }, [isOpen, preSelectedContact]);

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
  };

  const handleBackToContacts = () => {
    setSelectedContact(null);
  };

  const handleSendMessage = async (message: string) => {
    if (!selectedContact) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: selectedContact.id,
          phoneNumber: selectedContact.phoneNumber,
          content: message,
          status: "sent",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle subscription errors with dialog
        if (response.status === 403) {
          const subscriptionErr = extractSubscriptionError(errorData);
          if (subscriptionErr) {
            setSubscriptionError(subscriptionErr);
            return;
          }
        }
        
        // Handle insufficient credits error specifically
        if (response.status === 402 && errorData.code === "INSUFFICIENT_CREDITS") {
          toast({
            title: "Insufficient Credits",
            description: "You don't have enough credits to send this message. Please purchase more credits in Settings.",
            variant: "destructive",
          });
          return;
        }
        
        throw new Error(errorData.message || "Failed to send message");
      }

      const result = await response.json();
      const savedMessage: ApiMessage = result;
      
      // Emit the message via socket for real-time updates
      emitMessageSend(savedMessage);
      
      // Notify parent component
      if (onMessageSent) {
        onMessageSent(savedMessage);
      }

      toast({
        title: "Message sent successfully",
        description: `Your message was sent to ${selectedContact.firstName} ${selectedContact.lastName}. Credits used: ${result.creditCost || 1}`,
      });

      // Close modal after successful send
      onClose();
    } catch (error) {
      toast({
        title: "Failed to send message",
        description: handleApiError(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedContact ? "Send Message" : "New Message"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            {!selectedContact ? (
              <ContactPicker 
                onSelect={handleContactSelect}
                selectedContact={selectedContact}
              />
            ) : (
              <MessageCompose
                contact={selectedContact}
                onSend={handleSendMessage}
                onBack={handleBackToContacts}
                isLoading={isLoading}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SubscriptionErrorDialog
        open={!!subscriptionError}
        onOpenChange={(open) => !open && setSubscriptionError(null)}
        error={subscriptionError || undefined}
      />
    </>
  );
} 