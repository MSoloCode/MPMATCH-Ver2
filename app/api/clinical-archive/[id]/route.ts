import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  extractUser,
  UnauthorizedError,
  ForbiddenError,
} from '@/lib/rbac';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';

/**
 * DELETE /api/clinical-archive/:id
 * Soft-delete a clinical archive entry (sets deletedAt timestamp)
 * PROTECTED - Admin only - Requires valid JWT token in Authorization header
 *
 * Allowed roles: SYSTEM_ADMIN only
 *
 * Path parameters:
 * - id: The clinical archive ID
 *
 * Request headers:
 * {
 *   "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs..."
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "message": "Archive deleted successfully",
 *   "data": {
 *     "id": 5,
 *     "pregnancyId": 42,
 *     "motherId": 10,
 *     "type": "TEST_RESULT",
 *     "title": "Blood Test Results",
 *     "datePerformed": "2026-04-15T10:30:00Z",
 *     "notes": "Normal results",
 *     "fileUrl": "/uploads/clinical-archives/1713177000000-test.pdf",
 *     "uploadedById": 1,
 *     "createdAt": "2026-04-20T14:30:00Z",
 *     "deletedAt": "2026-04-20T15:00:00Z"
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
 *   "error": "Only SYSTEM_ADMIN can delete archives"
 * }
 *
 * Response on not found (404):
 * {
 *   "success": false,
 *   "error": "Clinical archive not found or already deleted"
 * }
 *
 * Response on server error (500):
 * {
 *   "success": false,
 *   "error": "Internal server error"
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
    // 2. CHECK ROLE PERMISSIONS - ADMIN ONLY
    // ========================================================================
    if (user.role !== 'SYSTEM_ADMIN') {
      return NextResponse.json(
        {
          success: false,
          error: 'Only SYSTEM_ADMIN can delete archives',
        },
        { status: 403 }
      );
    }

    // ========================================================================
    // 3. VALIDATE ARCHIVE ID
    // ========================================================================
    const resolvedParams = await params;
    const archiveId = parseInt(resolvedParams.id, 10);
    if (isNaN(archiveId) || archiveId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Archive ID must be a positive integer',
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 4. RETRIEVE ARCHIVE RECORD
    // ========================================================================
    const archive = await db.clinicalArchive.findUnique({
      where: { id: archiveId },
    });

    if (!archive || archive.deletedAt) {
      return NextResponse.json(
        {
          success: false,
          error: 'Clinical archive not found or already deleted',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 5. PERFORM SOFT DELETE
    // ========================================================================
    const updatedArchive = await db.clinicalArchive.update({
      where: { id: archiveId },
      data: { deletedAt: new Date() },
    });

    // ========================================================================
    // 6. AUDIT LOG (Non-blocking)
    // ========================================================================
    writeAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'DELETE',
      resource: 'clinical_archive',
      resourceId: archiveId,
      changesSummary: {
        pregnancyId: archive.pregnancyId,
        title: archive.title,
        type: archive.type,
        deletedAt: new Date().toISOString(),
      },
      ...extractAuditContext(request),
    }).catch((err) => console.error('Audit log failed:', err));

    // ========================================================================
    // 7. RETURN SUCCESS RESPONSE
    // ========================================================================
    return NextResponse.json({
      success: true,
      message: 'Archive deleted successfully',
      data: updatedArchive,
    });
  } catch (error) {
    console.error('Error deleting clinical archive:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
