import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendSMS } from '@/services/sms';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';

/**
 * Request body validation interface
 */
interface EmergencyAlertRequestBody {
  motherPhone: string;
  facilityId?: string | number;
  description?: string;
}

/**
 * POST /api/emergency-alert
 * Create an emergency alert with facility notification (PUBLIC - no authentication required)
 *
 * Request body:
 * {
 *   "motherPhone": "0701234567" or "+256701234567",
 *   "facilityId": 1,
 *   "description": "Severe headache and blurred vision"
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "message": "Emergency alert created and notification sent",
 *   "data": {
 *     "alertId": 123,
 *     "facilityContacts": {
 *       "emergencyLine": "0414671234",
 *       "ambulance": "0701111111",
 *       "onCall": "0702222222",
 *       "backup": "0703333333"
 *     }
 *   }
 * }
 *
 * Response on validation failure (422):
 * {
 *   "success": false,
 *   "error": "Invalid phone format. Must be 07XXXXXX or +256XXXXXXXXX"
 * }
 *
 * Response on missing facilityId (400):
 * {
 *   "success": false,
 *   "error": "facilityId is required"
 * }
 *
 * Response on facility not found (404):
 * {
 *   "success": false,
 *   "error": "Facility not found"
 * }
 *
 * Response on server error (500):
 * {
 *   "success": false,
 *   "error": "Internal server error"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // ========================================================================
    // 1. PARSE & VALIDATE REQUEST BODY
    // ========================================================================
    let body: EmergencyAlertRequestBody;

    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
        },
        { status: 400 }
      );
    }

    const { motherPhone, facilityId, description } = body;

    // ========================================================================
    // 2. VALIDATE INPUTS
    // ========================================================================

    // Validate motherPhone format: 07XXXXXX or +256XXXXXXXXX
    if (!motherPhone || typeof motherPhone !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'motherPhone is required and must be a string',
        },
        { status: 422 }
      );
    }

    const phoneRegex = /^(07\d{6}|\+256[0-9]{9})$/;
    if (!phoneRegex.test(motherPhone.trim())) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid phone format. Must be 07XXXXXX or +256XXXXXXXXX',
        },
        { status: 422 }
      );
    }

    // Validate facilityId is provided and is a valid number
    if (!facilityId) {
      return NextResponse.json(
        {
          success: false,
          error: 'facilityId is required',
        },
        { status: 400 }
      );
    }

    const facilityIdNumber = Number(facilityId);
    if (!Number.isInteger(facilityIdNumber) || facilityIdNumber <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'facilityId must be a positive integer',
        },
        { status: 422 }
      );
    }

    // Validate description (optional)
    const trimmedDescription = description
      ? String(description).trim().substring(0, 500)
      : null;

    // ========================================================================
    // 3. EXTRACT AUDIT CONTEXT
    // ========================================================================
    const { ipAddress, userAgent } = extractAuditContext(request);

    // ========================================================================
    // 4. LOOK UP FACILITY
    // ========================================================================
    const facility = await db.facility.findUnique({
      where: { id: facilityIdNumber },
      select: {
        id: true,
        name: true,
        emergencyPhone: true,
        ambulancePhone: true,
        onCallPhone: true,
        backupPhone: true,
      },
    });

    if (!facility) {
      return NextResponse.json(
        {
          success: false,
          error: 'Facility not found',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 5. LOOK UP MOTHER BY PHONE (OPTIONAL - DOESN'T FAIL IF NOT FOUND)
    // ========================================================================
    let motherId: number | null = null;

    try {
      const mother = await db.mother.findUnique({
        where: { phone: motherPhone.toLowerCase() },
        select: { id: true },
      });

      if (mother) {
        motherId = mother.id;
      }
    } catch (error) {
      // Log but don't fail on mother lookup error
      console.error('Error looking up mother by phone:', error);
    }

    // ========================================================================
    // 6. CREATE ALERT RECORD (IN PARALLEL WITH SMS SEND)
    // ========================================================================
    const alertPromise = db.alert.create({
      data: {
        type: 'MANUAL_EMERGENCY',
        status: 'OPEN',
        motherId: motherId,
        pregnancyId: null,
        ancVisitId: null,
        initiatedById: null,
        assignedToId: null,
        metadata: JSON.stringify({
          motherPhone: motherPhone,
          description: trimmedDescription,
          facilityId: facilityIdNumber,
          createdVia: 'emergency_alert_public',
        }),
      },
      select: { id: true },
    });

    // ========================================================================
    // 7. SEND SMS TO FACILITY ON-CALL NUMBER (IN PARALLEL WITH ALERT CREATION)
    // ========================================================================
    const smsPromise = (async () => {
      if (!facility.onCallPhone) {
        return {
          sent: false,
          error: 'No on-call number available for facility',
        };
      }

      try {
        const smsResponse = await sendSMS({
          to: facility.onCallPhone,
          message: `Emergency Alert from Mother (${motherPhone}): ${
            trimmedDescription || 'No description provided'
          }. Facility: ${facility.name}`,
          type: 'MANUAL_EMERGENCY',
          userId: undefined, // Public request, no authenticated user
        });

        return smsResponse;
      } catch (error) {
        console.error('Error sending SMS to facility:', error);
        return {
          sent: false,
          error: 'SMS send failed',
        };
      }
    })();

    // Wait for both alert creation and SMS send to complete
    const [alert, smsResponse] = await Promise.all([alertPromise, smsPromise]);

    // ========================================================================
    // 8. WRITE AUDIT LOG
    // ========================================================================
    try {
      await writeAuditLog({
        actorId: null,
        actorRole: 'PUBLIC',
        action: 'CREATE',
        resource: 'alert',
        resourceId: alert.id,
        changesSummary: {
          alertType: 'MANUAL_EMERGENCY',
          motherPhone: motherPhone,
          facilityId: facilityIdNumber,
          description: trimmedDescription,
          motherId: motherId,
          smsSent: smsResponse.sent,
          smsMessageId: smsResponse.messageId || null,
          smsError: smsResponse.error || null,
        },
        ipAddress: ipAddress,
        userAgent: userAgent,
      });
    } catch (error) {
      // Log audit error but don't fail the request
      console.error('Failed to write audit log:', error);
    }

    // ========================================================================
    // 9. RETURN SUCCESS RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        message: 'Emergency alert created and notification sent',
        data: {
          alertId: alert.id,
          facilityContacts: {
            emergencyLine: facility.emergencyPhone || null,
            ambulance: facility.ambulancePhone || null,
            onCall: facility.onCallPhone || null,
            backup: facility.backupPhone || null,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in emergency alert handler:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
