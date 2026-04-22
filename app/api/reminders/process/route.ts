import { NextRequest, NextResponse } from 'next/server';
import { processReminders } from '@/services/reminder';

/**
 * GET /api/reminders/process
 * Background cron job endpoint to process pending ANC appointment reminders
 * 
 * SECURITY: Requires Bearer token matching REMINDER_CRON_SECRET environment variable
 * This should be called by external cron service (EasyCron, AWS EventBridge, GitHub Actions, etc.)
 * running on an hourly schedule.
 *
 * Request:
 * GET /api/reminders/process HTTP/1.1
 * Authorization: Bearer <REMINDER_CRON_SECRET>
 * 
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": {
 *     "total": 5,
 *     "sent": 4,
 *     "failed": 1,
 *     "startTime": "2026-04-17T10:00:00Z",
 *     "endTime": "2026-04-17T10:00:45Z",
 *     "results": [
 *       {
 *         "reminderId": 1,
 *         "motherId": 42,
 *         "status": "SENT",
 *         "messageId": "msg_12345"
 *       },
 *       {
 *         "reminderId": 2,
 *         "motherId": 43,
 *         "status": "FAILED",
 *         "error": "OPT_OUT"
 *       }
 *     ]
 *   },
 *   "message": "Processed 5 pending reminders: 4 sent, 1 failed"
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
 * Set up external cron to call: GET https://your-domain.com/api/reminders/process
 * with header: Authorization: Bearer <REMINDER_CRON_SECRET>
 * 
 * Examples:
 * - EasyCron: https://www.easycron.com (HTTP GET with Authorization header)
 * - AWS EventBridge: Lambda function calling this endpoint
 * - GitHub Actions: Scheduled workflow (cron schedule: "0 * * * *" = every hour)
 * - cron-job.org: HTTP GET with Authorization header
 */
export async function GET(request: NextRequest) {
  try {
    // ========================================================================
    // 1. VALIDATE CRON SECRET
    // ========================================================================
    const cronSecret = process.env.REMINDER_CRON_SECRET;

    if (!cronSecret || cronSecret.trim() === '') {
      console.warn('REMINDER_CRON_SECRET not configured - cron endpoint disabled');
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
    // 2. PROCESS REMINDERS
    // ========================================================================
    const summary = await processReminders();

    // ========================================================================
    // 3. RETURN RESULTS
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: {
          total: summary.total,
          sent: summary.sent,
          failed: summary.failed,
          startTime: summary.startTime,
          endTime: summary.endTime,
          results: summary.results,
        },
        message: `Processed ${summary.total} pending reminders: ${summary.sent} sent, ${summary.failed} failed`,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in GET /api/reminders/process:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
