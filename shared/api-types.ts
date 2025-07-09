export interface DashboardStats {
  totalContacts: number;
  messagesSent: number;
  activeCampaigns: number;
  deliveryRate: number;
  contactsChange: number | null;
  messagesChange: number | null;
  campaignsChange: number | null;
  deliveryRateChange: number | null;
}

export interface ContactStats {
  allContacts: number;
}

export interface CampaignStats {
  activeCampaigns: number;
  messagesThisMonth: number;
}

export interface SetupStatus {
  phoneConfigured: boolean;
  hasContacts: boolean;
  hasCoupons: boolean;
  onboardingComplete: boolean;
}

export interface ContactRedemption {
  id: number;
  couponId: number;
  code: string;
  note: string | null;
  createdAt: string | Date;
}

export interface TwilioSettings {
  accountSid: string;
  authToken: string;
  messagingServiceSid: string | null;
  phoneNumber: string | null;
}

export interface CampaignSendSummary {
  sentCount: number;
  failedCount: number;
  totalContacts: number;
}

// Recent Activity Types
export interface RecentContact {
  id: number;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string;
  email: string | null;
  createdAt: string;
}

export interface RecentCampaign {
  id: number;
  name: string;
  status: string;
  createdAt: string;
}

export interface RecentMessage {
  id: number;
  content: string;
  status: string;
  phoneNumber: string;
  contactId: number;
  contactName?: string;
  createdAt: string;
}

export interface RecentInboxMessage {
  id: number;
  content: string;
  status: string;
  phoneNumber: string;
  contactId: number;
  contactName?: string;
  createdAt: string;
}

export interface RecentActivity {
  contacts: RecentContact[];
  campaigns: RecentCampaign[];
  messages: RecentMessage[];
  inboxMessages: RecentInboxMessage[];
}
