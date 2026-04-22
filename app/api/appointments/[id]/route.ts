import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  extractUser,
  getTenantScopingFilter,
  assertValidTenantScope,
  UnauthorizedError,
  ForbiddenError,
  ScopedUserPayload,
} from '@/lib/rbac';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';

/**
 * PATCH /api/appointments/[id]
 * Update an appointment (status, reschedule, notes)
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles:
 * - DOCTOR, NURSE, MIDWIFE: Update appointments within their hospital scope
 * - HOSPITAL_ADMIN: Hospital scope
 * - DHO, ORG_ADMIN: Organization/district scope
 * - SYSTEM_ADMIN: Unrestricted access
 *
 * Request body (all optional, at least one required):
 * {
 *   "status": "CONFIRMED",
 *   "appointmentDateTime": "2026-04-25T14:00:00Z",
 *   "notes": "Patient confirmed attending"
 * }
 *
 * Allowed status values:
 * - SCHEDULED, CONFIRMED, ATTENDED, MISSED, CANCELLED
 *
 * Immutable fields (cannot be updated):
 * - motherId, pregnancyId, ancVisitId, purpose, purposeOther, createdById
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": { ...updated appointment object... },
 *   "message": "Appointment updated successfully"
 * }
 *
 * Response on unauthorized (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized - no token provided"
 * }
 *
 * Response on not found (404):
 * {
 *   "success": false,
 *   "error": "Appointment not found"
 * }
 *
 * Response on validation error (422):
 * {
 *   "success": false,
 *   "error": "Invalid status value"
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // ========================================================================
    // 2. CHECK ROLE PERMISSIONS
    // ========================================================================
    const allowedRoles = [
      'DOCTOR',
      'NURSE',
      'MIDWIFE',
      'DHO',
      'ORG_ADMIN',
      'HOSPITAL_ADMIN',
      'SYSTEM_ADMIN',
    ];

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions to update appointments',
        },
        { status: 403 }
      );
    }

    // ========================================================================
    // 3. VALIDATE TENANT SCOPE
    // ========================================================================
    try {
      assertValidTenantScope(user as ScopedUserPayload);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 403 }
        );
      }
      throw error;
    }

    // ========================================================================
    // 4. PARSE ID PARAMETER
    // ========================================================================
    const resolvedParams = await params;
    const appointmentId = parseInt(resolvedParams.id, 10);

    if (isNaN(appointmentId) || appointmentId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid appointment ID',
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 5. PARSE AND VALIDATE REQUEST BODY
    // ========================================================================
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON body',
        },
        { status: 400 }
      );
    }

    const { status, appointmentDateTime, notes } = body;

    // Check if at least one field is provided to update
    if (status === undefined && appointmentDateTime === undefined && notes === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'At least one field must be provided (status, appointmentDateTime, or notes)',
        },
        { status: 422 }
      );
    }

    // Check for immutable field attempts
    const immutableFields = [
      'motherId',
      'pregnancyId',
      'ancVisitId',
      'purpose',
      'purposeOther',
      'createdById',
    ];
    const attemptedImmutableUpdates = immutableFields.filter((field) => field in body);
    if (attemptedImmutableUpdates.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot update immutable fields: ${attemptedImmutableUpdates.join(', ')}`,
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 6. VALIDATE STATUS IF PROVIDED
    // ========================================================================
    if (status !== undefined) {
      if (typeof status !== 'string') {
        return NextResponse.json(
          {
            success: false,
            error: 'status must be a string',
          },
          { status: 422 }
        );
      }

      const validStatuses = ['SCHEDULED', 'CONFIRMED', 'ATTENDED', 'MISSED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid status. Allowed: ${validStatuses.join(', ')}`,
          },
          { status: 422 }
        );
      }
    }

    // ========================================================================
    // 7. VALIDATE APPOINTMENT DATE/TIME IF PROVIDED
    // ========================================================================
    let validatedAppointmentDateTime: Date | undefined;
    if (appointmentDateTime !== undefined) {
      if (typeof appointmentDateTime !== 'string') {
        return NextResponse.json(
          {
            success: false,
            error: 'appointmentDateTime must be ISO 8601 format',
          },
          { status: 422 }
        );
      }

      validatedAppointmentDateTime = new Date(appointmentDateTime);
      if (isNaN(validatedAppointmentDateTime.getTime())) {
        return NextResponse.json(
          {
            success: false,
            error: 'appointmentDateTime must be valid ISO 8601 date',
          },
          { status: 422 }
        );
      }
    }

    // ========================================================================
    // 8. FETCH EXISTING APPOINTMENT
    // ========================================================================
    const scopeFilter = getTenantScopingFilter(user as ScopedUserPayload);
    const existingAppointment = await db.appointment.findFirst({
      where: {
        id: appointmentId,
        ...scopeFilter,
      },
      select: {
        id: true,
        status: true,
        appointmentDateTime: true,
        notes: true,
      },
    });

    if (!existingAppointment) {
      return NextResponse.json(
        {
          success: false,
          error: 'Appointment not found',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 9. BUILD UPDATE DATA
    // ========================================================================
    const updateData: any = {};

    if (status !== undefined) {
      updateData.status = status;
    }

    if (validatedAppointmentDateTime !== undefined) {
      updateData.appointmentDateTime = validatedAppointmentDateTime;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    // ========================================================================
    // 10. UPDATE APPOINTMENT
    // ========================================================================
    const updatedAppointment = await db.appointment.update({
      where: { id: appointmentId },
      data: updateData,
      select: {
        id: true,
        motherId: true,
        pregnancyId: true,
        ancVisitId: true,
        appointmentDateTime: true,
        purpose: true,
        purposeOther: true,
        status: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        mother: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
        pregnancy: {
          select: {
            id: true,
            status: true,
          },
        },
        assignedCHW: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    // ========================================================================
    // 11. LOG AUDIT (non-blocking)
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId || null,
      actorRole: user.role,
      action: 'UPDATE',
      resource: 'appointment',
      resourceId: appointmentId,
      changesSummary: {
        oldStatus: existingAppointment.status,
        newStatus: status || existingAppointment.status,
        oldDateTime: existingAppointment.appointmentDateTime,
        newDateTime: validatedAppointmentDateTime || existingAppointment.appointmentDateTime,
        oldNotes: existingAppointment.notes,
        newNotes: notes !== undefined ? notes : existingAppointment.notes,
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
    return NextResponse.json(
      {
        success: true,
        data: updatedAppointment,
        message: 'Appointment updated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in PATCH /api/appointments/[id]:', error);
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
 * DELETE /api/appointments/[id]
 * Cancel an appointment (soft delete by setting status=CANCELLED)
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles:
 * - DOCTOR, NURSE, MIDWIFE: Cancel appointments within their hospital scope
 * - HOSPITAL_ADMIN: Hospital scope
 * - DHO, ORG_ADMIN: Organization/district scope
 * - SYSTEM_ADMIN: Unrestricted access
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "message": "Appointment cancelled successfully"
 * }
 *
 * Response on unauthorized (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized - no token provided"
 * }
 *
 * Response on not found (404):
 * {
 *   "success": false,
 *   "error": "Appointment not found"
 * }
 *
 * Response on forbidden (403):
 * {
 *   "success": false,
 *   "error": "Insufficient permissions"
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // ========================================================================
    // 2. CHECK ROLE PERMISSIONS
    // ========================================================================
    const allowedRoles = [
      'DOCTOR',
      'NURSE',
      'MIDWIFE',
      'DHO',
      'ORG_ADMIN',
      'HOSPITAL_ADMIN',
      'SYSTEM_ADMIN',
    ];

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions to cancel appointments',
        },
        { status: 403 }
      );
    }

    // ========================================================================
    // 3. VALIDATE TENANT SCOPE
    // ========================================================================
    try {
      assertValidTenantScope(user as ScopedUserPayload);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 403 }
        );
      }
      throw error;
    }

    // ========================================================================
    // 4. PARSE ID PARAMETER
    // ========================================================================
    const resolvedParams = await params;
    const appointmentId = parseInt(resolvedParams.id, 10);

    if (isNaN(appointmentId) || appointmentId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid appointment ID',
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 5. FETCH EXISTING APPOINTMENT
    // ========================================================================
    const scopeFilter = getTenantScopingFilter(user as ScopedUserPayload);
    const existingAppointment = await db.appointment.findFirst({
      where: {
        id: appointmentId,
        ...scopeFilter,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!existingAppointment) {
      return NextResponse.json(
        {
          success: false,
          error: 'Appointment not found',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 6. SOFT DELETE (Set status=CANCELLED instead of hard delete)
    // ========================================================================
    await db.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'CANCELLED',
      },
    });

    // ========================================================================
    // 7. LOG AUDIT (non-blocking)
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId || null,
      actorRole: user.role,
      action: 'DELETE',
      resource: 'appointment',
      resourceId: appointmentId,
      changesSummary: {
        status: existingAppointment.status,
        cancelledAt: new Date().toISOString(),
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((error) => {
      console.error('Failed to write audit log:', error);
      // Don't fail the request over audit logging
    });

    // ========================================================================
    // 8. RETURN SUCCESS RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        message: 'Appointment cancelled successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in DELETE /api/appointments/[id]:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
