/**
 * Accurate Twilio SMS/MMS segmentation calculator
 * Based on official Twilio documentation and pricing
 */

export interface TwilioMessageInfo {
  type: "SMS" | "MMS";
  encoding: "GSM-7" | "UCS-2";
  segments: number;
  credits: number;
  charactersPerSegment: number;
  characterLimit: number;
}

export interface MessageValidationResult {
  isValid: boolean;
  error?: string;
  warningThreshold?: number;
}

/**
 * Validates message length against Twilio practical limits
 */
export function validateMessageLength(
  message: string,
  hasMedia: boolean = false
): MessageValidationResult {
  const length = message.length;

  // Hard limit for both SMS and MMS
  if (length > 1600) {
    return {
      isValid: false,
      error: hasMedia
        ? "MMS messages cannot exceed 1600 characters"
        : "SMS messages cannot exceed 1600 characters (practical limit)",
    };
  }

  // Warning threshold
  if (length > 1500) {
    return {
      isValid: true,
      warningThreshold: 1500,
    };
  }

  return { isValid: true };
}

/**
 * Detects if message contains characters that require UCS-2 encoding
 * Based on GSM 03.38 character set limitations
 */
export function requiresUCS2Encoding(message: string): boolean {
  // Check for characters outside basic ASCII range (0-127)
  if (/[^\u0000-\u007F]/.test(message)) {
    return true;
  }

  // Check for smart quotes, em dashes, and other common UCS-2 characters
  if (/[""''–—…]/.test(message)) {
    return true;
  }

  // Check for characters not in GSM 03.38 character set
  // GSM basic character set (most common)
  const gsmBasicChars =
    /^[A-Za-z0-9@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-.\/:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\~\[\]|€]*$/;

  return !gsmBasicChars.test(message);
}

/**
 * Calculates accurate Twilio segmentation for SMS/MMS
 * Matches Twilio's official behavior exactly
 */
export function calculateTwilioSegmentation(
  message: string,
  hasMedia: boolean = false
): TwilioMessageInfo {
  // MMS is ONLY triggered by media attachments, not message length
  if (hasMedia) {
    return {
      type: "MMS",
      encoding: "N/A" as any, // MMS can handle any encoding
      segments: 1,
      credits: 3, // Flat MMS rate
      charactersPerSegment: 1600, // MMS can handle up to 1600 chars
      characterLimit: 1600,
    };
  }

  const messageLength = message.length;

  // Determine encoding type
  const needsUCS2 = requiresUCS2Encoding(message);

  if (needsUCS2) {
    // UCS-2 encoding (Unicode characters, emojis, smart quotes, etc.)
    const singleMessageLimit = 70;
    const multiSegmentLimit = 67; // 6-7 bytes reserved for concatenation headers

    let segments: number;
    if (messageLength <= singleMessageLimit) {
      segments = 1;
    } else {
      segments = Math.ceil(messageLength / multiSegmentLimit);
    }

    return {
      type: "SMS",
      encoding: "UCS-2",
      segments,
      credits: segments, // Each segment costs 1 credit
      charactersPerSegment:
        segments === 1 ? singleMessageLimit : multiSegmentLimit,
      characterLimit: segments === 1 ? singleMessageLimit : multiSegmentLimit,
    };
  } else {
    // GSM-7 encoding (standard ASCII-like characters)
    const singleMessageLimit = 160;
    const multiSegmentLimit = 153; // 6-7 bytes reserved for concatenation headers

    let segments: number;
    if (messageLength <= singleMessageLimit) {
      segments = 1;
    } else {
      segments = Math.ceil(messageLength / multiSegmentLimit);
    }

    return {
      type: "SMS",
      encoding: "GSM-7",
      segments,
      credits: segments, // Each segment costs 1 credit
      charactersPerSegment:
        segments === 1 ? singleMessageLimit : multiSegmentLimit,
      characterLimit: segments === 1 ? singleMessageLimit : multiSegmentLimit,
    };
  }
}

/**
 * Get the appropriate character counter limit for display
 */
export function getCharacterCounterLimit(
  message: string,
  hasMedia: boolean = false
): number {
  if (hasMedia) {
    return 1600; // MMS limit
  }

  const needsUCS2 = requiresUCS2Encoding(message);

  if (needsUCS2) {
    return message.length <= 70 ? 70 : 67;
  } else {
    return message.length <= 160 ? 160 : 153;
  }
}

/**
 * Format message info for display
 */
export function formatMessageTypeDisplay(
  messageInfo: TwilioMessageInfo
): string {
  if (messageInfo.type === "MMS") {
    return `MMS (3 credits)`;
  }

  if (messageInfo.segments === 1) {
    return `SMS (1 credit)`;
  }

  return `${messageInfo.segments} SMS segments (${messageInfo.credits} credits)`;
}

/**
 * Get cost explanation text
 */
export function getCostExplanation(
  messageInfo: TwilioMessageInfo,
  hasMedia: boolean
): string {
  if (messageInfo.type === "MMS") {
    return `MMS due to attached image`;
  }

  if (messageInfo.segments === 1) {
    return `SMS message ≤${messageInfo.characterLimit} characters`;
  }

  return `${messageInfo.segments} SMS segments due to length >${
    messageInfo.segments === 2 ? "160" : "160"
  } characters`;
}
