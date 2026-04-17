import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  extractUser,
  UnauthorizedError,
  ForbiddenError,
} from '@/lib/rbac';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';

/**
 * PATCH /api/pregnancies/:id/status
 * Close or deliver a pregnancy episode
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles: DOCTOR, NURSE, MIDWIFE, HOSPITAL_ADMIN, SYSTEM_ADMIN
 *
 * URL parameters:
 * - id: Pregnancy ID (number)
 *
 * Request body (JSON):
 * {
 *   "status": "CLOSED" | "DELIVERED" (required),
 *   "deliveryDate": ISO date string (required if status=DELIVERED),
 *   "deliveryOutcome": "LIVE_BIRTH" | "MISCARRIAGE" | "STILLBIRTH" | "ABORTION" (required if status=DELIVERED),
 *   "deliveryMode": "SVD" | "C_SECTION" | "ASSISTED" (required if status=DELIVERED),
 *   "babyWeightKg": number (optional),
 *   "complications": string[] (optional)
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "message": "Pregnancy closed successfully" or "Pregnancy delivered - postnatal follow-up scheduled",
 *   "data": {
 *     "pregnancyId": 1,
 *     "status": "CLOSED" | "DELIVERED",
 *     "closedAt": ISO timestamp,
 *     "deliveryDate": ISO date (if DELIVERED),
 *     "deliveryOutcome": string (if DELIVERED),
 *     "followUpAppointmentId": number (if DELIVERED - auto-scheduled postnatal visit)
 *   }
 * }
 *
 * Response on validation error (422):
 * {
 *   "success": false,
 *   "error": "Validation error message"
 * }
 *
 * Response on not found (404):
 * {
 *   "success": false,
 *   "error": "Pregnancy not found"
 * }
 *
 * Response on unauthorized (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized - no token provided"
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ========================================================================
    // 1. EXTRACT AND VALIDATE AUTHORIZATION
    // ========================================================================
    let user;
    try {
      user = extractUser(request);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 401 }
        );
      }
      throw error;
    }

    // Verify user has permission to update pregnancies
    const allowedRoles = [
      'DOCTOR',
      'NURSE',
      'MIDWIFE',
      'HOSPITAL_ADMIN',
      'SYSTEM_ADMIN',
    ];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions to update pregnancy status',
        },
        { status: 403 }
      );
    }

    // ========================================================================
    // 2. VALIDATE PREGNANCY ID
    // ========================================================================
    const pregnancyId = parseInt(params.id, 10);
    if (isNaN(pregnancyId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid pregnancy ID',
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // 3. PARSE REQUEST BODY
    // ========================================================================
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON body',
        },
        { status: 400 }
      );
    }

    const {
      status,
      deliveryDate,
      deliveryOutcome,
      deliveryMode,
      babyWeightKg,
      complications = [],
    } = body;

    // ========================================================================
    // 4. VALIDATE STATUS FIELD
    // ========================================================================
    if (!status || !['CLOSED', 'DELIVERED'].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'status is required and must be either "CLOSED" or "DELIVERED"',
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 5. VALIDATE DELIVERY-SPECIFIC FIELDS (if status=DELIVERED)
    // ========================================================================
    if (status === 'DELIVERED') {
      // Validate deliveryDate is required and valid
      if (!deliveryDate || typeof deliveryDate !== 'string') {
        return NextResponse.json(
          {
            success: false,
            error:
              'deliveryDate is required for DELIVERED status (ISO date format)',
          },
          { status: 422 }
        );
      }

      let deliveryDateObj;
      try {
        deliveryDateObj = new Date(deliveryDate);
        if (isNaN(deliveryDateObj.getTime())) {
          throw new Error('Invalid date');
        }
      } catch {
        return NextResponse.json(
          {
            success: false,
            error:
              'deliveryDate must be a valid ISO date string (e.g., 2026-04-17)',
          },
          { status: 422 }
        );
      }

      // Validate deliveryOutcome is required
      const validOutcomes = [
        'LIVE_BIRTH',
        'MISCARRIAGE',
        'STILLBIRTH',
        'ABORTION',
      ];
      if (!deliveryOutcome || !validOutcomes.includes(deliveryOutcome)) {
        return NextResponse.json(
          {
            success: false,
            error: `deliveryOutcome is required and must be one of: ${validOutcomes.join(
              ', '
            )}`,
          },
          { status: 422 }
        );
      }

      // Validate deliveryMode is required
      const validDeliveryModes = ['SVD', 'C_SECTION', 'ASSISTED'];
      if (!deliveryMode || !validDeliveryModes.includes(deliveryMode)) {
        return NextResponse.json(
          {
            success: false,
            error: `deliveryMode is required and must be one of: ${validDeliveryModes.join(
              ', '
            )}`,
          },
          { status: 422 }
        );
      }

      // Validate babyWeightKg is optional but must be number if provided
      if (babyWeightKg !== undefined && typeof babyWeightKg !== 'number') {
        return NextResponse.json(
          {
            success: false,
            error: 'babyWeightKg must be a number if provided',
          },
          { status: 422 }
        );
      }

      // Validate complications is optional but must be array if provided
      if (
        complications &&
        (!Array.isArray(complications) || !complications.every((c) => typeof c === 'string'))
      ) {
        return NextResponse.json(
          {
            success: false,
            error: 'complications must be an array of strings if provided',
          },
          { status: 422 }
        );
      }
    }

    // ========================================================================
    // 6. FETCH PREGNANCY TO VERIFY IT EXISTS
    // ========================================================================
    const pregnancy = await db.pregnancy.findUnique({
      where: { id: pregnancyId },
      select: {
        id: true,
        motherId: true,
        status: true,
        lmpDate: true,
      },
    });

    if (!pregnancy) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pregnancy not found',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 7. VALIDATE PREGNANCY CAN BE TRANSITIONED TO NEW STATUS
    // ========================================================================
    const validTransitions: Record<string, string[]> = {
      ACTIVE: ['CLOSED', 'DELIVERED'],
      CLOSED: ['DELIVERED'], // Allow reopening for delivery after closure
      DELIVERED: ['CLOSED'], // Can close after delivery
    };

    if (
      !validTransitions[pregnancy.status] ||
      !validTransitions[pregnancy.status].includes(status)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot transition pregnancy status from ${pregnancy.status} to ${status}`,
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 8. BUILD UPDATE DATA
    // ========================================================================
    const updateData: any = {
      status,
      closedAt: new Date(),
    };

    if (status === 'DELIVERED') {
      updateData.deliveryDate = new Date(deliveryDate);
      updateData.deliveryOutcome = deliveryOutcome;
      updateData.deliveryMode = deliveryMode;

      if (babyWeightKg !== undefined) {
        updateData.babyWeightKg = babyWeightKg;
      }

      if (complications.length > 0) {
        updateData.complications = JSON.stringify(complications);
      }
    }

    // ========================================================================
    // 9. UPDATE PREGNANCY
    // ========================================================================
    const updatedPregnancy = await db.pregnancy.update({
      where: { id: pregnancyId },
      data: updateData,
      select: {
        id: true,
        motherId: true,
        status: true,
        deliveryDate: true,
        deliveryOutcome: true,
        deliveryMode: true,
        babyWeightKg: true,
        complications: true,
        closedAt: true,
        updatedAt: true,
      },
    });

    // ========================================================================
    // 10. IF DELIVERED, CREATE POSTNATAL FOLLOW-UP APPOINTMENT
    // ========================================================================
    let followUpAppointmentId: number | null = null;

    if (status === 'DELIVERED') {
      // Schedule follow-up for 3-5 days post-delivery (postnatal assessment window)
      const followUpDate = new Date(deliveryDate);
      followUpDate.setDate(followUpDate.getDate() + 4); // 4 days post-delivery

      const followUpAppointment = await db.appointment.create({
        data: {
          motherId: pregnancy.motherId,
          pregnancyId: pregnancy.id,
          appointmentDateTime: followUpDate,
          purpose: 'OTHER', // Postnatal follow-up
          purposeOther: 'Postnatal assessment and baby checkup',
          status: 'SCHEDULED',
          notes: `Auto-scheduled postnatal follow-up following delivery on ${new Date(deliveryDate).toISOString().split('T')[0]}`,
          createdById: user.userId,
        },
        select: { id: true },
      });

      followUpAppointmentId = followUpAppointment.id;
    }

    // ========================================================================
    // 11. LOG AUDIT
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId || null,
      actorRole: user.role,
      action: 'UPDATE',
      resource: 'pregnancy',
      resourceId: updatedPregnancy.id,
      changesSummary: {
        statusChange: { from: pregnancy.status, to: status },
        deliveryOutcome: status === 'DELIVERED' ? deliveryOutcome : undefined,
        followUpAppointmentCreated:
          followUpAppointmentId !== null ? followUpAppointmentId : undefined,
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((error) => {
      console.error('Failed to write audit log:', error);
      // Don't fail the request over audit logging
    });

    // ========================================================================
    // 12. RETURN SUCCESS RESPONSE
    // ========================================================================
    const successMessage =
      status === 'DELIVERED'
        ? 'Pregnancy delivered - postnatal follow-up scheduled'
        : 'Pregnancy closed successfully';

    return NextResponse.json(
      {
        success: true,
        message: successMessage,
        data: {
          pregnancyId: updatedPregnancy.id,
          status: updatedPregnancy.status,
          closedAt: updatedPregnancy.closedAt,
          ...(status === 'DELIVERED' && {
            deliveryDate: updatedPregnancy.deliveryDate,
            deliveryOutcome: updatedPregnancy.deliveryOutcome,
            deliveryMode: updatedPregnancy.deliveryMode,
            babyWeightKg: updatedPregnancy.babyWeightKg,
            complications: updatedPregnancy.complications
              ? JSON.parse(updatedPregnancy.complications)
              : [],
            followUpAppointmentId,
          }),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in PATCH /api/pregnancies/[id]/status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
