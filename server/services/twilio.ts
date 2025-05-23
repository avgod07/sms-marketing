import twilio from 'twilio';

// Twilio configuration - these will be set via environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'your_auth_token_here';
const phoneNumber = process.env.TWILIO_PHONE_NUMBER || '+1234567890';

// Initialize Twilio client
const client = twilio(accountSid, authToken);

export interface SMSMessage {
  to: string;
  message: string;
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
    try {
      // Check if Twilio is properly configured
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        console.warn('Twilio credentials not configured. SMS will be simulated.');
        return {
          success: true,
          messageSid: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
      }

      const message = await client.messages.create({
        body: smsData.message,
        from: phoneNumber,
        to: smsData.to,
      });

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
    
    // Send messages in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchPromises = batch.map(msg => this.sendSMS(msg));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add a small delay between batches
      if (i + batchSize < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  static isConfigured(): boolean {
    return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
  }

  static getConfiguration() {
    return {
      accountSid: process.env.TWILIO_ACCOUNT_SID || 'Not configured',
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || 'Not configured',
      isConfigured: this.isConfigured(),
    };
  }
}