import axios, { AxiosError } from 'axios';
import { db } from '@/lib/db';

/**
 * Input parameters for sending an SMS
 */
export interface SendSmsInput {
  to: string;
  message: string;
  type: string;
  userId?: number;
}

/**
 * Response from sendSMS function
 */
export interface SmsResponse {
  sent: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Internal type for SMS log creation
 */
interface SmsLogPayload {
  toPhone: string;
  messagePreview: string;
  gateway: 'africastalking' | 'twilio';
  status: 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED';
  gatewayMessageId?: string;
  errorMessage?: string;
}

/**
 * Africa's Talking API response
 */
interface AfricasTalkingResponse {
  SMSMessageData: {
    Recipients: Array<{
      statusCode: number;
      number: string;
      status: string;
      messageId: string;
      cost: string;
    }>;
  };
}

/**
 * Twilio API response
 */
interface TwilioResponse {
  sid: string;
  status: string;
  error_code?: string;
  error_message?: string;
}

/**
 * Gateway attempt result
 */
interface GatewayAttemptResult {
  success: boolean;
  gateway: 'africastalking' | 'twilio';
  messageId?: string;
  error?: string;
}

/**
 * Validates and formats phone numbers to +256 format for Uganda
 * Handles various input formats: 0701..., +256701..., 256701...
 *
 * @param phoneNumber - Phone number in various formats
 * @returns Formatted phone number with +256 prefix
 * @throws Error if phone number is invalid
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // Remove whitespace, dashes, and parentheses
  let cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');

  // If it starts with +, assume it's already formatted or has country code
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // If it starts with 256, prepend +
  if (cleaned.startsWith('256')) {
    return `+${cleaned}`;
  }

  // If it starts with 0 (Ugandan format), replace with +256
  if (cleaned.startsWith('0')) {
    return `+256${cleaned.substring(1)}`;
  }

  // If it's just digits and doesn't match pattern, assume it needs +256
  if (/^\d+$/.test(cleaned)) {
    // Assume it's a Ugandan number without country code
    return `+256${cleaned}`;
  }

  throw new Error(`Invalid phone number format: ${phoneNumber}`);
}

/**
 * Extracts first 60 characters of message for logging
 */
function getMessagePreview(message: string): string {
  return message.substring(0, 60);
}

/**
 * Checks if a user has given consent for SMS communication
 *
 * @param userId - User ID to check
 * @returns Object with consent status
 */
async function checkConsentRecord(userId: number): Promise<{ hasConsent: boolean }> {
  try {
    // Query ConsentRecord for SMS_COMMUNICATION consent records for this user
    const consentRecords = await db.consentRecord.findMany({
      where: {
        userId: userId,
        type: 'SMS_COMMUNICATION',
      },
      orderBy: {
        acceptedAt: 'desc',
      },
    });

    if (consentRecords.length === 0) {
      return { hasConsent: false };
    }

    // Check if the most recent consent is recent enough (within 2 years)
    const mostRecentConsent = consentRecords[0];
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    if (mostRecentConsent.acceptedAt < twoYearsAgo) {
      return { hasConsent: false };
    }

    return { hasConsent: true };
  } catch (error) {
    // On database error, log but allow send (fail-open to avoid blocking valid sends)
    console.error('Error checking consent record:', error);
    return { hasConsent: true };
  }
}

/**
 * Logs an SMS send attempt to the database
 *
 * @param payload - SMS log data
 * @returns Created log record or null if creation fails
 */
async function logSmsAttempt(payload: SmsLogPayload): Promise<{ id: number } | null> {
  try {
    const record = await db.smsLog.create({
      data: {
        toPhone: payload.toPhone,
        messagePreview: payload.messagePreview,
        gateway: payload.gateway,
        status: payload.status,
        gatewayMessageId: payload.gatewayMessageId,
        errorMessage: payload.errorMessage,
        createdAt: new Date(),
      },
    });

    return { id: record.id };
  } catch (error) {
    // Silently catch database errors (log to console but don't throw)
    console.error('Error logging SMS attempt to database:', error);
    return null;
  }
}

/**
 * Sends SMS via Africa's Talking gateway
 *
 * @param to - Recipient phone number (should already be formatted)
 * @param message - Message content
 * @returns Gateway result with success flag and messageId or error
 */
async function sendViaAfricasTalking(to: string, message: string): Promise<GatewayAttemptResult> {
  try {
    // Validate environment variables
    const apiKey = process.env.AFRICASTALKING_API_KEY;
    const username = process.env.AFRICASTALKING_USERNAME;

    if (!apiKey || !username) {
      const errorMsg = 'Missing Africa\'s Talking credentials (AFRICASTALKING_API_KEY or AFRICASTALKING_USERNAME)';
      console.error(errorMsg);
      return {
        success: false,
        gateway: 'africastalking',
        error: errorMsg,
      };
    }

    // Construct basic auth header
    const auth = Buffer.from(`${username}:${apiKey}`).toString('base64');

    // Prepare request payload
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('recipients', to);
    params.append('message', message);

    // Send request to Africa's Talking
    const response = await axios.post<AfricasTalkingResponse>(
      'https://api.sandbox.africastalking.com/version1/messaging',
      params,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        timeout: 10000,
      }
    );

    // Extract message ID from response
    if (
      response.data?.SMSMessageData?.Recipients &&
      response.data.SMSMessageData.Recipients.length > 0
    ) {
      const recipient = response.data.SMSMessageData.Recipients[0];

      if (recipient.status === 'Success' || recipient.statusCode === 101) {
        return {
          success: true,
          gateway: 'africastalking',
          messageId: recipient.messageId,
        };
      }

      // If recipient status indicates failure, trigger retry
      return {
        success: false,
        gateway: 'africastalking',
        error: `Africa's Talking: ${recipient.status}`,
      };
    }

    return {
      success: false,
      gateway: 'africastalking',
      error: 'Unexpected response format from Africa\'s Talking API',
    };
  } catch (error) {
    const errorMsg =
      error instanceof AxiosError
        ? error.response?.data?.message || error.message
        : error instanceof Error
          ? error.message
          : 'Unknown error';

    console.error(`Africa's Talking API error:`, errorMsg);

    return {
      success: false,
      gateway: 'africastalking',
      error: `Africa's Talking API failed: ${errorMsg}`,
    };
  }
}

