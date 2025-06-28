import { useQuery } from "@tanstack/react-query";
import type {
  RecentContact,
  RecentCampaign,
  RecentMessage,
  RecentInboxMessage,
} from "@shared/api-types";

export function useRecentActivity() {
  const {
    data: contacts,
    isLoading: contactsLoading,
    isError: contactsError,
  } = useQuery<RecentContact[]>({
    queryKey: ["/api/contacts/recent"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const {
    data: campaigns,
    isLoading: campaignsLoading,
    isError: campaignsError,
  } = useQuery<RecentCampaign[]>({
    queryKey: ["/api/campaigns/recent"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const {
    data: messages,
    isLoading: messagesLoading,
    isError: messagesError,
  } = useQuery<RecentMessage[]>({
    queryKey: ["/api/messages/recent"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const {
    data: inboxMessages,
    isLoading: inboxMessagesLoading,
    isError: inboxMessagesError,
  } = useQuery<RecentInboxMessage[]>({
    queryKey: ["/api/messages/inbox/recent"],
    staleTime: 5 * 60 * 1000, // 5 minutes
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
