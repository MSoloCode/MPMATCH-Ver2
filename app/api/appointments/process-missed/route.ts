import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { processMissedAppointments } from '@/services/appointment';

/**
 * POST /api/appointments/process-missed
 * Background cron job endpoint to process missed appointments
 *
 * SECURITY: Requires Bearer token matching APPOINTMENT_CRON_SECRET environment variable
 * This should be called by external cron service (EasyCron, AWS EventBridge, GitHub Actions, etc.)
 * running every 4 hours.
 *
 * Business Logic:
 * 1. Find all appointments where status='SCHEDULED' AND appointmentDateTime < NOW() - 24h
 * 2. For each found appointment:
 *    - Update status to 'LIKELY_MISSED'
 *    - Create a Task entry for the assigned CHW (if assigned)
 *    - Log audit entries for both UPDATE and CREATE actions
 *
 * Request:
 * POST /api/appointments/process-missed HTTP/1.1
 * Authorization: Bearer <APPOINTMENT_CRON_SECRET>
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": {
 *     "processed": 5,
 *     "failed": 0,
 *     "tasksCreated": 5,
 *     "startTime": "2026-04-20T10:00:00Z",
 *     "endTime": "2026-04-20T10:00:45Z",
 *     "results": [
 *       {
 *         "appointmentId": 42,
 *         "motherId": 100,
 *         "assignedCHWId": 5,
 *         "taskId": 123,
 *         "status": "SUCCESS"
 *       },
 *       {
 *         "appointmentId": 43,
 *         "motherId": 101,
 *         "assignedCHWId": null,
 *         "taskId": null,
 *         "status": "NO_CHW_ASSIGNED"
 *       }
 *     ]
 *   },
 *   "message": "Processed 5 appointments: 5 marked as LIKELY_MISSED"
 * }
 *
 * Response on unauthorized (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized - invalid or missing cron secret"
 * }
 *
 * Response on server error (500):
 * {
 *   "success": false,
 *   "error": "Internal server error"
 * }
 *
 * DEPLOYMENT NOTES:
 * Set up external cron to call: POST https://your-domain.com/api/appointments/process-missed
 * with header: Authorization: Bearer <APPOINTMENT_CRON_SECRET>
 * Schedule: Every 4 hours (cron: 0 asterisk/4 asterisk asterisk asterisk)
 *
 * Examples:
 * - EasyCron: https://www.easycron.com (HTTP POST with Authorization header)
 * - AWS EventBridge: Lambda function calling this endpoint every 4 hours
 * - GitHub Actions: Scheduled workflow (cron schedule: 0 asterisk/4 asterisk asterisk asterisk = every 4 hours)
 * - cron-job.org: HTTP POST with Authorization header
 */
export async function POST(request: NextRequest) {
  const startTime = new Date();

  try {
    // ========================================================================
    // 1. VALIDATE CRON SECRET
    // ========================================================================
    const cronSecret = process.env.APPOINTMENT_CRON_SECRET;

    if (!cronSecret || cronSecret.trim() === '') {
      console.warn('APPOINTMENT_CRON_SECRET not configured - cron endpoint disabled');
      return NextResponse.json(
        {
          success: false,
          error: 'Cron secret not configured on server',
        },
        { status: 500 }
      );
    }

    // Extract Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('Cron request without Authorization header');
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized - missing Authorization header',
        },
        { status: 401 }
      );
    }

    const providedSecret = authHeader.substring('Bearer '.length);
    if (providedSecret !== cronSecret) {
      console.warn('Cron request with invalid secret');
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized - invalid cron secret',
        },
        { status: 401 }
      );
    }

    // ========================================================================
    // 2. PROCESS MISSED APPOINTMENTS
    // ========================================================================
    const result = await processMissedAppointments();

    // ========================================================================
    // 3. RETURN SUCCESS RESPONSE
    // ========================================================================
    const endTime = new Date();
    return NextResponse.json(
      {
        success: true,
        data: {
          ...result,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
        message: `Processed ${result.processed} appointments: ${result.processed} marked as LIKELY_MISSED, ${result.tasksCreated} follow-up tasks created`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in POST /api/appointments/process-missed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/appointments/process-missed
 * Alias for POST (to support cron services that default to GET)
 */
export async function GET(request: NextRequest) {
  return POST(request);
}
