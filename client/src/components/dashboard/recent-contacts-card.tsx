import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityItem } from "./activity-item";
import { Users, Plus } from "lucide-react";
import { Link } from "wouter";
import type { RecentContact } from "@shared/api-types";

interface RecentContactsCardProps {
  contacts: RecentContact[];
  isLoading?: boolean;
}

export function RecentContactsCard({ contacts, isLoading }: RecentContactsCardProps) {
  if (isLoading) {
    return (
      <Card className="card-hover">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Contacts</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (contacts.length === 0) {
    return (
      <Card className="card-hover">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Contacts</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Users className="w-8 h-8 mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500 mb-2">
              No new contacts yet
            </p>
            <p className="text-xs text-gray-400">
              Start building your list!
            </p>
            <Link
              href="/contacts"
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-2"
            >
              <Plus className="w-3 h-3" />
              Add Contact
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-hover">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Contacts</CardTitle>
        <Users className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {contacts.map((contact) => {
            const displayName = contact.firstName && contact.lastName
              ? `${contact.firstName} ${contact.lastName}`
              : contact.firstName || contact.lastName || contact.phoneNumber;
            
            const subtitle = contact.firstName || contact.lastName
              ? contact.phoneNumber
              : contact.email || undefined;

            return (
              <ActivityItem
                key={contact.id}
                title={displayName}
                subtitle={subtitle}
                timestamp={contact.createdAt}
                href={`/contacts/${contact.id}`}
              />
            );
          })}
        </div>
        {contacts.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <Link
              href="/contacts"
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
            >
              View all contacts
              <Plus className="w-3 h-3" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 