import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  extractUser,
  UnauthorizedError,
  ForbiddenError,
} from '@/lib/rbac';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';

/**
 * DELETE /api/clinical-archives/[id]
 * Delete a clinical archive record (soft delete)
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles: DOCTOR, NURSE, MIDWIFE, DHO, ORG_ADMIN, HOSPITAL_ADMIN, SYSTEM_ADMIN
 *
 * URL parameters:
 * - id: Archive ID (number)
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "message": "Archive deleted successfully"
 * }
 *
 * Response on not found (404):
 * {
 *   "success": false,
 *   "error": "Archive not found"
 * }
 *
 * Response on unauthorized (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized - no token provided"
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

    // Verify user has permission to delete clinical archives
    const allowedRoles = ['DOCTOR', 'NURSE', 'MIDWIFE', 'DHO', 'ORG_ADMIN', 'HOSPITAL_ADMIN', 'SYSTEM_ADMIN'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions to delete clinical archives',
        },
        { status: 403 }
      );
    }

    // ========================================================================
    // 2. VALIDATE ARCHIVE ID
    // ========================================================================
    const resolvedParams = await params;
    const archiveId = parseInt(resolvedParams.id, 10);
    if (isNaN(archiveId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid archive ID',
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // 3. CHECK ARCHIVE EXISTS
    // ========================================================================
    const archive = await db.clinicalArchive.findUnique({
      where: { id: archiveId },
      select: { id: true, deletedAt: true },
    });

    if (!archive) {
      return NextResponse.json(
        {
          success: false,
          error: 'Archive not found',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 4. SOFT DELETE ARCHIVE
    // ========================================================================
    await db.clinicalArchive.update({
      where: { id: archiveId },
      data: {
        deletedAt: new Date(),
      },
    });

    // ========================================================================
    // 5. LOG AUDIT
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId || null,
      actorRole: user.role,
      action: 'DELETE',
      resource: 'clinical_archive',
      resourceId: archiveId,
      changesSummary: { deletedAt: new Date().toISOString() },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((error) => {
      console.error('Failed to write audit log:', error);
    });

    // ========================================================================
    // 6. RETURN SUCCESS RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        message: 'Archive deleted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in DELETE /api/clinical-archives/[id]:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