/**
 * Sends SMS via Twilio gateway
 *
 * @param to - Recipient phone number (should already be formatted)
 * @param message - Message content
 * @returns Gateway result with success flag and messageId or error
 */
async function sendViaTwilio(to: string, message: string): Promise<GatewayAttemptResult> {
  try {
    // Validate environment variables
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      const errorMsg = 'Missing Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_FROM_NUMBER)';
      console.error(errorMsg);
      return {
        success: false,
        gateway: 'twilio',
        error: errorMsg,
      };
    }

    // Construct basic auth header
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    // Prepare request payload
    const params = new URLSearchParams();
    params.append('To', to);
    params.append('From', fromNumber);
    params.append('Body', message);

    // Send request to Twilio
    const response = await axios.post<TwilioResponse>(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      params,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      }
    );

    if (response.data?.sid) {
      return {
        success: true,
        gateway: 'twilio',
        messageId: response.data.sid,
      };
    }

    return {
      success: false,
      gateway: 'twilio',
      error: 'Unexpected response format from Twilio API',
    };
  } catch (error) {
    const errorMsg =
      error instanceof AxiosError
        ? error.response?.data?.message || error.message
        : error instanceof Error
          ? error.message
          : 'Unknown error';

    console.error('Twilio API error:', errorMsg);

    return {
      success: false,
      gateway: 'twilio',
      error: `Twilio API failed: ${errorMsg}`,
    };
  }
}

