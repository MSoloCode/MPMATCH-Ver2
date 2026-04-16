import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  extractUser,
  getTenantScopingFilter,
  assertValidTenantScope,
  UnauthorizedError,
  ForbiddenError,
} from '@/lib/rbac';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';

/**
 * PUT /api/mothers/[id]
 * Update a mother's information
 * PROTECTED - Requires valid JWT token (HOSPITAL_ADMIN or SYSTEM_ADMIN)
 *
 * Allowed roles:
 * - HOSPITAL_ADMIN: Can update mothers in their hospital
 * - SYSTEM_ADMIN: Can update any mother
 *
 * Request body:
 * {
 *   "fullName": "Jane Doe",
 *   "phone": "0701234567" or "+256701234567",
 *   "districtId": 1,
 *   "village": "Bukoto" (optional)
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "message": "Mother updated successfully",
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
 *   "error": "Only HOSPITAL_ADMIN and SYSTEM_ADMIN can update mothers"
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
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // ========================================================================
    // 1. AUTHENTICATION & AUTHORIZATION
    // ========================================================================
    const user = extractUser(request);
    if (!user) {
      throw new UnauthorizedError('No token provided');
    }

    // Only HOSPITAL_ADMIN and SYSTEM_ADMIN can update mothers
    if (user.role !== 'HOSPITAL_ADMIN' && user.role !== 'SYSTEM_ADMIN') {
      throw new ForbiddenError('Only HOSPITAL_ADMIN and SYSTEM_ADMIN can update mothers');
    }

    assertValidTenantScope(user);

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

    const { fullName, phone, districtId, village } = body;
    const motherId = parseInt(params.id, 10);

    if (isNaN(motherId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid mother ID' },
        { status: 422 }
      );
    }

    // Validate fullName
    if (fullName !== undefined) {
      if (typeof fullName !== 'string' || fullName.trim().length < 2) {
        return NextResponse.json(
          { success: false, error: 'Full name must be at least 2 characters' },
          { status: 422 }
        );
      }
    }

    // Validate phone
    if (phone !== undefined) {
      const phoneRegex = /^(07\d{6}|\+256[0-9]{9})$/;
      if (!phoneRegex.test(phone.trim())) {
        return NextResponse.json(
          { success: false, error: 'Invalid phone format' },
          { status: 422 }
        );
      }
    }

    // ========================================================================
    // 3. FETCH EXISTING MOTHER
    // ========================================================================
    const existingMother = await db.mother.findUnique({
      where: { id: motherId },
      include: {
        district: true,
        facility: true,
        registeredBy: true,
        chw: true,
        _count: {
          select: { pregnancies: true, alerts: true },
        },
      },
    });

    if (!existingMother) {
      return NextResponse.json(
        { success: false, error: 'Mother not found' },
        { status: 404 }
      );
    }

    // Check tenant scoping
    const scopingFilter = getTenantScopingFilter(user);
    if (user.role === 'HOSPITAL_ADMIN') {
      // Hospital admin can only update mothers in their hospital
      if (existingMother.facility?.hospitalId !== user.hospitalId) {
        throw new ForbiddenError('Cannot update mother outside your hospital scope');
      }
    }

    // ========================================================================
    // 4. UPDATE MOTHER
    // ========================================================================
    const updatedMother = await db.mother.update({
      where: { id: motherId },
      data: {
        ...(fullName && { fullName: fullName.trim() }),
        ...(phone && { phone: phone.trim() }),
        ...(districtId && { districtId: Number(districtId) }),
        ...(village !== undefined && { village: village ? village.trim() : null }),
        updatedAt: new Date(),
      },
      include: {
        district: true,
        facility: true,
        registeredBy: true,
        chw: true,
        _count: {
          select: { pregnancies: true, alerts: true },
        },
      },
    });

    // ========================================================================
    // 5. WRITE AUDIT LOG
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'UPDATE',
      resource: 'Mother',
      resourceId: motherId.toString(),
      changesSummary: {
        fullName: fullName ? 'updated' : 'unchanged',
        phone: phone ? 'updated' : 'unchanged',
        districtId: districtId ? 'updated' : 'unchanged',
        village: village ? 'updated' : 'unchanged',
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((err) => {
      console.error('Failed to write audit log:', err);
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Mother updated successfully',
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

    console.error('PUT /api/mothers/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/mothers/[id]
 * Soft-delete a mother (sets deletedAt timestamp)
 * PROTECTED - Requires valid JWT token (HOSPITAL_ADMIN or SYSTEM_ADMIN)
 *
 * Allowed roles:
 * - HOSPITAL_ADMIN: Can delete mothers in their hospital
 * - SYSTEM_ADMIN: Can delete any mother
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "message": "Mother deleted successfully"
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
 *   "error": "Only HOSPITAL_ADMIN and SYSTEM_ADMIN can delete mothers"
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

    // Only HOSPITAL_ADMIN and SYSTEM_ADMIN can delete mothers
    if (user.role !== 'HOSPITAL_ADMIN' && user.role !== 'SYSTEM_ADMIN') {
      throw new ForbiddenError('Only HOSPITAL_ADMIN and SYSTEM_ADMIN can delete mothers');
    }

    assertValidTenantScope(user);

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

    // Check tenant scoping
    if (user.role === 'HOSPITAL_ADMIN') {
      // Hospital admin can only delete mothers in their hospital
      if (existingMother.facility?.hospitalId !== user.hospitalId) {
        throw new ForbiddenError('Cannot delete mother outside your hospital scope');
      }
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
      resourceId: motherId.toString(),
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
        message: 'Mother deleted successfully',
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
