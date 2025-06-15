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
  inactive: number;
  activeContacts: number;
}

export interface CampaignStats {
  activeCampaigns: number;
  messagesThisMonth: number;
  avgClickRate: number;
}

export interface SetupStatus {
  phoneConfigured: boolean;
  hasContacts: boolean;
}

export interface ContactRedemption {
  id: number;
  couponId: number;
  code: string;
  note: string | null;
  createdAt: string | Date;
}
