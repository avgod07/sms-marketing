import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Edit, Trash2, MoreHorizontal } from "lucide-react";
import type { Contact } from "@shared/schema";

interface ContactActionMenuProps {
  contact: Contact;
  onEdit: (contact: Contact) => void;
  onViewRedemptions: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}

export default function ContactActionMenu({
  contact,
  onEdit,
  onViewRedemptions,
  onDelete,
}: ContactActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Open contact actions">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onEdit(contact)} aria-label="Edit contact" role="menuitem">
          <Edit className="mr-2 h-4 w-4" /> Edit Contact
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onViewRedemptions(contact)} aria-label="View redemptions" role="menuitem">
          View Redemptions
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onDelete(contact)} className="text-red-600 focus:text-red-600" aria-label="Delete contact" role="menuitem">
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
