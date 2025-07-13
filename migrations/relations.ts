import { relations } from "drizzle-orm/relations";
import { campaigns, messages, contacts, businesses, onboardingProgress, subscriptionEvents, twilioA2PConfig, twilioCredentials, creditTransactions, analytics, coupons, users, businessProfiles, businessCredits, couponRecipients, businessPhoneNumbers, couponRedemptions } from "./schema";

export const messagesRelations = relations(messages, ({one}) => ({
	campaign: one(campaigns, {
		fields: [messages.campaignId],
		references: [campaigns.id]
	}),
	contact: one(contacts, {
		fields: [messages.contactId],
		references: [contacts.id]
	}),
	business: one(businesses, {
		fields: [messages.businessId],
		references: [businesses.id]
	}),
}));

export const campaignsRelations = relations(campaigns, ({one, many}) => ({
	messages: many(messages),
	business: one(businesses, {
		fields: [campaigns.businessId],
		references: [businesses.id]
	}),
	couponRecipients: many(couponRecipients),
}));

export const contactsRelations = relations(contacts, ({one, many}) => ({
	messages: many(messages),
	business: one(businesses, {
		fields: [contacts.businessId],
		references: [businesses.id]
	}),
	couponRecipients: many(couponRecipients),
	couponRedemptions: many(couponRedemptions),
}));

export const businessesRelations = relations(businesses, ({many}) => ({
	messages: many(messages),
	onboardingProgresses: many(onboardingProgress),
	subscriptionEvents: many(subscriptionEvents),
	twilioA2PConfigs: many(twilioA2PConfig),
	twilioCredentials: many(twilioCredentials),
	creditTransactions: many(creditTransactions),
	analytics: many(analytics),
	coupons: many(coupons),
	users: many(users),
	businessProfiles: many(businessProfiles),
	campaigns: many(campaigns),
	businessCredits: many(businessCredits),
	contacts: many(contacts),
	couponRecipients: many(couponRecipients),
	businessPhoneNumbers: many(businessPhoneNumbers),
	couponRedemptions: many(couponRedemptions),
}));

export const onboardingProgressRelations = relations(onboardingProgress, ({one}) => ({
	business: one(businesses, {
		fields: [onboardingProgress.businessId],
		references: [businesses.id]
	}),
}));

export const subscriptionEventsRelations = relations(subscriptionEvents, ({one}) => ({
	business: one(businesses, {
		fields: [subscriptionEvents.businessId],
		references: [businesses.id]
	}),
}));

export const twilioA2PConfigRelations = relations(twilioA2PConfig, ({one}) => ({
	business: one(businesses, {
		fields: [twilioA2PConfig.businessId],
		references: [businesses.id]
	}),
}));

export const twilioCredentialsRelations = relations(twilioCredentials, ({one}) => ({
	business: one(businesses, {
		fields: [twilioCredentials.businessId],
		references: [businesses.id]
	}),
}));

export const creditTransactionsRelations = relations(creditTransactions, ({one}) => ({
	business: one(businesses, {
		fields: [creditTransactions.businessId],
		references: [businesses.id]
	}),
}));

export const analyticsRelations = relations(analytics, ({one}) => ({
	business: one(businesses, {
		fields: [analytics.businessId],
		references: [businesses.id]
	}),
}));

export const couponsRelations = relations(coupons, ({one, many}) => ({
	business: one(businesses, {
		fields: [coupons.businessId],
		references: [businesses.id]
	}),
	couponRecipients: many(couponRecipients),
	couponRedemptions: many(couponRedemptions),
}));

export const usersRelations = relations(users, ({one}) => ({
	business: one(businesses, {
		fields: [users.businessId],
		references: [businesses.id]
	}),
}));

export const businessProfilesRelations = relations(businessProfiles, ({one}) => ({
	business: one(businesses, {
		fields: [businessProfiles.businessId],
		references: [businesses.id]
	}),
}));

export const businessCreditsRelations = relations(businessCredits, ({one}) => ({
	business: one(businesses, {
		fields: [businessCredits.businessId],
		references: [businesses.id]
	}),
}));

export const couponRecipientsRelations = relations(couponRecipients, ({one}) => ({
	business: one(businesses, {
		fields: [couponRecipients.businessId],
		references: [businesses.id]
	}),
	coupon: one(coupons, {
		fields: [couponRecipients.couponId],
		references: [coupons.id]
	}),
	campaign: one(campaigns, {
		fields: [couponRecipients.campaignId],
		references: [campaigns.id]
	}),
	contact: one(contacts, {
		fields: [couponRecipients.contactId],
		references: [contacts.id]
	}),
}));

export const businessPhoneNumbersRelations = relations(businessPhoneNumbers, ({one}) => ({
	business: one(businesses, {
		fields: [businessPhoneNumbers.businessId],
		references: [businesses.id]
	}),
}));

export const couponRedemptionsRelations = relations(couponRedemptions, ({one}) => ({
	business: one(businesses, {
		fields: [couponRedemptions.businessId],
		references: [businesses.id]
	}),
	coupon: one(coupons, {
		fields: [couponRedemptions.couponId],
		references: [coupons.id]
	}),
	contact: one(contacts, {
		fields: [couponRedemptions.contactId],
		references: [contacts.id]
	}),
}));