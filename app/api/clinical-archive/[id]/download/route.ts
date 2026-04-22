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
 * GET /api/clinical-archive/:id/download
 * Download or retrieve a file URL for a clinical archive entry
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles:
 * - Clinical staff (DOCTOR, MIDWIFE, NURSE, HOSPITAL_ADMIN, SYSTEM_ADMIN) - scoped by tenant
 * - Community users (COMMUNITY_USER) - only for their own pregnancy
 *
 * This endpoint:
 * 1. Verifies the user has access to the archive (auth checks)
 * 2. Logs the download attempt as a READ_SENSITIVE audit action
 * 3. Returns a redirect to the file URL (or the URL itself if file storage changes)
 *
 * Path parameters:
 * - id: The clinical archive ID
 *
 * Request headers:
 * {
 *   "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs..."
 * }
 *
 * Response on success - redirect (302):
 * Redirects to the file URL (e.g., /uploads/clinical-archives/1713177000000-test.pdf)
 * 
 * Alternative success response if returning JSON (200):
 * {
 *   "success": true,
 *   "fileUrl": "/uploads/clinical-archives/1713177000000-test.pdf",
 *   "downloadedAt": "2026-04-20T14:35:00Z"
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
 *   "error": "Insufficient permissions to access this archive"
 * }
 *
 * Response on not found (404):
 * {
 *   "success": false,
 *   "error": "Clinical archive not found"
 * }
 *
 * Response on no file (404):
 * {
 *   "success": false,
 *   "error": "No file associated with this archive entry"
 * }
 *
 * Response on server error (500):
 * {
 *   "success": false,
 *   "error": "Internal server error"
 * }
 */
export async function GET(
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
    // 2. VALIDATE ARCHIVE ID
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
    // 3. DETERMINE ACCESS LEVEL
    // ========================================================================
    const isClinicalStaff = [
      'DOCTOR',
      'MIDWIFE',
      'NURSE',
      'HOSPITAL_ADMIN',
      'SYSTEM_ADMIN',
    ].includes(user.role);

    if (!isClinicalStaff && user.role !== 'COMMUNITY_USER') {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions to access clinical archives',
        },
        { status: 403 }
      );
    }

    // ========================================================================
    // 4. VALIDATE TENANT SCOPE FOR CLINICAL STAFF
    // ========================================================================
    let scopeFilter: Record<string, any> = {};
    if (isClinicalStaff) {
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

      scopeFilter = getTenantScopingFilter(user as ScopedUserPayload);
    }

    // ========================================================================
    // 5. RETRIEVE ARCHIVE RECORD
    // ========================================================================
    const archive = await db.clinicalArchive.findUnique({
      where: { id: archiveId },
      include: {
        pregnancy: {
          select: { id: true, motherId: true },
        },
      },
    });

    if (!archive || archive.deletedAt) {
      return NextResponse.json(
        {
          success: false,
          error: 'Clinical archive not found',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 6. VERIFY ACCESS FOR COMMUNITY USER
    // ========================================================================
    if (user.role === 'COMMUNITY_USER') {
      if (!user.motherId || archive.pregnancy.motherId !== user.motherId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Insufficient permissions to access this archive',
          },
          { status: 403 }
        );
      }
    } else if (isClinicalStaff) {
      // Verify clinical staff has tenant access to the pregnancy
      // Check if pregnancy belongs to user's scope
      const pregnancyInScope = await db.pregnancy.findFirst({
        where: {
          id: archive.pregnancyId,
          ...scopeFilter,
        },
        select: { id: true },
      });

      if (!pregnancyInScope) {
        return NextResponse.json(
          {
            success: false,
            error: 'Insufficient permissions to access this archive',
          },
          { status: 403 }
        );
      }
    }

    // ========================================================================
    // 7. VERIFY FILE EXISTS
    // ========================================================================
    if (!archive.fileUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'No file associated with this archive entry',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 8. AUDIT LOG - READ_SENSITIVE ACTION (Non-blocking)
    // ========================================================================
    writeAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'READ_SENSITIVE',
      resource: 'clinical_archive',
      resourceId: archiveId,
      changesSummary: {
        pregnancyId: archive.pregnancyId,
        title: archive.title,
        type: archive.type,
        downloadedAt: new Date().toISOString(),
      },
      ...extractAuditContext(request),
    }).catch((err) => console.error('Audit log failed:', err));

    // ========================================================================
    // 9. RETURN RESPONSE
    // ========================================================================
    // Option 1: Redirect to file (preferred for actual file serving)
    return NextResponse.redirect(new URL(archive.fileUrl, request.url), {
      status: 302,
    });

    // Option 2: Return file URL as JSON (if client wants to handle redirect)
    // return NextResponse.json({
    //   success: true,
    //   fileUrl: archive.fileUrl,
    //   downloadedAt: new Date().toISOString(),
    // });
  } catch (error) {
    console.error('Error downloading clinical archive:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
