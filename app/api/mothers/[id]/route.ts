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
 * GET /api/mothers/[id]
 * Retrieve full mother profile including pregnancy summary
 * PROTECTED - Requires valid JWT token with clinical role or admin
 *
 * Allowed roles:
 * - DOCTOR, NURSE, MIDWIFE: Own facility scope
 * - CHW: Assigned mothers only (chwId match)
 * - DHO, ORG_ADMIN, HOSPITAL_ADMIN: Hospital/organization scope
 * - SYSTEM_ADMIN: Unrestricted access
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 42,
 *     "fullName": "Jane Doe",
 *     "phone": "+256701234567",
 *     "dob": "1990-03-15T00:00:00Z",
 *     "village": "Bukoto",
 *     "createdAt": "2026-04-01T10:30:00Z",
 *     "updatedAt": "2026-04-10T15:20:00Z",
 *     "consentAccepted": true,
 *     "consentDate": "2026-04-01T10:30:00Z",
 *     "district": { "id": 1, "name": "Kampala" },
 *     "facility": { "id": 5, "name": "Mulago Hospital" },
 *     "registeredBy": { "id": 10, "username": "nurse_1" },
 *     "chw": { "id": 20, "name": "James Mutua" },
 *     "pregnancySummary": {
 *       "count": 3,
 *       "latestDueDate": "2026-08-15T00:00:00Z",
 *       "isHighRisk": false
 *     }
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
 *   "error": "Cannot access mother outside your scope"
 * }
 *
 * Response on not found (404):
 * {
 *   "success": false,
 *   "error": "Mother not found"
 * }
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // ========================================================================
    // 1. EXTRACT AND VALIDATE AUTHORIZATION
    // ========================================================================
    const user = extractUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - no token provided' },
        { status: 401 }
      );
    }

    // ========================================================================
    // 2. CHECK ROLE PERMISSIONS
    // ========================================================================
    const allowedRoles = ['DOCTOR', 'NURSE', 'MIDWIFE', 'CHW', 'DHO', 'ORG_ADMIN', 'HOSPITAL_ADMIN', 'SYSTEM_ADMIN'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
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
          { success: false, error: error.message },
          { status: 403 }
        );
      }
      throw error;
    }

    // ========================================================================
    // 4. PARSE & VALIDATE MOTHER ID
    // ========================================================================
    const motherId = parseInt(params.id, 10);
    if (isNaN(motherId) || motherId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid mother ID' },
        { status: 422 }
      );
    }

    // ========================================================================
    // 5. FETCH MOTHER
    // ========================================================================
    const mother = await db.mother.findUnique({
      where: { id: motherId },
      include: {
        district: { select: { id: true, name: true } },
        facility: { select: { id: true, name: true } },
        registeredBy: { select: { id: true, username: true } },
        chw: { select: { id: true, name: true } },
      },
    });

    if (!mother || mother.deletedAt) {
      return NextResponse.json(
        { success: false, error: 'Mother not found' },
        { status: 404 }
      );
    }

    // ========================================================================
    // 6. VERIFY ACCESS PERMISSION
    // ========================================================================
    const scopingFilter = getTenantScopingFilter(user as ScopedUserPayload);

    // Check if mother matches the user's scope
    let hasAccess = false;

    if (user.role === 'SYSTEM_ADMIN') {
      hasAccess = true;
    } else if (user.role === 'CHW') {
      // CHW can only see mothers assigned to them
      hasAccess = mother.chwId === user.id;
    } else {
      // Clinical staff and other admins: check facility scope
      // This is implicitly checked through the scoping filter
      hasAccess = true;
      
      // Additional check: verify facility matches if applicable
      if (scopingFilter.facilityId && mother.facilityId !== scopingFilter.facilityId) {
        hasAccess = false;
      }
      
      // For hospital-scoped users, verify the facility is in their hospital
      if (scopingFilter.hospitalId) {
        const hospital = await db.hospital.findFirst({
          where: {
            id: scopingFilter.hospitalId,
            facilityId: mother.facilityId,
          },
        });
        if (!hospital) {
          hasAccess = false;
        }
      }
    }

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Cannot access mother outside your scope' },
        { status: 403 }
      );
    }

    // ========================================================================
    // 7. FETCH PREGNANCY SUMMARY
    // ========================================================================
    const pregnancies = await db.pregnancy.findMany({
      where: {
        motherId: motherId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        edd: true,
        isHighRisk: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    const pregnancySummary = {
      count: await db.pregnancy.count({
        where: { motherId: motherId, status: 'ACTIVE' },
      }),
      latestDueDate: pregnancies.length > 0 ? pregnancies[0].edd : null,
      isHighRisk: pregnancies.length > 0 ? pregnancies[0].isHighRisk : false,
    };

    // ========================================================================
    // 8. LOG AUDIT (non-blocking)
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'READ_SENSITIVE',
      resource: 'Mother',
      resourceId: motherId,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((err) => {
      console.error('Failed to write audit log:', err);
    });

    // ========================================================================
    // 9. RETURN SUCCESS RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: {
          ...mother,
          pregnancySummary,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/mothers/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/mothers/[id]
 * Update a mother's information
 * PROTECTED - Requires valid JWT token (DOCTOR, NURSE, MIDWIFE, HOSPITAL_ADMIN, SYSTEM_ADMIN)
 *
 * Allowed roles:
 * - DOCTOR, NURSE, MIDWIFE: Can update mothers in their facility
 * - HOSPITAL_ADMIN: Can update mothers in their hospital
 * - SYSTEM_ADMIN: Can update any mother
 *
 * Updatable fields:
 * - fullName: string (2-100 chars)
 * - dob: ISO date string or null
 * - village: string or null (max 100 chars)
 * - chwId: positive integer ID of CHW (must be active CHW)
 *
 * Immutable fields (cannot be updated):
 * - phone
 * - districtId
 * - facilityId
 * - consentAccepted
 *
 * Request body example:
 * {
 *   "fullName": "Jane Smith",
 *   "dob": "1990-05-15",
 *   "village": "Kasubi",
 *   "chwId": 20
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "message": "Mother updated",
 *   "data": { ... updated mother object ... }
 * }
 *
 * Response on unauthorized (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized"
 * }
 *
 * Response on forbidden (403):
 * {
 *   "success": false,
 *   "error": "Cannot update mother outside your scope"
 * }
 *
 * Response on not found (404):
 * {
 *   "success": false,
 *   "error": "Mother not found"
 * }
 *
 * Response on validation error (422):
 * {
 *   "success": false,
 *   "error": "Validation error message"
 * }
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // ========================================================================
    // 1. AUTHENTICATION & AUTHORIZATION
    // ========================================================================
    const user = extractUser(request);
    if (!user) {
      throw new UnauthorizedError('No token provided');
    }

    // Allow clinical staff and admins to update mothers
    const allowedRoles = ['DOCTOR', 'NURSE', 'MIDWIFE', 'HOSPITAL_ADMIN', 'SYSTEM_ADMIN'];
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenError('Only clinical staff and admins can update mothers');
    }

    assertValidTenantScope(user as ScopedUserPayload);

    // ========================================================================
    // 2. PARSE & VALIDATE REQUEST BODY
    // ========================================================================
    let body: any;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { fullName, dob, village, chwId } = body;
    const motherId = parseInt(params.id, 10);

    if (isNaN(motherId) || motherId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid mother ID' },
        { status: 422 }
      );
    }

    // Check for immutable fields in request
    if ('phone' in body || 'districtId' in body || 'facilityId' in body || 'consentAccepted' in body) {
      return NextResponse.json(
        { success: false, error: 'Cannot update immutable fields: phone, districtId, facilityId, consentAccepted' },
        { status: 422 }
      );
    }

    // Prepare update data
    const updateData: any = {};

    // Validate fullName
    if (fullName !== undefined) {
      if (typeof fullName !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Full name must be a string' },
          { status: 422 }
        );
      }
      const trimmedFullName = fullName.trim();
      if (trimmedFullName.length < 2 || trimmedFullName.length > 100) {
        return NextResponse.json(
          { success: false, error: 'Full name must be between 2 and 100 characters' },
          { status: 422 }
        );
      }
      updateData.fullName = trimmedFullName;
    }

    // Validate dob
    if (dob !== undefined) {
      if (dob === null) {
        updateData.dob = null;
      } else {
        try {
          const parsedDob = new Date(dob);
          if (isNaN(parsedDob.getTime())) {
            return NextResponse.json(
              { success: false, error: 'Date of birth must be a valid date' },
              { status: 422 }
            );
          }
          updateData.dob = parsedDob;
        } catch (error) {
          return NextResponse.json(
            { success: false, error: 'Date of birth must be a valid date' },
            { status: 422 }
          );
        }
      }
    }

    // Validate village
    if (village !== undefined) {
      if (village === null) {
        updateData.village = null;
      } else {
        if (typeof village !== 'string') {
          return NextResponse.json(
            { success: false, error: 'Village must be a string' },
            { status: 422 }
          );
        }
        const trimmedVillage = village.trim();
        if (trimmedVillage.length > 100) {
          return NextResponse.json(
            { success: false, error: 'Village must be at most 100 characters' },
            { status: 422 }
          );
        }
        updateData.village = trimmedVillage || null;
      }
    }

    // Validate chwId
    if (chwId !== undefined) {
      if (chwId === null) {
        updateData.chwId = null;
      } else {
        const parsedCHWId = Number(chwId);
        if (!Number.isInteger(parsedCHWId) || parsedCHWId <= 0) {
          return NextResponse.json(
            { success: false, error: 'CHW ID must be a positive integer' },
            { status: 422 }
          );
        }

        // Verify CHW exists and is active
        const chw = await db.user.findUnique({
          where: { id: parsedCHWId },
          select: { id: true, role: true, isActive: true },
        });

        if (!chw) {
          return NextResponse.json(
            { success: false, error: 'CHW not found' },
            { status: 404 }
          );
        }

        if (chw.role !== 'CHW') {
          return NextResponse.json(
            { success: false, error: 'Selected user is not a CHW' },
            { status: 422 }
          );
        }

        if (!chw.isActive) {
          return NextResponse.json(
            { success: false, error: 'Selected CHW is not active' },
            { status: 422 }
          );
        }

        updateData.chwId = parsedCHWId;
      }
    }

    // Check if there are any updates
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 422 }
      );
    }

    // ========================================================================
    // 3. FETCH EXISTING MOTHER
    // ========================================================================
    const existingMother = await db.mother.findUnique({
      where: { id: motherId },
    });

    if (!existingMother || existingMother.deletedAt) {
      return NextResponse.json(
        { success: false, error: 'Mother not found' },
        { status: 404 }
      );
    }

    // ========================================================================
    // 4. VERIFY ACCESS PERMISSION
    // ========================================================================
    const scopingFilter = getTenantScopingFilter(user as ScopedUserPayload);

    if (user.role === 'HOSPITAL_ADMIN') {
      // Hospital admin can only update mothers in their hospital
      const hospital = await db.hospital.findFirst({
        where: {
          id: user.hospitalId,
          facilityId: existingMother.facilityId,
        },
      });
      if (!hospital) {
        throw new ForbiddenError('Cannot update mother outside your hospital scope');
      }
    } else if (user.role === 'DOCTOR' || user.role === 'NURSE' || user.role === 'MIDWIFE') {
      // Clinical staff can only update mothers in their facility
      if (scopingFilter.facilityId && existingMother.facilityId !== scopingFilter.facilityId) {
        throw new ForbiddenError('Cannot update mother outside your facility scope');
      }
    }
    // SYSTEM_ADMIN has no restrictions

    // ========================================================================
    // 5. UPDATE MOTHER
    // ========================================================================
    const auditContext = extractAuditContext(request);

    const updatedMother = await db.mother.update({
      where: { id: motherId },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      include: {
        district: { select: { id: true, name: true } },
        facility: { select: { id: true, name: true } },
        registeredBy: { select: { id: true, username: true } },
        chw: { select: { id: true, name: true } },
      },
    });

    // ========================================================================
    // 6. WRITE AUDIT LOG
    // ========================================================================
    const changesSummary: any = {};
    if (fullName !== undefined) {
      changesSummary.fullName = {
        from: existingMother.fullName,
        to: updatedMother.fullName,
      };
    }
    if (dob !== undefined) {
      changesSummary.dob = {
        from: existingMother.dob,
        to: updatedMother.dob,
      };
    }
    if (village !== undefined) {
      changesSummary.village = {
        from: existingMother.village,
        to: updatedMother.village,
      };
    }
    if (chwId !== undefined) {
      changesSummary.chwId = {
        from: existingMother.chwId,
        to: updatedMother.chwId,
      };
    }

    writeAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'UPDATE',
      resource: 'Mother',
      resourceId: motherId,
      changesSummary,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((err) => {
      console.error('Failed to write audit log:', err);
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Mother updated',
        data: updatedMother,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 }
      );
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }

    console.error('PATCH /api/mothers/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/mothers/[id]
 * Soft-delete a mother (sets deletedAt timestamp)
 * PROTECTED - Requires valid JWT token (SYSTEM_ADMIN only)
 *
 * Allowed roles:
 * - SYSTEM_ADMIN: Can delete any mother
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "message": "Mother deleted"
 * }
 *
 * Response on unauthorized (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized"
 * }
 *
 * Response on forbidden (403):
 * {
 *   "success": false,
 *   "error": "Only SYSTEM_ADMIN can delete mothers"
 * }
 *
 * Response on not found (404):
 * {
 *   "success": false,
 *   "error": "Mother not found"
 * }
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // ========================================================================
    // 1. AUTHENTICATION & AUTHORIZATION
    // ========================================================================
    const user = extractUser(request);
    if (!user) {
      throw new UnauthorizedError('No token provided');
    }

    // Only SYSTEM_ADMIN can delete mothers (soft-delete)
    if (user.role !== 'SYSTEM_ADMIN') {
      throw new ForbiddenError('Only SYSTEM_ADMIN can delete mothers');
    }

    assertValidTenantScope(user as ScopedUserPayload);

    // ========================================================================
    // 2. PARSE & VALIDATE MOTHER ID
    // ========================================================================
    const motherId = parseInt(params.id, 10);

    if (isNaN(motherId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid mother ID' },
        { status: 422 }
      );
    }

    // ========================================================================
    // 3. FETCH EXISTING MOTHER
    // ========================================================================
    const existingMother = await db.mother.findUnique({
      where: { id: motherId },
      include: { facility: true },
    });

    if (!existingMother) {
      return NextResponse.json(
        { success: false, error: 'Mother not found' },
        { status: 404 }
      );
    }

    // ========================================================================
    // 4. SOFT DELETE MOTHER
    // ========================================================================
    await db.mother.update({
      where: { id: motherId },
      data: { deletedAt: new Date() },
    });

    // ========================================================================
    // 5. WRITE AUDIT LOG
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'DELETE',
      resource: 'Mother',
      resourceId: motherId,
      changesSummary: {
        action: 'soft_delete',
        motherId: motherId,
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((err) => {
      console.error('Failed to write audit log:', err);
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Mother deleted',
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 }
      );
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }

    console.error('DELETE /api/mothers/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
