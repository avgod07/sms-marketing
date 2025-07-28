import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type {
  RecentContact,
  RecentCampaign,
  RecentMessage,
  RecentInboxMessage,
} from "@shared/api-types";

export function useRecentActivity() {
  const { data: user } = useAuth();

  const {
    data: contacts,
    isLoading: contactsLoading,
    isError: contactsError,
  } = useQuery<RecentContact[]>({
    queryKey: ["/api/contacts/recent"],
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
  });

  const {
    data: campaigns,
    isLoading: campaignsLoading,
    isError: campaignsError,
  } = useQuery<RecentCampaign[]>({
    queryKey: ["/api/campaigns/recent"],
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
  });

  const {
    data: messages,
    isLoading: messagesLoading,
    isError: messagesError,
  } = useQuery<RecentMessage[]>({
    queryKey: ["/api/messages/recent"],
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
  });

  const {
    data: inboxMessages,
    isLoading: inboxMessagesLoading,
    isError: inboxMessagesError,
  } = useQuery<RecentInboxMessage[]>({
    queryKey: ["/api/messages/inbox/recent"],
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
  });

  return {
    contacts: contacts || [],
    campaigns: campaigns || [],
    messages: messages || [],
    inboxMessages: inboxMessages || [],
    isLoading:
      contactsLoading ||
      campaignsLoading ||
      messagesLoading ||
      inboxMessagesLoading,
    isError:
      contactsError || campaignsError || messagesError || inboxMessagesError,
  };
}
