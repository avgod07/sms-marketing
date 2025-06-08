export interface DashboardStats {
  totalContacts: number;
  messagesSent: number;
  activeCampaigns: number;
  deliveryRate: number;
  contactsChange: number;
  messagesChange: number;
  campaignsChange: number;
  deliveryRateChange: number;
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
