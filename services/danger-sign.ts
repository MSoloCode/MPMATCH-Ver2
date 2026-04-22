import { db } from '@/lib/db';
import { sendSMS } from './sms';

interface TriggerDangerSignAlertParams {
  motherId: number;
  pregnancyId: number;
  ancVisitId: number;
  dangerSigns: string[];
  actorId: number;
}

interface TriggerDangerSignAlertResult {
  alertId: number;
  notifiedCount: number;
}

/**
 * Triggers a danger sign alert workflow:
 * 1. Checks for existing OPEN DANGER_SIGN alert for this ancVisitId
 * 2. Updates existing alert or creates new one
 * 3. Looks up and notifies: facility on-call phone, assigned CHW, assigned midwife
 * 4. Sends SMS to all recipients
 * 5. Creates SmsLog records
 * 6. Returns alert ID and notification count
 */
export async function triggerDangerSignAlert(
  params: TriggerDangerSignAlertParams
): Promise<TriggerDangerSignAlertResult> {
  const { motherId, pregnancyId, ancVisitId, dangerSigns, actorId } = params;

  // Step 1: Check for existing OPEN DANGER_SIGN alert for this ancVisitId
  const existingAlert = await db.alert.findFirst({
    where: {
      ancVisitId,
      type: 'DANGER_SIGN',
      status: 'OPEN'
    }
  });

  let alertId: number;
  let isNewAlert = false;

  if (existingAlert) {
    // Step 2a: Update existing alert with new danger signs
    try {
      const currentMetadata = existingAlert.metadata
        ? typeof existingAlert.metadata === 'string'
          ? JSON.parse(existingAlert.metadata)
          : existingAlert.metadata
        : { dangerSigns: [] };

      const existingDangerSigns = Array.isArray(currentMetadata.dangerSigns)
        ? currentMetadata.dangerSigns
        : [];

      // Merge danger signs, avoiding duplicates
      const mergedDangerSigns = Array.from(
        new Set([...existingDangerSigns, ...dangerSigns])
      );

      const updatedMetadata = {
        ...currentMetadata,
        dangerSigns: mergedDangerSigns,
        updatedAt: new Date().toISOString()
      };

      const updated = await db.alert.update({
        where: { id: existingAlert.id },
        data: {
          metadata: JSON.stringify(updatedMetadata)
        }
      });

      alertId = updated.id;
    } catch (error) {
      console.error('Failed to update existing danger sign alert:', error);
      alertId = existingAlert.id;
    }
  } else {
    // Step 2b: Create new alert
    try {
      const newAlert = await db.alert.create({
        data: {
          motherId,
          pregnancyId,
          ancVisitId,
          type: 'DANGER_SIGN',
          status: 'OPEN',
          initiatedById: actorId,
          metadata: JSON.stringify({
            dangerSigns,
            createdAt: new Date().toISOString()
          })
        }
      });

      alertId = newAlert.id;
      isNewAlert = true;
    } catch (error) {
      console.error('Failed to create danger sign alert:', error);
      throw new Error('Failed to create danger sign alert');
    }
  }

  // Step 3: Look up notification recipients
  let notifiedCount = 0;
  let motherName = 'Patient';
  const notificationRecipients: { phone: string; role: string }[] = [];

  try {
    // Get mother with facility info
    const mother = await db.mother.findUnique({
      where: { id: motherId },
      include: {
        facility: true
      }
    });

    if (!mother || !mother.facility) {
      console.warn(`Mother ${motherId} or facility not found for danger sign alert`);
    } else {
      motherName = mother.fullName;

      // 3a: Facility on-call phone
      if (mother.facility.onCallPhone) {
        notificationRecipients.push({
          phone: mother.facility.onCallPhone,
          role: 'FACILITY_ONCALL'
        });
      }

      // 3b: Assigned CHW (first active CHW in district)
      try {
        const chw = await db.user.findFirst({
          where: {
            districtId: mother.facility.districtId,
            role: 'CHW',
            isActive: true
          },
          select: { phone: true }
        });

        if (chw?.phone) {
          notificationRecipients.push({
            phone: chw.phone,
            role: 'CHW'
          });
        }
      } catch (error) {
        console.warn(`Failed to find CHW for danger sign alert:`, error);
      }

      // 3c: Assigned Midwife (first active midwife in district)
      try {
        const midwife = await db.user.findFirst({
          where: {
            role: 'MIDWIFE',
            isActive: true,
            hospitalId: mother.facility.id
          },
          select: { phone: true }
        });

        if (midwife?.phone) {
          notificationRecipients.push({
            phone: midwife.phone,
            role: 'MIDWIFE'
          });
        }
      } catch (error) {
        console.warn(`Failed to find midwife for danger sign alert:`, error);
      }
    }
  } catch (error) {
    console.error('Failed to look up notification recipients:', error);
  }

  // Step 4: Send SMS to all recipients
  const dangerSignsText = dangerSigns.join(', ');
  const smsMessage = `DANGER SIGN reported for ${motherName}: ${dangerSignsText}. Please respond.`;

  const smsPromises = notificationRecipients.map(async (recipient) => {
    try {
      const result = await sendSMS({
        to: recipient.phone,
        message: smsMessage,
        type: 'DANGER_SIGN_ALERT',
        userId: actorId
      });

      if (result.sent) {
        notifiedCount++;
      }

      return result;
    } catch (error) {
      console.error(
        `Failed to send SMS to ${recipient.role} at ${recipient.phone}:`,
        error
      );
      return { sent: false, error: String(error) };
    }
  });

  try {
    await Promise.all(smsPromises);
  } catch (error) {
    console.error('Error sending SMS notifications:', error);
    // Don't throw - SMS failures should not break the alert creation
  }

  return {
    alertId,
    notifiedCount
  };
}
