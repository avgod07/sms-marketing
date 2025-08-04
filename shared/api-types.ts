import type { Campaign } from "./schema";

// Enhanced campaign type with queue information
export type CampaignWithQueue = Campaign & {
  hasQueuedMessages?: boolean;
  queuedMessageCount?: number;
  nextQueuedSendTime?: Date;
};

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
  campaignsThisMonth: number;
  scheduledCampaigns: number;
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
  // Original fields (for compatibility)
  sentCount: number; // NOW: Total processed successfully (sentCount + queuedCount)
  failedCount: number; // Processing failures
  totalContacts: number;

  // NEW: Queue awareness fields
  queuedCount?: number; // How many queued
  hasQueuedMessages?: boolean;
  nextSendTime?: string; // ISO string for next send
  queueInfo?: {
    scheduledFor: string;
    businessTimezone: string;
    businessHours: string; // "8 AM - 8 PM"
  };
}

// Campaign Scheduling Types
export interface CampaignScheduleRequest {
  scheduledSendTime: string; // ISO string
  scheduleNotes?: string;
}

export interface CampaignScheduleResponse {
  campaign: any; // Campaign with scheduling fields
  scheduledFor: string; // ISO string
  businessTimezone: string;
  businessHours: string;
  countdown?: {
    timeUntilSend: string; // Human readable like "in 2 hours"
    exactTime: string; // ISO string
  };
}

export interface SchedulingValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
  suggestedTime?: string; // ISO string for alternative time
  businessHoursImpact?: {
    isOutsideBusinessHours: boolean;
    nextBusinessHour?: string;
  };
}

// Timezone Management Types
export interface BusinessTimezoneInfo {
  current: {
    timezone: string;
    displayName: string;
    currentTime: string;
    businessHours: string;
    isBusinessHours: boolean;
  };
  detection: {
    method: "auto" | "manual";
    lastUpdated: string;
    suggestedTimezone?: string;
    addressMatch: boolean;
  };
  queueInfo?: {
    pendingMessages: number;
    nextSendTime?: string;
  };
}

export interface TimezoneValidationResponse {
  isValid: boolean;
  warnings: string[];
  suggestions: string[];
  impact: {
    currentBusinessHours: string;
    newBusinessHours: string;
    queuedMessagesAffected: number;
    timeDifference: string;
  };
}

export interface TimezoneUpdateRequest {
  timezone: string;
  confirmed: boolean;
  reason?: "business_moved" | "incorrect_detection" | "other";
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
  contactId: number | null;
  contactName?: string;
  createdAt: string;
}

export interface RecentInboxMessage {
  id: number;
  content: string;
  status: string;
  phoneNumber: string;
  contactId: number | null;
  contactName?: string;
  createdAt: string;
}

export interface RecentActivity {
  contacts: RecentContact[];
  campaigns: RecentCampaign[];
  messages: RecentMessage[];
  inboxMessages: RecentInboxMessage[];
}
