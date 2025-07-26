import moment from "moment-timezone";

/**
 * QuietHoursCompliance Service
 * Handles TCPA quiet hours validation (8 PM - 8 AM local time)
 */
export class QuietHoursCompliance {
  /**
   * Check if a message can be sent immediately based on business timezone
   * @param businessTimezone - Business timezone (e.g., 'America/New_York')
   * @param messageType - Type of message being sent
   * @returns true if message can be sent immediately, false if it should be queued
   */
  static canSendImmediately(
    businessTimezone: string,
    messageType: string
  ): boolean {
    // CRITICAL EXCEPTION: STOP responses MUST send immediately (FCC requirement)
    if (messageType === "stop_response") {
      return true;
    }

    // All other messages respect business hours (8 AM - 8 PM)
    const businessTime = moment().tz(businessTimezone);
    const hour = businessTime.hour();

    // Allow sending between 8 AM (inclusive) and 8 PM (exclusive)
    return hour >= 8 && hour < 20;
  }

  /**
   * Calculate the next available send time based on business timezone
   * @param businessTimezone - Business timezone
   * @returns Date object representing when the message can be sent
   */
  static getNextSendTime(businessTimezone: string): Date {
    const businessTime = moment().tz(businessTimezone);
    const hour = businessTime.hour();

    if (hour < 8) {
      // Before 8 AM today -> schedule for 8 AM today
      return businessTime.hour(8).minute(0).second(0).millisecond(0).toDate();
    } else {
      // After 8 PM today -> schedule for 8 AM tomorrow
      return businessTime
        .add(1, "day")
        .hour(8)
        .minute(0)
        .second(0)
        .millisecond(0)
        .toDate();
    }
  }

  /**
   * Get a formatted time string for displaying to users
   * @param date - Date to format
   * @param timezone - Timezone for formatting
   * @returns Formatted time string (e.g., "8:00 AM EST")
   */
  static formatSendTime(date: Date, timezone: string): string {
    return moment(date).tz(timezone).format("h:mm A z");
  }

  /**
   * Validate timezone string
   * @param timezone - Timezone string to validate
   * @returns true if valid timezone
   */
  static isValidTimezone(timezone: string): boolean {
    try {
      moment.tz.zone(timezone);
      return true;
    } catch {
      return false;
    }
  }
}
