/**
 * Integration Test Examples for notify.ts
 * 
 * These examples demonstrate how to use the notification helpers
 * in API endpoints and background jobs
 */

import { notifyMidwife, notifyCHW, notifyFacilityEmergency } from '@/services/notify';

/**
 * Example 1: High-Risk Alert Workflow
 * When a mother's vital signs show high BP (≥140/90), notify both the midwife and facility
 */
export async function exampleHighRiskBPAlert() {
  const motherId = 123;
  const highBP = '150/95 mmHg';

  // Notify the facility's midwife
  const midwifeResult = await notifyMidwife(
    motherId,
    `HIGH RISK: Mother ID ${motherId} has elevated BP (${highBP}). Please review immediately.`
  );

  if (midwifeResult.sent) {
    console.log(`✓ Midwife notified - SMS ID: ${midwifeResult.smsMessageId}`);
  } else {
    console.error(`✗ Failed to notify midwife: ${midwifeResult.error} - ${midwifeResult.message}`);
  }

  // Notify facility emergency contact (critical backup)
  const facilityId = 5;
  const facilityResult = await notifyFacilityEmergency(
    facilityId,
    `ALERT: High-risk pregnancy alert for mother ID ${motherId} - BP ${highBP}`
  );

  if (facilityResult.sent) {
    console.log(`✓ Facility notified - SMS ID: ${facilityResult.smsMessageId}`);
  } else if (facilityResult.error === 'NO_EMERGENCY_PHONE') {
    console.warn(`⚠ Facility has no emergency phone configured`);
  } else {
    console.error(`✗ Failed to notify facility: ${facilityResult.error}`);
  }

  return { midwifeResult, facilityResult };
}

/**
 * Example 2: Appointment Reminder via CHW
 * Send appointment reminders to the mother's assigned CHW
 */
export async function exampleAppointmentReminder() {
  const motherId = 456;
  const appointmentDate = '2026-04-25';
  const appointmentTime = '10:00 AM';

  const result = await notifyCHW(
    motherId,
    `Appointment Reminder: Your ANC appointment is scheduled for ${appointmentDate} at ${appointmentTime}. Please confirm with your facility.`
  );

  if (result.sent) {
    console.log(`✓ CHW notified about appointment - SMS ID: ${result.smsMessageId}`);
    return { success: true, message: 'CHW notified' };
  } else if (result.error === 'OPT_OUT') {
    console.log(`ℹ Mother has opted out of SMS communication`);
    return { success: false, message: 'Mother opted out', error: 'OPT_OUT' };
  } else if (result.error === 'NO_CHW_ASSIGNED') {
    console.warn(`⚠ No CHW assigned to this mother - cannot send reminder via CHW`);
    return { success: false, message: 'No CHW assigned', error: 'NO_CHW_ASSIGNED' };
  } else {
    console.error(`✗ Failed to notify CHW: ${result.error}`);
    return { success: false, message: result.message, error: result.error };
  }
}

/**
 * Example 3: Emergency Referral Workflow
 * When a mother is referred with EMERGENCY urgency, notify facility immediately
 */
export async function exampleEmergencyReferral() {
  const facilityId = 5; // Receiving facility
  const motherId = 789;
  const reason = 'Severe vaginal bleeding';

  const result = await notifyFacilityEmergency(
    facilityId,
    `EMERGENCY REFERRAL: Mother ID ${motherId} requiring immediate admission. Reason: ${reason}. Please prepare for urgent care.`
  );

  if (result.sent) {
    console.log(`✓ Emergency facility notified - SMS ID: ${result.smsMessageId}`);
    return { success: true, message: 'Facility emergency contact notified' };
  } else if (result.error === 'NO_EMERGENCY_PHONE') {
    console.error(`✗ CRITICAL: Facility ${facilityId} has no emergency phone configured`);
    return { success: false, message: 'No emergency phone available', error: 'NO_EMERGENCY_PHONE' };
  } else {
    console.error(`✗ Failed to notify facility: ${result.error}`);
    return { success: false, message: result.message, error: result.error };
  }
}

/**
 * Example 4: API Endpoint - Send Alert
 * Example of how to use notify functions in an API route
 * 
 * Route: POST /api/alerts/send
 */
