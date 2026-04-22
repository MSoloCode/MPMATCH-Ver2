import { db } from '@/lib/db';
import { sendSMS } from './sms';

/**
 * Result from processing a single reminder
 */
interface ReminderProcessResult {
  reminderId: number;
  motherId: number;
  status: 'SENT' | 'FAILED';
  messageId?: string;
  error?: string;
}

/**
 * Summary of reminder processing job
 */
export interface RemindersProcessingSummary {
  total: number;
  sent: number;
  failed: number;
  results: ReminderProcessResult[];
  startTime: Date;
  endTime: Date;
}

/**
 * Processes pending reminders that are due to be sent (sendAt <= now)
 * 
 * For each reminder:
 * 1. Fetch related mother and facility data
 * 2. Send SMS with appointment reminder message
 * 3. Update ReminderSchedule status to SENT (with sentAt timestamp) on success
 * 4. Update ReminderSchedule status to FAILED (with error log) on failure
 * 
 * @returns Summary object with processing statistics
 * 
 * @example
 * const summary = await processReminders();
 * console.log(`Processed ${summary.total} reminders: ${summary.sent} sent, ${summary.failed} failed`);
 */
export async function processReminders(): Promise<RemindersProcessingSummary> {
  const startTime = new Date();
  const results: ReminderProcessResult[] = [];

  try {
    // ========================================================================
    // 1. FIND ALL PENDING REMINDERS DUE FOR SENDING
    // ========================================================================
    const now = new Date();
    const pendingReminders = await db.reminderSchedule.findMany({
      where: {
        status: 'PENDING',
        sendAt: {
          lte: now, // sendAt <= now
        },
      },
      include: {
        mother: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            facility: {
              select: {
                name: true,
              },
            },
          },
        },
        ancVisit: {
          select: {
            id: true,
            nextAppointment: true,
          },
        },
      },
    });

    console.log(`Found ${pendingReminders.length} pending reminders to process`);

    // ========================================================================
    // 2. PROCESS EACH REMINDER
    // ========================================================================
    for (const reminder of pendingReminders) {
      try {
        const { mother, ancVisit } = reminder;

        if (!mother || !mother.phone) {
          // Skip reminder if mother data is missing
          console.warn(
            `[Reminder ${reminder.id}] Mother ${reminder.motherId} missing or no phone number`
          );
          await db.reminderSchedule.update({
            where: { id: reminder.id },
            data: {
              status: 'FAILED',
              errorLog: 'Mother data missing or no phone number',
            },
          });
          results.push({
            reminderId: reminder.id,
            motherId: reminder.motherId,
            status: 'FAILED',
            error: 'Mother data missing',
          });
          continue;
        }

        // Build reminder message
        const facilityName = mother.facility?.name || 'your facility';
        const message = `Hello ${mother.fullName}, your ANC appointment is tomorrow at ${facilityName}. Please attend on time.`;

        // ====================================================================
        // 3. SEND SMS
        // ====================================================================
        const smsResult = await sendSMS({
          to: mother.phone,
          message: message,
          type: 'ANC_REMINDER',
          userId: undefined, // Reminder system is automated, not user-initiated
        });

        if (smsResult.sent) {
          // ================================================================
          // 4A. UPDATE REMINDER AS SENT
          // ================================================================
          await db.reminderSchedule.update({
            where: { id: reminder.id },
            data: {
              status: 'SENT',
              sentAt: new Date(),
            },
          });

          console.log(
            `[Reminder ${reminder.id}] Successfully sent to ${mother.phone} (MessageID: ${smsResult.messageId})`
          );

          results.push({
            reminderId: reminder.id,
            motherId: reminder.motherId,
            status: 'SENT',
            messageId: smsResult.messageId,
          });
        } else {
          // ================================================================
          // 4B. UPDATE REMINDER AS FAILED
          // ================================================================
          const errorMessage = smsResult.error || 'Unknown SMS gateway error';

          await db.reminderSchedule.update({
            where: { id: reminder.id },
            data: {
              status: 'FAILED',
              errorLog: errorMessage,
            },
          });

          console.error(
            `[Reminder ${reminder.id}] Failed to send to ${mother.phone}: ${errorMessage}`
          );

          results.push({
            reminderId: reminder.id,
            motherId: reminder.motherId,
            status: 'FAILED',
            error: errorMessage,
          });
        }
      } catch (error) {
        // Catch individual reminder processing errors to not break the batch
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Reminder ${reminder.id}] Error processing reminder:`, error);

        try {
          await db.reminderSchedule.update({
            where: { id: reminder.id },
            data: {
              status: 'FAILED',
              errorLog: `Processing error: ${errorMsg}`,
            },
          });
        } catch (updateError) {
          console.error(
            `[Reminder ${reminder.id}] Failed to update reminder status:`,
            updateError
          );
        }

        results.push({
          reminderId: reminder.id,
          motherId: reminder.motherId,
          status: 'FAILED',
          error: errorMsg,
        });
      }
    }

    // ========================================================================
    // 5. RETURN SUMMARY
    // ========================================================================
    const endTime = new Date();
    const sent = results.filter((r) => r.status === 'SENT').length;
    const failed = results.filter((r) => r.status === 'FAILED').length;

    const summary: RemindersProcessingSummary = {
      total: results.length,
      sent,
      failed,
      results,
      startTime,
      endTime,
    };

    console.log(
      `[Reminder Processing Complete] Total: ${summary.total}, Sent: ${summary.sent}, Failed: ${summary.failed} (Duration: ${endTime.getTime() - startTime.getTime()}ms)`
    );

    return summary;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Fatal error in processReminders:', error);

    const endTime = new Date();
    return {
      total: 0,
      sent: 0,
      failed: 0,
      results: [],
      startTime,
      endTime,
    };
  }
}
