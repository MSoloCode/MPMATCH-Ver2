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
 * GET /api/ancvisits/:id
 * Retrieve a specific ANC (Antenatal Care) visit with full details
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles:
 * - DOCTOR, NURSE, MIDWIFE: View visits in own hospital scope
 * - CHW: View visits in own district scope
 * - DHO, ORG_ADMIN: District/organization scope (read-only)
 * - HOSPITAL_ADMIN: Hospital scope
 * - SYSTEM_ADMIN: Unrestricted access
 *
 * URL parameters:
 * - id: Positive integer representing the ANC visit ID
 *
 * Request headers:
 * {
 *   "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs..."
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 15,
 *     "pregnancyId": 1,
 *     "motherId": 42,
 *     "visitNumber": 3,
 *     "visitType": "ROUTINE",
 *     "purposeOther": null,
 *     "visitDateTime": "2026-04-10T14:30:00Z",
 *     "nextAppointment": "2026-05-10T14:30:00Z",
 *     "notes": "BP elevated, advised rest",
 *     "createdAt": "2026-04-10T14:45:00Z",
 *     "updatedAt": "2026-04-10T14:45:00Z",
 *     "pregnancy": {
 *       "id": 1,
 *       "status": "ACTIVE",
 *       "isHighRisk": false
 *     },
 *     "mother": {
 *       "id": 42,
 *       "fullName": "Jane Doe",
 *       "phone": "+256701234567"
 *     },
 *     "createdBy": {
 *       "id": 10,
 *       "name": "Dr. Smith",
 *       "role": "DOCTOR"
 *     },
 *     "vitals": [
 *       {
 *         "id": 101,
 *         "ancVisitId": 15,
 *         "systolicBP": 140,
 *         "diastolicBP": 90,
 *         "temperatureC": 37.2,
 *         "weightKg": 72.5,
 *         "pulseBpm": 82,
 *         "respRate": 18,
 *         "oxygenSatPct": 98
 *       }
 *     ],
 *     "symptoms": [
 *       {
 *         "id": 201,
 *         "ancVisitId": 15,
 *         "bleeding": false,
 *         "severeHeadache": true,
 *         "blurredVision": false,
 *         "swelling": false,
 *         "fever": false,
 *         "abdominalPain": false,
 *         "reducedFetalMovement": false,
 *         "other": "Mild headache, advised paracetamol"
 *       }
 *     ]
 *   }
 * }
 *
 * Response on unauthorized (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized - no token provided"
 * }
 *
 * Response on forbidden (403):
 * {
 *   "success": false,
 *   "error": "Insufficient permissions or invalid tenant scope"
 * }
 *
 * Response on not found (404):
 * {
 *   "success": false,
 *   "error": "ANC visit not found"
 * }
 */