export async function exampleAPIEndpoint(req: any) {
  const { motherId, type, message, facilityId } = req.body;

  try {
    // Validate input
    if (!motherId || !type || !message) {
      return { status: 400, error: 'Missing required fields: motherId, type, message' };
    }

    let result;

    // Route to appropriate notification handler based on alert type
    switch (type) {
      case 'MIDWIFE_ALERT':
        result = await notifyMidwife(motherId, message);
        break;
      case 'CHW_REMINDER':
        result = await notifyCHW(motherId, message);
        break;
      case 'FACILITY_EMERGENCY':
        if (!facilityId) {
          return { status: 400, error: 'facilityId required for emergency alerts' };
        }
        result = await notifyFacilityEmergency(facilityId, message);
        break;
      default:
        return { status: 400, error: `Unknown alert type: ${type}` };
    }

    // Handle response
    if (result.sent) {
      return {
        status: 200,
        body: {
          success: true,
          message: result.message,
          smsMessageId: result.smsMessageId,
        },
      };
    } else {
      return {
        status: 400,
        body: {
          success: false,
          message: result.message,
          error: result.error,
        },
      };
    }
  } catch (error) {
    return {
      status: 500,
      body: {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Example 5: Danger Sign Detection
 * When a mother reports danger signs, notify midwife and optionally facility
 */
export async function exampleDangerSignAlert() {
  const motherId = 234;
  const dangerSigns = ['Severe headache', 'Blurred vision'];

  // Always notify the midwife about danger signs
  const midwifeResult = await notifyMidwife(
    motherId,
    `DANGER SIGN ALERT: Mother ID ${motherId} reports: ${dangerSigns.join(', ')}. Immediate evaluation required.`
  );

  let facilityResult = null;

  // If midwife notification fails, fall back to facility emergency
  if (!midwifeResult.sent && midwifeResult.error === 'NO_MIDWIFE_AVAILABLE') {
    console.log(`Midwife not available, escalating to facility emergency...`);
    facilityResult = await notifyFacilityEmergency(
      5, // Facility ID
      `DANGER SIGN - ESCALATED: Mother ID ${motherId} reports danger signs and midwife unavailable.`
    );
  }

  return {
    midwife: midwifeResult,
    facility: facilityResult,
    escalated: !midwifeResult.sent,
  };
}

/**
 * Example 6: SmsLog Verification
 * After sending notifications, you can query SmsLog to verify delivery
 * 
 * The notify functions automatically use sendSMS(), which logs all attempts to SmsLog table:
 * - toPhone: recipient phone number
 * - messagePreview: first 60 characters of message
 * - gateway: 'africastalking' or 'twilio'
 * - status: 'SENT', 'FAILED', or 'PENDING'
 * - gatewayMessageId: message ID from SMS gateway
 * - errorMessage: error details if failed
 */
export async function exampleVerifyNotificationLogs(db: any, smsMessageId: string) {
  // Query SmsLog to verify the notification was logged
  const logEntry = await db.smsLog.findUnique({
    where: { id: smsMessageId },
  });

  if (logEntry) {
    console.log(`SMS Log Entry:`, {
      toPhone: logEntry.toPhone,
      status: logEntry.status,
      gateway: logEntry.gateway,
      messagePreview: logEntry.messagePreview,
      sentAt: logEntry.createdAt,
    });

    if (logEntry.status === 'FAILED') {
      console.error(`SMS failed: ${logEntry.errorMessage}`);
    }
  } else {
    console.warn(`SMS log entry not found for message ID: ${smsMessageId}`);
  }

  return logEntry;
}

/**
 * Example 7: Error Handling Best Practices
 * Shows how to handle different error cases gracefully
 */
export async function exampleErrorHandling() {
  const motherId = 999; // May not exist
  const message = 'Test notification';

  const result = await notifyMidwife(motherId, message);

  // Check result and handle each error type
  if (result.sent) {
    console.log(`✓ Notification sent successfully`);
  } else {
    switch (result.error) {
      case 'MOTHER_NOT_FOUND':
        console.error(`Mother ${motherId} not found in system`);
        // TODO: Handle missing mother (log, alert admin, etc.)
        break;

      case 'NO_MIDWIFE_AVAILABLE':
        console.warn(`No midwife available for mother ${motherId}`);
        // TODO: Try alternative notification (facility emergency, etc.)
        break;

      case 'OPT_OUT':
        console.log(`Mother ${motherId} has opted out of SMS`);
        // TODO: Use alternative communication channel if available
        break;

      case 'SMS_SEND_FAILED':
        console.error(`SMS gateway failed: ${result.message}`);
        // TODO: Implement retry logic or queue for later
        break;

      case 'INTERNAL_ERROR':
        console.error(`Internal error: ${result.message}`);
        // TODO: Alert admin, implement circuit breaker
        break;

      default:
        console.error(`Unknown error: ${result.error} - ${result.message}`);
    }
  }

  return result;
}

// Export all examples for testing
export const integrationExamples = {
  exampleHighRiskBPAlert,
  exampleAppointmentReminder,
  exampleEmergencyReferral,
  exampleAPIEndpoint,
  exampleDangerSignAlert,
  exampleVerifyNotificationLogs,
  exampleErrorHandling,
};