/**
 * Orchestrates SMS sending attempts with fallback logic
 * Tries Africa's Talking first, falls back to Twilio if Africa's Talking fails
 *
 * @param to - Recipient phone number (already formatted)
 * @param message - Message content
 * @returns Result with which gateway succeeded and messageId
 */
async function attemptSend(to: string, message: string): Promise<GatewayAttemptResult> {
  // Try Africa's Talking first
  const africaResult = await sendViaAfricasTalking(to, message);

  if (africaResult.success) {
    return africaResult;
  }

  console.warn(`Africa's Talking failed, attempting Twilio fallback: ${africaResult.error}`);

  // Fall back to Twilio
  const twilioResult = await sendViaTwilio(to, message);

  return twilioResult;
}

/**
 * Sends an SMS message with consent checking and dual-gateway fallback
 *
 * Process:
 * 1. Validates input parameters
 * 2. Formats phone number to +256 prefix
 * 3. Checks ConsentRecord if userId is provided (opt-out check)
 * 4. Attempts to send via Africa's Talking, falls back to Twilio if needed
 * 5. Logs all attempts to SmsLog table
 * 6. Returns success/failure response
 *
 * @param input - SMS input parameters (to, message, type, optional userId)
 * @returns Promise resolving to SmsResponse with sent status and messageId or error
 *
 * @example
 * const result = await sendSMS({
 *   to: '0701234567',
 *   message: 'Hello, this is a test message',
 *   type: 'reminder',
 *   userId: 123
 * });
 *
 * if (result.sent) {
 *   console.log(`Message sent with ID: ${result.messageId}`);
 * } else {
 *   console.error(`Failed to send: ${result.error}`);
 * }
 */
export async function sendSMS(input: SendSmsInput): Promise<SmsResponse> {
  try {
    // Validate input
    if (!input.to || typeof input.to !== 'string' || input.to.trim() === '') {
      return {
        sent: false,
        error: 'Invalid recipient phone number',
      };
    }

    if (!input.message || typeof input.message !== 'string' || input.message.trim() === '') {
      return {
        sent: false,
        error: 'Message cannot be empty',
      };
    }

    if (!input.type || typeof input.type !== 'string' || input.type.trim() === '') {
      return {
        sent: false,
        error: 'Message type is required',
      };
    }

    // Format phone number
    let formattedTo: string;
    try {
      formattedTo = formatPhoneNumber(input.to);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Phone number formatting failed';
      return {
        sent: false,
        error: errorMsg,
      };
    }

    // Check consent if userId is provided
    if (input.userId) {
      const consentCheck = await checkConsentRecord(input.userId);
      if (!consentCheck.hasConsent) {
        // Log failed attempt due to opt-out
        const messagePreview = getMessagePreview(input.message);
        await logSmsAttempt({
          toPhone: formattedTo,
          messagePreview,
          gateway: 'africastalking', // Log the intended gateway
          status: 'FAILED',
          errorMessage: 'User opted out of SMS communication',
        });

        return {
          sent: false,
          error: 'OPT_OUT',
        };
      }
    } else {
      console.warn('sendSMS called without userId - skipping consent check');
    }

    // Attempt to send via gateways
    const gatewayResult = await attemptSend(formattedTo, input.message);
    const messagePreview = getMessagePreview(input.message);

    if (gatewayResult.success) {
      // Log successful send
      await logSmsAttempt({
        toPhone: formattedTo,
        messagePreview,
        gateway: gatewayResult.gateway,
        status: 'SENT',
        gatewayMessageId: gatewayResult.messageId,
      });

      return {
        sent: true,
        messageId: gatewayResult.messageId,
      };
    }

    // Log failed send
    await logSmsAttempt({
      toPhone: formattedTo,
      messagePreview,
      gateway: gatewayResult.gateway,
      status: 'FAILED',
      errorMessage: gatewayResult.error,
    });

    return {
      sent: false,
      error: gatewayResult.error,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('sendSMS error:', errorMsg);

    return {
      sent: false,
      error: errorMsg,
    };
  }
}

export default sendSMS;