export async function GET(
  request: NextRequest,
  { params: resolvedParams }: { params: { id: string } }
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
      'CHW',
      'DHO',
      'ORG_ADMIN',
      'HOSPITAL_ADMIN',
      'SYSTEM_ADMIN',
    ];

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions to access ANC visits',
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
    // 4. PARSE AND VALIDATE ID PARAMETER
    // ========================================================================
    const visitId = parseInt(resolvedParams.id, 10);
    if (isNaN(visitId) || visitId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid ID format - must be a positive integer',
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 5. BUILD TENANT SCOPE FILTER
    // ========================================================================
    const scopeFilter = getTenantScopingFilter(user as ScopedUserPayload);

    // ========================================================================
    // 6. FETCH ANC VISIT WITH RELATIONS
    // ========================================================================
    const ancVisit = await db.ancVisit.findFirst({
      where: {
        id: visitId,
        ...scopeFilter,
        deletedAt: null, // Exclude soft-deleted records
      },
      select: {
        id: true,
        visitNumber: true,
        pregnancyId: true,
        motherId: true,
        visitType: true,
        purposeOther: true,
        visitDateTime: true,
        nextAppointment: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        pregnancy: {
          select: {
            id: true,
            status: true,
            isHighRisk: true,
          },
        },
        mother: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        vitals: {
          where: { deletedAt: null },
          select: {
            id: true,
            ancVisitId: true,
            systolicBP: true,
            diastolicBP: true,
            bpNotTaken: true,
            temperatureC: true,
            weightKg: true,
            pulseBpm: true,
            respRate: true,
            oxygenSatPct: true,
            createdAt: true,
          },
        },
        symptoms: {
          where: { deletedAt: null },
          select: {
            id: true,
            ancVisitId: true,
            bleeding: true,
            severeHeadache: true,
            blurredVision: true,
            swelling: true,
            fever: true,
            abdominalPain: true,
            reducedFetalMovement: true,
            other: true,
            createdAt: true,
          },
        },
      },
    });

    // ========================================================================
    // 7. CHECK IF VISIT EXISTS
    // ========================================================================
    if (!ancVisit) {
      return NextResponse.json(
        {
          success: false,
          error: 'ANC visit not found',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 8. LOG AUDIT (non-blocking)
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId || null,
      actorRole: user.role,
      action: 'READ',
      resource: 'ancvisit',
      resourceId: visitId,
      changesSummary: {
        visitNumber: ancVisit.visitNumber,
        visitType: ancVisit.visitType,
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((error) => {
      console.error('Failed to write audit log:', error);
    });

    // ========================================================================
    // 9. RETURN SUCCESS RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: ancVisit,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/ancvisits/:id:', error);
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
 * PATCH /api/ancvisits/:id
 * Update an existing ANC (Antenatal Care) visit
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles:
 * - DOCTOR, NURSE, MIDWIFE: Update visits in own hospital scope
 * - HOSPITAL_ADMIN, SYSTEM_ADMIN: Update visits in their scope
 *
 * URL parameters:
 * - id: Positive integer representing the ANC visit ID
 *
 * Request body (all fields optional, but at least one must be provided):
 * {
 *   "notes": "Updated clinical notes",
 *   "nextAppointment": "2026-05-17T14:30:00Z",
 *   "visitType": "ROUTINE|SCANNING|REVIEW|OTHER",
 *   "purposeOther": "Custom reason (required if visitType changed to OTHER)"
 * }
 *
 * Immutable fields (cannot be updated):
 * - pregnancyId, motherId, visitNumber, purposeOther (directly)
 *
 * purposeOther Auto-Management:
 * - If visitType changes to OTHER: purposeOther REQUIRED in request
 * - If visitType changes away from OTHER: purposeOther AUTO-SET to null
 * - If visitType unchanged: purposeOther remains unchanged
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 15,
 *     "visitNumber": 3,
 *     "pregnancyId": 1,
 *     "motherId": 42,
 *     "visitType": "ROUTINE",
 *     "purposeOther": null,
 *     "visitDateTime": "2026-04-10T14:30:00Z",
 *     "nextAppointment": "2026-05-17T14:30:00Z",
 *     "notes": "Updated clinical notes",
 *     "updatedAt": "2026-04-17T15:30:00Z"
 *   },
 *   "message": "ANC visit updated"
 * }
 *
 * Response on immutable field update attempt (422):
 * {
 *   "success": false,
 *   "error": "Cannot update immutable fields: pregnancyId, motherId"
 * }
 *
 * Response on invalid visitType with OTHER (422):
 * {
 *   "success": false,
 *   "error": "purposeOther is required when visitType is OTHER"
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params: resolvedParams }: { params: { id: string } }
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
    // 2. CHECK ROLE PERMISSIONS (More restrictive than GET)
    // ========================================================================
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
          error: 'Insufficient permissions to update ANC visits',
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
    // 4. PARSE AND VALIDATE ID PARAMETER
    // ========================================================================
    const visitId = parseInt(resolvedParams.id, 10);
    if (isNaN(visitId) || visitId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid ID format - must be a positive integer',
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 5. PARSE REQUEST BODY
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

    // ========================================================================
    // 6. CHECK FOR IMMUTABLE FIELDS IN REQUEST
    // ========================================================================
    const immutableFields = ['pregnancyId', 'motherId', 'visitNumber', 'purposeOther'];
    const attemptedImmutable = immutableFields.filter((field) => field in body);

    if (attemptedImmutable.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot update immutable fields: ${attemptedImmutable.join(', ')}`,
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 7. FETCH CURRENT VISIT TO ENABLE purposeOther AUTO-MANAGEMENT
    // ========================================================================
    const scopeFilter = getTenantScopingFilter(user as ScopedUserPayload);

    const currentVisit = await db.ancVisit.findFirst({
      where: {
        id: visitId,
        ...scopeFilter,
        deletedAt: null,
      },
      select: {
        id: true,
        visitType: true,
        purposeOther: true,
        notes: true,
        nextAppointment: true,
      },
    });

    if (!currentVisit) {
      return NextResponse.json(
        {
          success: false,
          error: 'ANC visit not found',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 8. VALIDATE AND PREPARE UPDATE DATA
    // ========================================================================
    const updateData: any = {};
    const changesSummary: any = {};

    // Validate and add notes
    if ('notes' in body) {
      updateData.notes = body.notes !== undefined ? String(body.notes) : null;
      if (updateData.notes !== currentVisit.notes) {
        changesSummary.notes = {
          before: currentVisit.notes,
          after: updateData.notes,
        };
      }
    }

    // Validate and add nextAppointment
    if ('nextAppointment' in body) {
      let nextApptDate: Date | null = null;
      if (body.nextAppointment !== null && body.nextAppointment !== undefined) {
        nextApptDate = new Date(body.nextAppointment);
        if (isNaN(nextApptDate.getTime())) {
          return NextResponse.json(
            {
              success: false,
              error: 'nextAppointment must be a valid ISO 8601 date',
            },
            { status: 422 }
          );
        }
      }
      updateData.nextAppointment = nextApptDate;
      if (updateData.nextAppointment !== currentVisit.nextAppointment) {
        changesSummary.nextAppointment = {
          before: currentVisit.nextAppointment,
          after: updateData.nextAppointment,
        };
      }
    }

    // Validate and add visitType (with smart purposeOther management)
    if ('visitType' in body) {
      const validVisitTypes = ['ROUTINE', 'SCANNING', 'REVIEW', 'OTHER'];
      if (!validVisitTypes.includes(body.visitType)) {
        return NextResponse.json(
          {
            success: false,
            error: `visitType must be one of: ${validVisitTypes.join(', ')}`,
          },
          { status: 422 }
        );
      }

      updateData.visitType = body.visitType;

      if (updateData.visitType !== currentVisit.visitType) {
        changesSummary.visitType = {
          before: currentVisit.visitType,
          after: updateData.visitType,
        };

        // ====================================================================
        // SMART purposeOther AUTO-MANAGEMENT
        // ====================================================================
        if (body.visitType === 'OTHER') {
          // Changing TO OTHER: require purposeOther in request
          if (!('purposeOther' in body) || !body.purposeOther) {
            return NextResponse.json(
              {
                success: false,
                error: 'purposeOther is required when visitType is OTHER',
              },
              { status: 422 }
            );
          }
          updateData.purposeOther = String(body.purposeOther);
          changesSummary.purposeOther = {
            before: currentVisit.purposeOther,
            after: updateData.purposeOther,
          };
        } else if (currentVisit.visitType === 'OTHER') {
          // Changing AWAY FROM OTHER: auto-set to null
          updateData.purposeOther = null;
          if (currentVisit.purposeOther !== null) {
            changesSummary.purposeOther = {
              before: currentVisit.purposeOther,
              after: null,
            };
          }
        }
      }
    }

    // ========================================================================
    // 9. CHECK IF ANY FIELDS ARE BEING UPDATED
    // ========================================================================
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No updateable fields provided in request body',
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 10. UPDATE ANC VISIT
    // ========================================================================
    const updatedVisit = await db.ancVisit.update({
      where: { id: visitId },
      data: updateData,
      select: {
        id: true,
        visitNumber: true,
        pregnancyId: true,
        motherId: true,
        visitType: true,
        purposeOther: true,
        visitDateTime: true,
        nextAppointment: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
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
      resource: 'ancvisit',
      resourceId: visitId,
      changesSummary,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((error) => {
      console.error('Failed to write audit log:', error);
    });

    // ========================================================================
    // 12. RETURN SUCCESS RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: updatedVisit,
        message: 'ANC visit updated',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in PATCH /api/ancvisits/:id:', error);
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
 * DELETE /api/ancvisits/:id
 * Delete (soft delete) an ANC (Antenatal Care) visit
 * PROTECTED - Requires valid JWT token in Authorization header
 * RESTRICTED - Only SYSTEM_ADMIN role can delete visits
 *
 * URL parameters:
 * - id: Positive integer representing the ANC visit ID
 *
 * Request headers:
 * {
 *   "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs..."
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "message": "ANC visit deleted"
 * }
 *
 * Response on unauthorized (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized - no token provided"
 * }
 *
 * Response on insufficient permissions (403):
 * {
 *   "success": false,
 *   "error": "Only SYSTEM_ADMIN can delete ANC visits"
 * }
 *
 * Response on not found (404):
 * {
 *   "success": false,
 *   "error": "ANC visit not found"
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params: resolvedParams }: { params: { id: string } }
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
    // 2. CHECK ROLE PERMISSIONS (SYSTEM_ADMIN ONLY - Most Restrictive)
    // ========================================================================
    if (user.role !== 'SYSTEM_ADMIN') {
      return NextResponse.json(
        {
          success: false,
          error: 'Only SYSTEM_ADMIN can delete ANC visits',
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
    // 4. PARSE AND VALIDATE ID PARAMETER
    // ========================================================================
    const visitId = parseInt(resolvedParams.id, 10);
    if (isNaN(visitId) || visitId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid ID format - must be a positive integer',
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 5. BUILD TENANT SCOPE FILTER
    // ========================================================================
    const scopeFilter = getTenantScopingFilter(user as ScopedUserPayload);

    // ========================================================================
    // 6. VERIFY ANC VISIT EXISTS
    // ========================================================================
    const existingVisit = await db.ancVisit.findFirst({
      where: {
        id: visitId,
        ...scopeFilter,
        deletedAt: null, // Only soft-delete non-deleted records
      },
      select: {
        id: true,
        visitNumber: true,
        pregnancyId: true,
      },
    });

    if (!existingVisit) {
      return NextResponse.json(
        {
          success: false,
          error: 'ANC visit not found',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 7. SOFT DELETE: SET deletedAt TIMESTAMP
    // ========================================================================
    await db.ancVisit.update({
      where: { id: visitId },
      data: { deletedAt: new Date() },
    });

    // ========================================================================
    // 8. LOG AUDIT (non-blocking)
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId || null,
      actorRole: user.role,
      action: 'DELETE',
      resource: 'ancvisit',
      resourceId: visitId,
      changesSummary: {
        action: 'soft_delete',
        visitNumber: existingVisit.visitNumber,
        pregnancyId: existingVisit.pregnancyId,
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((error) => {
      console.error('Failed to write audit log:', error);
    });

    // ========================================================================
    // 9. RETURN SUCCESS RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        message: 'ANC visit deleted',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in DELETE /api/ancvisits/:id:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
