import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityItem } from "./activity-item";
import { MessageSquare, Plus } from "lucide-react";
import { Link } from "wouter";
import type { RecentInboxMessage } from "@shared/api-types";

interface RecentInboxMessagesCardProps {
  messages: RecentInboxMessage[];
  isLoading?: boolean;
}

export function RecentInboxMessagesCard({ messages, isLoading }: RecentInboxMessagesCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Inbox Messages</CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
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

  if (messages.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Recent Inbox Messages</CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <MessageSquare className="w-8 h-8 mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500 mb-2">
              No new messages yet
            </p>
            <p className="text-xs text-gray-400">
              Check your inbox to stay connected!
            </p>
            <Link
              href="/inbox"
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-2"
            >
              <Plus className="w-3 h-3" />
              Go to Inbox
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Inbox Messages</CardTitle>
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {messages.map((message) => (
            <div key={message.id} className="space-y-2">
              <ActivityItem
                title={message.contactName || message.phoneNumber}
                subtitle={message.content.length > 50 ? `${message.content.substring(0, 50)}...` : message.content}
                timestamp={message.createdAt}
                href={`/inbox`}
              />
              <div className="ml-4">
                <Link
                  href={`/inbox`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                >
                  <MessageSquare className="w-3 h-3" />
                  Respond Now
                </Link>
              </div>
            </div>
          ))}
        </div>
        {messages.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <Link
              href="/inbox"
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
            >
              View all messages
              <MessageSquare className="w-3 h-3" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 