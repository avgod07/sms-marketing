import type { Twilio } from 'twilio';
import client from './twilio-client.js';

export interface SMSMessage {
  to: string;
  message: string;
  from?: string;
  messagingServiceSid?: string;
  campaignId?: number;
  contactId?: number;
}

export interface SMSResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

export class TwilioService {
  static async sendSMS(smsData: SMSMessage): Promise<SMSResult> {
    if (!smsData.messagingServiceSid && !smsData.from) {
      throw new Error(
        'This business has not completed onboarding or lacks a valid phone number.',
      );
    }
    try {
      const params: any = {
        body: smsData.message,
        to: smsData.to,
      };

      if (smsData.messagingServiceSid) {
        params.messagingServiceSid = smsData.messagingServiceSid;
      } else {
        params.from = smsData.from;
      }

      const message = await client.messages.create(params);

      return {
        success: true,
        messageSid: message.sid,
      };
    } catch (error: any) {
      console.error('Twilio SMS Error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send SMS',
      };
    }
  }

  static async sendBulkSMS(messages: SMSMessage[]): Promise<SMSResult[]> {
    const results: SMSResult[] = [];

    const batchSize = 10;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(msg =>
          this.sendSMS(msg).catch(err => ({
            success: false,
            error: err.message || 'Failed to send SMS',
          })),
        ),
      );
      results.push(...batchResults);

      if (i + batchSize < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  static async fetchAvailableTollFreeNumbers(
    opts: { page?: number; contains?: string; limit?: number } = {},
  ): Promise<string[]> {
    const params: any = {
      smsEnabled: true,
      pageSize: opts.limit ?? 12,
      pageNumber: opts.page ?? 0,
    };
    if (opts.contains) params.contains = opts.contains;

    const page = await client.availablePhoneNumbers('US').tollFree.page(params);
    return page.instances.map((n: any) => n.phoneNumber);
  }

  static async purchaseAndAssignNumber(
    phoneNumber: string,
    webhookUrl: string,
    serviceSid?: string,
  ): Promise<{ phoneSid: string; serviceSid: string }> {
    let sid = serviceSid || (process.env.TWILIO_MESSAGING_SERVICE_SID as string | undefined);
    if (!sid) {
      const service = await client.messaging.services.create({
        friendlyName: `Messaging Service - ${
          (process.env.TWILIO_ACCOUNT_SID || '').slice(-4)
        }`,
      });
      sid = service.sid;
    }

    const num = await client.incomingPhoneNumbers.create({
      phoneNumber,
      smsUrl: webhookUrl,
    });

    await client.messaging
      .services(sid)
      .phoneNumbers.create({ phoneNumberSid: num.sid });

    return { phoneSid: num.sid, serviceSid: sid };
  }
}
