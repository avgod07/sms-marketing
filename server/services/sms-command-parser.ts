export interface SMSCommandParseResult {
  isValidCommand: boolean;
  message?: string;
  error?: string;
}

export class SMSCommandParser {
  /**
   * Parse SMS command from message body
   * Expected format: "SEND: your message here"
   */
  static parseCommand(messageBody: string): SMSCommandParseResult {
    if (!messageBody || typeof messageBody !== "string") {
      return { isValidCommand: false };
    }

    const trimmed = messageBody.trim();

    // Check if starts with "SEND:" (case insensitive)
    const sendRegex = /^SEND:\s*/i;
    if (!sendRegex.test(trimmed)) {
      return { isValidCommand: false };
    }

    // Extract message after "SEND:"
    const message = trimmed.replace(sendRegex, "").trim();

    if (!message) {
      return {
        isValidCommand: false,
        error: "No message content found after SEND:",
      };
    }

    // Basic validation - MVP 160 character limit
    if (message.length > 160) {
      return {
        isValidCommand: false,
        error: "Message too long. Maximum 160 characters for MVP.",
      };
    }

    return {
      isValidCommand: true,
      message,
    };
  }

  /**
   * Parse confirmation response from message body
   * Expected formats: YES, Y, CONFIRM, SEND, NO, N, CANCEL, STOP
   */
  static parseConfirmationResponse(messageBody: string): {
    isConfirmation: boolean;
    isYes?: boolean;
    isNo?: boolean;
  } {
    if (!messageBody || typeof messageBody !== "string") {
      return { isConfirmation: false };
    }

    const trimmed = messageBody.trim().toLowerCase();

    // Accept various confirmation formats
    if (["yes", "y", "confirm", "send"].includes(trimmed)) {
      return { isConfirmation: true, isYes: true };
    }

    if (["no", "n", "cancel", "stop"].includes(trimmed)) {
      return { isConfirmation: true, isNo: true };
    }

    return { isConfirmation: false };
  }

  /**
   * Check if a message looks like a command attempt (for logging/debugging)
   */
  static looksLikeCommand(messageBody: string): boolean {
    if (!messageBody || typeof messageBody !== "string") {
      return false;
    }

    const trimmed = messageBody.trim().toLowerCase();

    // Check for various command-like patterns
    return (
      trimmed.startsWith("send:") ||
      trimmed.startsWith("send ") ||
      trimmed.startsWith("send_") ||
      trimmed.startsWith("campaign:") ||
      trimmed.startsWith("message:") ||
      trimmed.startsWith("blast:")
    );
  }

  /**
   * Validate message content for potential issues
   */
  static validateMessageContent(message: string): {
    isValid: boolean;
    warnings: string[];
    errors: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check for common issues
    if (message.length < 10) {
      warnings.push("Message is very short");
    }

    if (message.length > 160) {
      warnings.push("Message will be sent as multiple SMS segments");
    }

    // Check for potentially problematic content
    const suspiciousPatterns = [
      /urgent.{0,20}act\s+now/i,
      /click.{0,20}here.{0,20}immediately/i,
      /limited.{0,20}time.{0,20}offer/i,
    ];

    suspiciousPatterns.forEach((pattern) => {
      if (pattern.test(message)) {
        warnings.push("Message may trigger spam filters");
      }
    });

    // Check for required opt-out language (for compliance)
    if (!message.toLowerCase().includes("stop") && message.length > 100) {
      warnings.push("Consider including opt-out instructions (Reply STOP)");
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
    };
  }
}
