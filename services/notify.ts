import { db } from '@/lib/db';
import { sendSMS, SendSmsInput, SmsResponse } from './sms';

/**
 * Response from notify functions
 */
export interface NotifyResponse {
  sent: boolean;
  message: string;
  error?: string;
  smsMessageId?: string;
}

/**
 * Notifies a mother's assigned facility midwife
 *
 * Process:
 * 1. Fetch Mother record by motherId (get facilityId, districtId)
 * 2. Query Users with role='MIDWIFE' at the mother's facility
 * 3. Check ConsentRecord for SMS_COMMUNICATION consent tied to motherId
 * 4. If opted-out: return OPT_OUT error
 * 5. If no midwife found: return NO_MIDWIFE_AVAILABLE error
 * 6. Format midwife's phone number and send SMS via sendSMS()
 * 7. Return result with SMS messageId if successful
 *
 * @param motherId - Mother's ID
 * @param message - Message to send to midwife
 * @returns NotifyResponse with sent status and messageId or error
 *
 * @example
 * const result = await notifyMidwife(123, 'High BP detected - please review');
 * if (result.sent) {
 *   console.log(`Midwife notified: ${result.smsMessageId}`);
 * } else {
 *   console.error(`Failed to notify midwife: ${result.error}`);
 * }
 */
export async function notifyMidwife(motherId: number, message: string): Promise<NotifyResponse> {
  try {
    // Validate input
    if (!motherId || typeof motherId !== 'number') {
      return {
        sent: false,
        message: 'Invalid mother ID',
        error: 'INVALID_MOTHER_ID',
      };
    }

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return {
        sent: false,
        message: 'Message cannot be empty',
        error: 'INVALID_MESSAGE',
      };
    }

    // 1. Fetch Mother record
    const mother = await db.mother.findUnique({
      where: { id: motherId },
      select: {
        id: true,
        phone: true,
        facilityId: true,
        districtId: true,
        facility: {
          select: {
            id: true,
            districtId: true,
          },
        },
      },
    });

    if (!mother) {
      return {
        sent: false,
        message: 'Mother record not found',
        error: 'MOTHER_NOT_FOUND',
      };
    }

    // 2. Check ConsentRecord for SMS_COMMUNICATION consent
    const consentCheck = await checkConsentRecord(motherId);
    if (!consentCheck.hasConsent) {
      console.log(`Midwife notification skipped for mother ${motherId}: opted out of SMS`);
      return {
        sent: false,
        message: 'Mother opted out of SMS communication',
        error: 'OPT_OUT',
      };
    }

    // 3. Query for MIDWIFE Users at the mother's facility (by districtId)
    const midwife = await db.user.findFirst({
      where: {
        role: 'MIDWIFE',
        districtId: mother.districtId,
        isActive: true,
        phone: { not: null },
      },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    });

    if (!midwife || !midwife.phone) {
      return {
        sent: false,
        message: 'No active midwife available at facility',
        error: 'NO_MIDWIFE_AVAILABLE',
      };
    }

    // 4. Send SMS to midwife via sendSMS
    const smsResult = await sendSMS({
      to: midwife.phone,
      message: message,
      type: 'MIDWIFE_NOTIFICATION',
      userId: motherId, // For consent audit trail
    });

    if (smsResult.sent && smsResult.messageId) {
      console.log(
        `Midwife ${midwife.name} notified for mother ${motherId}: ${smsResult.messageId}`
      );
      return {
        sent: true,
        message: `Midwife notified successfully`,
        smsMessageId: smsResult.messageId,
      };
    }

    // SMS send failed
    return {
      sent: false,
      message: `Failed to send SMS to midwife: ${smsResult.error || 'Unknown error'}`,
      error: smsResult.error || 'SMS_SEND_FAILED',
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`Error in notifyMidwife for mother ${motherId}:`, errorMsg);

    return {
      sent: false,
      message: `Error notifying midwife: ${errorMsg}`,
      error: 'INTERNAL_ERROR',
    };
  }
}

