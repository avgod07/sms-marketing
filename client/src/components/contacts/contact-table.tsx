import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatPhoneNumber } from "@/lib/utils";
import { Contact } from "@shared/schema";
import { MoreHorizontal, Mail, Phone, Edit, Trash2 } from "lucide-react";

interface ContactTableProps {
  contacts: Contact[];
  isLoading: boolean;
  onEdit: (contact: Contact) => void;
  onViewRedemptions: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}

export default function ContactTable({ contacts, isLoading, onEdit, onViewRedemptions, onDelete }: ContactTableProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-4 border-b">
            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/3"></div>
            </div>
            <div className="h-6 bg-gray-200 rounded w-16"></div>
            <div className="h-6 bg-gray-200 rounded w-16"></div>
          </div>
        ))}
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Phone className="w-6 h-6 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts found</h3>
        <p className="text-gray-500">Get started by adding your first contact</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-medium text-gray-500">Contact</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Phone</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Email</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-4 px-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-medium">
                      {contact.firstName[0]}{contact.lastName[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {contact.firstName} {contact.lastName}
                    </p>
                  </div>
                </div>
              </td>
              <td className="py-4 px-4">
                <span className="text-gray-900">{formatPhoneNumber(contact.phoneNumber)}</span>
              </td>
              <td className="py-4 px-4">
                {contact.email ? (
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900">{contact.email}</span>
                  </div>
                ) : (
                  <span className="text-gray-400">No email</span>
                )}
              </td>
              <td className="py-4 px-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onEdit(contact)}>
                      <Edit className="mr-2 h-4 w-4" /> Edit Contact
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onViewRedemptions(contact)}>
                      View Redemptions
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => onDelete(contact)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
