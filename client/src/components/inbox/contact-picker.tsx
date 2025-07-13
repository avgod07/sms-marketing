import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, User, Phone } from "lucide-react";
import { formatPhoneNumber } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import type { Contact } from "@shared/schema";

interface ContactPickerProps {
  onSelect: (contact: Contact) => void;
  selectedContact?: Contact | null;
}

export default function ContactPicker({ onSelect, selectedContact }: ContactPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const trimmedSearch = debouncedSearch.trim();

  const { data: contacts, isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts", { search: trimmedSearch }],
  });

  // Filter only active contacts
  const activeContacts = contacts?.filter(contact => contact.active) || [];

  const filteredContacts = activeContacts.filter(contact => {
    if (!trimmedSearch) return true;
    const searchTarget = `${contact.firstName} ${contact.lastName} ${contact.phoneNumber}`.toLowerCase();
    return searchTarget.includes(trimmedSearch.toLowerCase());
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3 p-3 rounded-lg border animate-pulse">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>
      
      <div className="max-h-80 overflow-y-auto space-y-2">
        {filteredContacts.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {activeContacts.length === 0 ? "No active contacts" : "No contacts match your search"}
            </h3>
            <p className="text-gray-500">
              {activeContacts.length === 0
                ? "Add some contacts first to start messaging"
                : "Try adjusting your search terms"}
            </p>
          </div>
        ) : (
          filteredContacts.map((contact) => (
            <Button
              key={contact.id}
              variant={selectedContact?.id === contact.id ? "default" : "ghost"}
              className="w-full justify-start p-3 h-auto"
              onClick={() => onSelect(contact)}
            >
              <div className="flex items-center space-x-3 w-full">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-blue-100 text-blue-600 font-medium">
                    {contact.firstName[0]}{contact.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900">
                    {contact.firstName} {contact.lastName}
                  </p>
                  <div className="flex items-center space-x-1 text-sm text-gray-500">
                    <Phone className="w-3 h-3" />
                    <span>{formatPhoneNumber(contact.phoneNumber)}</span>
                  </div>
                </div>
              </div>
            </Button>
          ))
        )}
      </div>
    </div>
  );
} 