/**
 * Notifies a mother's assigned CHW (Community Health Worker)
 *
 * Process:
 * 1. Fetch Mother record by motherId (get chwId)
 * 2. Get CHW User record via chwId
 * 3. Check ConsentRecord for SMS_COMMUNICATION consent tied to motherId
 * 4. If opted-out: return OPT_OUT error
 * 5. If no CHW assigned: return NO_CHW_ASSIGNED error
 * 6. Format CHW's phone number and send SMS via sendSMS()
 * 7. Return result with SMS messageId if successful
 *
 * @param motherId - Mother's ID
 * @param message - Message to send to CHW
 * @returns NotifyResponse with sent status and messageId or error
 *
 * @example
 * const result = await notifyCHW(123, 'Appointment reminder: 2026-04-25 at 10:00 AM');
 * if (result.sent) {
 *   console.log(`CHW notified: ${result.smsMessageId}`);
 * } else {
 *   console.error(`Failed to notify CHW: ${result.error}`);
 * }
 */
export async function notifyCHW(motherId: number, message: string): Promise<NotifyResponse> {
  try {
    // Validate input
    if (!motherId || typeof motherId !== 'number') {
      return {
        sent: false,
        message: 'Invalid mother ID',
        error: 'INVALID_MOTHER_ID',
      };
    }

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return {
        sent: false,
        message: 'Message cannot be empty',
        error: 'INVALID_MESSAGE',
      };
    }

    // 1. Fetch Mother record with CHW relationship
    const mother = await db.mother.findUnique({
      where: { id: motherId },
      select: {
        id: true,
        chwId: true,
        chw: {
          select: {
            id: true,
            name: true,
            phone: true,
            isActive: true,
          },
        },
      },
    });

    if (!mother) {
      return {
        sent: false,
        message: 'Mother record not found',
        error: 'MOTHER_NOT_FOUND',
      };
    }

    // 2. Check if CHW is assigned
    if (!mother.chwId || !mother.chw) {
      return {
        sent: false,
        message: 'No CHW assigned to this mother',
        error: 'NO_CHW_ASSIGNED',
      };
    }

    // 3. Verify CHW is active and has a phone number
    if (!mother.chw.isActive) {
      return {
        sent: false,
        message: 'Assigned CHW is inactive',
        error: 'CHW_INACTIVE',
      };
    }

    if (!mother.chw.phone) {
      return {
        sent: false,
        message: 'CHW has no phone number on file',
        error: 'CHW_NO_PHONE',
      };
    }

    // 4. Check ConsentRecord for SMS_COMMUNICATION consent
    const consentCheck = await checkConsentRecord(motherId);
    if (!consentCheck.hasConsent) {
      console.log(`CHW notification skipped for mother ${motherId}: opted out of SMS`);
      return {
        sent: false,
        message: 'Mother opted out of SMS communication',
        error: 'OPT_OUT',
      };
    }

    // 5. Send SMS to CHW via sendSMS
    const smsResult = await sendSMS({
      to: mother.chw.phone,
      message: message,
      type: 'CHW_NOTIFICATION',
      userId: motherId, // For consent audit trail
    });

    if (smsResult.sent && smsResult.messageId) {
      console.log(
        `CHW ${mother.chw.name} notified for mother ${motherId}: ${smsResult.messageId}`
      );
      return {
        sent: true,
        message: `CHW notified successfully`,
        smsMessageId: smsResult.messageId,
      };
    }

    // SMS send failed
    return {
      sent: false,
      message: `Failed to send SMS to CHW: ${smsResult.error || 'Unknown error'}`,
      error: smsResult.error || 'SMS_SEND_FAILED',
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`Error in notifyCHW for mother ${motherId}:`, errorMsg);

    return {
      sent: false,
      message: `Error notifying CHW: ${errorMsg}`,
      error: 'INTERNAL_ERROR',
    };
  }
}

