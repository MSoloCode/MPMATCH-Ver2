import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { sendSMS, SendSmsInput } from '@/services/sms';

/**
 * Request body validation interface
 */
interface SendSmsRequestBody {
  to: string;
  message: string;
  type: string;
  userId?: number;
}

/**
 * POST /api/sms
 * Send an SMS message with role-based authorization
 *
 * Request body:
 * {
 *   "to": "+256701234567",
 *   "message": "Hello, this is a test message",
 *   "type": "reminder",
 *   "userId": 123 (optional - for consent checking)
 * }
 *
 * Required roles: SYSTEM_ADMIN, HOSPITAL_ADMIN, ORG_ADMIN, DHO, DOCTOR, MIDWIFE, NURSE, CHW
 *
 * Response on success:
 * {
 *   "success": true,
 *   "message": "SMS sent successfully",
 *   "data": {
 *     "sent": true,
 *     "messageId": "message-id-from-gateway"
 *   }
 * }
 *
 * Response on failure:
 * {
 *   "success": false,
 *   "error": "Error message",
 *   "details": {
 *     "sent": false,
 *     "error": "OPT_OUT" or other error code
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // ========================================================================
    // 1. AUTHENTICATION: Verify JWT token
    // ========================================================================
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid Authorization header',
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    let user: Record<string, any>;

    try {
      user = verifyToken(token);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired token',
        },
        { status: 401 }
      );
    }

    const actorId = user.id;
    const actorRole = user.role;

    if (!actorId || !actorRole) {
      return NextResponse.json(
        {
          success: false,
          error: 'Token missing required fields (id, role)',
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // 2. AUTHORIZATION: Check RBAC permission to send SMS
    // ========================================================================
    const hasPermission = await canAccess(actorRole, 'sms', 'send');

    if (!hasPermission) {
      // Log unauthorized attempt
      const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';

      await writeAuditLog({
        actorId,
        actorRole,
        action: 'CREATE',
        resource: 'sms',
        resourceId: 0, // No specific resource ID for SMS send attempts
        changesSummary: 'UNAUTHORIZED_SMS_SEND_ATTEMPT: User attempted to send SMS without permission',
        ipAddress,
        userAgent,
      }).catch((err) => console.error('Failed to log unauthorized SMS attempt:', err));

      return NextResponse.json(
        {
          success: false,
          error: 'You do not have permission to send SMS messages',
        },
        { status: 403 }
      );
    }

    // ========================================================================
    // 3. VALIDATE REQUEST BODY
    // ========================================================================
    let body: SendSmsRequestBody;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body - must be valid JSON',
        },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.to || typeof body.to !== 'string' || body.to.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid "to" field (recipient phone number)',
        },
        { status: 400 }
      );
    }

    if (!body.message || typeof body.message !== 'string' || body.message.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid "message" field',
        },
        { status: 400 }
      );
    }

    if (!body.type || typeof body.type !== 'string' || body.type.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid "type" field (message category)',
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // 4. SEND SMS
    // ========================================================================
    const smsInput: SendSmsInput = {
      to: body.to.trim(),
      message: body.message.trim(),
      type: body.type.trim(),
      userId: body.userId,
    };

    const smsResult = await sendSMS(smsInput);

    // ========================================================================
    // 5. AUDIT LOGGING
    // ========================================================================
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await writeAuditLog({
      actorId,
      actorRole,
      action: 'CREATE',
      resource: 'sms',
      resourceId: 0, // No specific resource ID for SMS sends
      changesSummary: JSON.stringify({
        status: smsResult.sent ? 'SMS_SENT' : 'SMS_FAILED',
        to: smsInput.to,
        type: smsInput.type,
        sent: smsResult.sent,
        messageId: smsResult.messageId,
        error: smsResult.error,
      }),
      ipAddress,
      userAgent,
    }).catch((err) => console.error('Failed to log SMS attempt:', err));

    // ========================================================================
    // 6. RETURN RESPONSE
    // ========================================================================
    if (smsResult.sent) {
      return NextResponse.json(
        {
          success: true,
          message: 'SMS sent successfully',
          data: {
            sent: true,
            messageId: smsResult.messageId,
          },
        },
        { status: 200 }
      );
    }

    // SMS sending failed
    const statusCode = smsResult.error === 'OPT_OUT' ? 403 : 400;
    return NextResponse.json(
      {
        success: false,
        error: smsResult.error === 'OPT_OUT'
          ? 'User has opted out of SMS communication'
          : `Failed to send SMS: ${smsResult.error}`,
        details: {
          sent: false,
          error: smsResult.error,
        },
      },
      { status: statusCode }
    );
  } catch (error) {
    // Unexpected error
    console.error('SMS endpoint error:', error);

    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while processing your request',
        details: errorMsg,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sms
 * Returns SMS service status and capabilities
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Add authentication for status endpoint
    const authHeader = request.headers.get('Authorization');
    
    return NextResponse.json(
      {
        success: true,
        service: 'SMS',
        status: 'operational',
        endpoints: {
          POST: {
            description: 'Send an SMS message',
            path: '/api/sms',
            requiredFields: ['to', 'message', 'type'],
            optionalFields: ['userId'],
            requiredPermission: 'sms:send',
            exampleRequest: {
              to: '+256701234567',
              message: 'Hello, this is a test message',
              type: 'reminder',
              userId: 123,
            },
          },
        },
        gateways: ['africastalking', 'twilio'],
        lastUpdated: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve SMS service status',
      },
      { status: 500 }
    );
  }
}
