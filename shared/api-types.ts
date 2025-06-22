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
  twilioConfigured: boolean;
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


export interface CampaignSendSummary {
  sentCount: number;
  failedCount: number;
  totalContacts: number;
}
