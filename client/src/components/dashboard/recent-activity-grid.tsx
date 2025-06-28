import { RecentContactsCard } from "./recent-contacts-card";
import { RecentCampaignsCard } from "./recent-campaigns-card";
import { RecentInboxMessagesCard } from "./recent-inbox-messages-card";
import { useRecentActivity } from "@/hooks/useRecentActivity";

export function RecentActivityGrid() {
  const { contacts, campaigns, inboxMessages, isLoading, isError } = useRecentActivity();

  if (isError) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="col-span-full">
          <div className="text-center py-8 text-gray-500">
            <p>Failed to load recent activity</p>
            <p className="text-sm">Please try refreshing the page</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <RecentContactsCard contacts={contacts} isLoading={isLoading} />
      <RecentCampaignsCard campaigns={campaigns} isLoading={isLoading} />
      <RecentInboxMessagesCard messages={inboxMessages} isLoading={isLoading} />
    </div>
  );
} 