/**
 * Notifies a facility's emergency contact line
 *
 * Process:
 * 1. Fetch Facility record by facilityId
 * 2. Try emergencyPhone first; fallback to onCallPhone → ambulancePhone → backupPhone
 * 3. SKIP consent check (emergency override - critical safety)
 * 4. If no phone found: return NO_EMERGENCY_PHONE error
 * 5. Send SMS to facility emergency line via sendSMS()
 * 6. Return result with SMS messageId if successful
 *
 * NOTE: This function bypasses consent checks intentionally for emergency situations
 *
 * @param facilityId - Facility's ID
 * @param message - Message to send (typically emergency alert)
 * @returns NotifyResponse with sent status and messageId or error
 *
 * @example
 * const result = await notifyFacilityEmergency(5, 'EMERGENCY: Mother at risk, admission urgent');
 * if (result.sent) {
 *   console.log(`Facility notified: ${result.smsMessageId}`);
 * } else {
 *   console.error(`Failed to notify facility: ${result.error}`);
 * }
 */
export async function notifyFacilityEmergency(
  facilityId: number,
  message: string
): Promise<NotifyResponse> {
  try {
    // Validate input
    if (!facilityId || typeof facilityId !== 'number') {
      return {
        sent: false,
        message: 'Invalid facility ID',
        error: 'INVALID_FACILITY_ID',
      };
    }

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return {
        sent: false,
        message: 'Message cannot be empty',
        error: 'INVALID_MESSAGE',
      };
    }

    // 1. Fetch Facility record with emergency contact details
    const facility = await db.facility.findUnique({
      where: { id: facilityId },
      select: {
        id: true,
        name: true,
        emergencyPhone: true,
        onCallPhone: true,
        ambulancePhone: true,
        backupPhone: true,
      },
    });

    if (!facility) {
      return {
        sent: false,
        message: 'Facility record not found',
        error: 'FACILITY_NOT_FOUND',
      };
    }

    // 2. Determine emergency phone number with fallback logic
    const emergencyPhone =
      facility.emergencyPhone ||
      facility.onCallPhone ||
      facility.ambulancePhone ||
      facility.backupPhone;

    if (!emergencyPhone) {
      return {
        sent: false,
        message: 'No emergency phone number configured for facility',
        error: 'NO_EMERGENCY_PHONE',
      };
    }

    // 3. Send SMS to facility emergency line
    // NOTE: We intentionally do NOT pass userId here, so consent check is skipped
    // This is a critical safety feature for emergencies
    const smsResult = await sendSMS({
      to: emergencyPhone,
      message: message,
      type: 'FACILITY_EMERGENCY',
      // No userId = consent check bypassed (by design)
    });

    if (smsResult.sent && smsResult.messageId) {
      console.log(
        `Emergency notification sent to ${facility.name} (${emergencyPhone}): ${smsResult.messageId}`
      );
      return {
        sent: true,
        message: `Facility emergency contact notified`,
        smsMessageId: smsResult.messageId,
      };
    }

    // SMS send failed
    return {
      sent: false,
      message: `Failed to send emergency SMS to facility: ${smsResult.error || 'Unknown error'}`,
      error: smsResult.error || 'SMS_SEND_FAILED',
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`Error in notifyFacilityEmergency for facility ${facilityId}:`, errorMsg);

    return {
      sent: false,
      message: `Error notifying facility: ${errorMsg}`,
      error: 'INTERNAL_ERROR',
    };
  }
}

/**
 * Checks if a user has given consent for SMS communication
 * Internal helper function used by notify functions
 *
 * @param motherId - Mother ID to check consent for
 * @returns Object with consent status
 */
async function checkConsentRecord(motherId: number): Promise<{ hasConsent: boolean }> {
  try {
    // Query ConsentRecord for SMS_COMMUNICATION consent records for this mother
    const consentRecords = await db.consentRecord.findMany({
      where: {
        motherId: motherId,
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
    // On database error, log but deny (fail-closed for consent)
    console.error('Error checking consent record:', error);
    return { hasConsent: false };
  }
}
