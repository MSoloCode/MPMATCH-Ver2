import { db } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';

/**
 * Result object returned by processMissedAppointments function
 */
export interface MissedAppointmentsProcessingResult {
  processed: number;
  failed: number;
  tasksCreated: number;
  results: MissedAppointmentResult[];
}

/**
 * Individual result for each processed appointment
 */
export interface MissedAppointmentResult {
  appointmentId: number;
  motherId: number;
  assignedCHWId: number | null;
  taskId: number | null;
  status: 'SUCCESS' | 'NO_CHW_ASSIGNED' | 'TASK_CREATION_FAILED' | 'UPDATE_FAILED';
  error?: string;
}

/**
 * Process missed appointments (appointments that should have happened but didn't)
 *
 * Business Logic:
 * 1. Find all appointments where:
 *    - status = 'SCHEDULED'
 *    - appointmentDateTime < NOW() - 24 hours
 *
 * 2. For each appointment found:
 *    - Update status to 'LIKELY_MISSED'
 *    - If a CHW is assigned, create a follow-up Task with:
 *      - title: "Follow-up for missed appointment"
 *      - description: "Mother missed appointment scheduled for [date]"
 *      - type: "CHW_FOLLOWUP"
 *      - priority: "HIGH"
 *      - status: "OPEN"
 *      - assignedToId: the CHW's ID
 *      - dueDate: now + 7 days
 *    - Log audit entries for both the appointment UPDATE and Task CREATE
 *
 * 3. Return summary with processed count, failed count, and details for each appointment
 *
 * @returns Promise<MissedAppointmentsProcessingResult> - Summary of processing results
 * @throws Error if database operations fail critically
 */
export async function processMissedAppointments(): Promise<MissedAppointmentsProcessingResult> {
  const results: MissedAppointmentResult[] = [];
  let processed = 0;
  let failed = 0;
  let tasksCreated = 0;

  try {
    // ========================================================================
    // 1. FIND MISSED APPOINTMENTS
    // ========================================================================
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const missedAppointments = await db.appointment.findMany({
      where: {
        status: 'SCHEDULED',
        appointmentDateTime: {
          lt: twentyFourHoursAgo,
        },
      },
      select: {
        id: true,
        motherId: true,
        assignedCHWId: true,
        appointmentDateTime: true,
        mother: {
          select: {
            fullName: true,
          },
        },
      },
    });

    console.log(`Found ${missedAppointments.length} missed appointments to process`);

    // ========================================================================
    // 2. PROCESS EACH APPOINTMENT
    // ========================================================================
    for (const appointment of missedAppointments) {
      try {
        // ====================================================================
        // 2a. UPDATE APPOINTMENT STATUS TO LIKELY_MISSED
        // ====================================================================
        const updated = await db.appointment.update({
          where: { id: appointment.id },
          data: { status: 'LIKELY_MISSED' },
          select: { id: true, status: true },
        });

        processed++;

        // ====================================================================
        // 2b. LOG APPOINTMENT UPDATE AUDIT
        // ====================================================================
        await writeAuditLog({
          actorId: null, // System action
          actorRole: 'SYSTEM_ADMIN',
          action: 'UPDATE',
          resource: 'appointment',
          resourceId: appointment.id,
          changesSummary: {
            reason: 'Automatic: Appointment missed (>24h past due date)',
            oldStatus: 'SCHEDULED',
            newStatus: 'LIKELY_MISSED',
            appointmentDateTime: appointment.appointmentDateTime.toISOString(),
            motherName: appointment.mother.fullName,
          },
          ipAddress: null,
          userAgent: 'CRON_JOB',
        }).catch((error) => {
          console.error(
            `Failed to write audit log for appointment ${appointment.id}:`,
            error
          );
        });

        // ====================================================================
        // 2c. CREATE FOLLOW-UP TASK IF CHW IS ASSIGNED
        // ====================================================================
        let taskId: number | null = null;
        let taskStatus: MissedAppointmentResult['status'] = 'SUCCESS';
        let taskError: string | undefined;

        if (appointment.assignedCHWId) {
          try {
            const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

            const task = await db.task.create({
              data: {
                appointmentId: appointment.id,
                title: 'Follow-up for missed appointment',
                description: `Mother ${appointment.mother.fullName} missed appointment scheduled for ${new Date(
                  appointment.appointmentDateTime
                ).toLocaleDateString()}. Please contact and reschedule.`,
                type: 'CHW_FOLLOWUP',
                priority: 'HIGH',
                status: 'OPEN',
                assignedToId: appointment.assignedCHWId,
                createdById: null, // System-initiated task
                dueDate,
              },
              select: { id: true },
            });

            taskId = task.id;
            tasksCreated++;

            // ============================================================
            // 2d. LOG TASK CREATION AUDIT
            // ============================================================
            await writeAuditLog({
              actorId: null, // System action
              actorRole: 'SYSTEM_ADMIN',
              action: 'CREATE',
              resource: 'task',
              resourceId: task.id,
              changesSummary: {
                reason: 'Automatic: Follow-up task for missed appointment',
                appointmentId: appointment.id,
                motherId: appointment.motherId,
                type: 'CHW_FOLLOWUP',
                priority: 'HIGH',
                status: 'OPEN',
                assignedToId: appointment.assignedCHWId,
                dueDate: dueDate.toISOString(),
              },
              ipAddress: null,
              userAgent: 'CRON_JOB',
            }).catch((error) => {
              console.error(`Failed to write audit log for task ${task.id}:`, error);
            });
          } catch (error) {
            failed++;
            taskStatus = 'TASK_CREATION_FAILED';
            taskError = error instanceof Error ? error.message : 'Unknown error';
            console.error(
              `Failed to create follow-up task for appointment ${appointment.id}:`,
              error
            );
          }
        } else {
          taskStatus = 'NO_CHW_ASSIGNED';
        }

        results.push({
          appointmentId: appointment.id,
          motherId: appointment.motherId,
          assignedCHWId: appointment.assignedCHWId,
          taskId,
          status: taskStatus,
          error: taskError,
        });
      } catch (error) {
        failed++;
        console.error(`Failed to process appointment ${appointment.id}:`, error);

        results.push({
          appointmentId: appointment.id,
          motherId: appointment.motherId,
          assignedCHWId: appointment.assignedCHWId,
          taskId: null,
          status: 'UPDATE_FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // ========================================================================
    // 3. RETURN SUMMARY
    // ========================================================================
    console.log(
      `Missed appointments processing complete: processed=${processed}, failed=${failed}, tasksCreated=${tasksCreated}`
    );

    return {
      processed,
      failed,
      tasksCreated,
      results,
    };
  } catch (error) {
    console.error('Critical error in processMissedAppointments:', error);
    throw error;
  }
}
