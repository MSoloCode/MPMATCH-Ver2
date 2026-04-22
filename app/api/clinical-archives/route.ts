import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  extractUser,
  UnauthorizedError,
} from '@/lib/rbac';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';

/**
 * POST /api/clinical-archives
 * Create a clinical archive entry with an already-uploaded file
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles: DOCTOR, NURSE, MIDWIFE, DHO, ORG_ADMIN, HOSPITAL_ADMIN, SYSTEM_ADMIN
 *
 * Request (FormData):
 * - pregnancyId: number (required)
 * - motherId: number (required)
 * - fileUrl: string (required) - URL returned from /api/uploads
 * - title: string (required, e.g., "ANC Card")
 * - type: string (optional, default: "OTHER") - TEST_RESULT|IMAGING|MEDICATION|PROCEDURE|OTHER
 * - datePerformed: string (optional, ISO date)
 * - notes: string (optional)
 *
 * Response on success (201):
 * {
 *   "success": true,
 *   "message": "Archive entry created successfully",
 *   "data": {
 *     "id": 1,
 *     "pregnancyId": 42,
 *     "motherId": 10,
 *     "type": "TEST_RESULT",
 *     "title": "Blood Test Results",
 *     "fileUrl": "/uploads/clinical-archives/1713253800000-blood-test.pdf",
 *     "createdAt": "2026-04-20T10:30:00Z"
 *   }
 * }
 *
 * Response on validation error (422):
 * {
 *   "success": false,
 *   "error": "fileUrl is required"
 * }
 */
export async function POST(request: NextRequest) {
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

    // Verify user has permission to upload clinical archives
    const allowedRoles = ['DOCTOR', 'NURSE', 'MIDWIFE', 'DHO', 'ORG_ADMIN', 'HOSPITAL_ADMIN', 'SYSTEM_ADMIN'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions to upload clinical archives',
        },
        { status: 403 }
      );
    }

    // ========================================================================
    // 2. PARSE FORM DATA
    // ========================================================================
    let formData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid FormData',
        },
        { status: 400 }
      );
    }

    const pregnancyIdStr = formData.get('pregnancyId');
    const motherIdStr = formData.get('motherId');
    const fileUrl = formData.get('fileUrl') as string | null;
    const title = formData.get('title') as string | null;
    const type = (formData.get('type') as string) || 'OTHER';
    const datePerformed = formData.get('datePerformed') as string | null;
    const notes = formData.get('notes') as string | null;

    // ========================================================================
    // 3. VALIDATE REQUIRED FIELDS
    // ========================================================================
    if (!pregnancyIdStr || isNaN(parseInt(pregnancyIdStr as string, 10))) {
      return NextResponse.json(
        {
          success: false,
          error: 'pregnancyId is required and must be a number',
        },
        { status: 422 }
      );
    }

    if (!motherIdStr || isNaN(parseInt(motherIdStr as string, 10))) {
      return NextResponse.json(
        {
          success: false,
          error: 'motherId is required and must be a number',
        },
        { status: 422 }
      );
    }

    if (!title || title.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'title is required',
        },
        { status: 422 }
      );
    }

    if (!fileUrl || fileUrl.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'fileUrl is required',
        },
        { status: 422 }
      );
    }

    const pregnancyId = parseInt(pregnancyIdStr as string, 10);
    const motherId = parseInt(motherIdStr as string, 10);

    // ========================================================================
    // 4. VALIDATE TYPE
    // ========================================================================
    const validTypes = ['TEST_RESULT', 'IMAGING', 'MEDICATION', 'PROCEDURE', 'OTHER'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: `type must be one of: ${validTypes.join(', ')}`,
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 5. VERIFY PREGNANCY AND MOTHER EXIST
    // ========================================================================
    const [pregnancy, mother] = await Promise.all([
      db.pregnancy.findUnique({ where: { id: pregnancyId } }),
      db.mother.findUnique({ where: { id: motherId } }),
    ]);

    if (!pregnancy) {
      return NextResponse.json(
        {
          success: false,
          error: `Pregnancy with id ${pregnancyId} not found`,
        },
        { status: 404 }
      );
    }

    if (!mother) {
      return NextResponse.json(
        {
          success: false,
          error: `Mother with id ${motherId} not found`,
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 6. CREATE CLINICAL ARCHIVE RECORD
    // ========================================================================
    let datePerformedObj: Date | null = null;
    if (datePerformed) {
      try {
        datePerformedObj = new Date(datePerformed);
        if (isNaN(datePerformedObj.getTime())) {
          datePerformedObj = null;
        }
      } catch {
        datePerformedObj = null;
      }
    }

    const clinicalArchive = await db.clinicalArchive.create({
      data: {
        pregnancyId,
        motherId,
        type,
        title: title.trim(),
        fileUrl: fileUrl.trim(),
        datePerformed: datePerformedObj,
        notes: notes?.trim() || null,
        uploadedById: user.userId,
      },
      select: {
        id: true,
        pregnancyId: true,
        motherId: true,
        type: true,
        title: true,
        datePerformed: true,
        notes: true,
        fileUrl: true,
        createdAt: true,
      },
    });

    // ========================================================================
    // 7. LOG AUDIT (non-blocking)
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId || null,
      actorRole: user.role,
      action: 'CREATE',
      resource: 'clinical_archive',
      resourceId: clinicalArchive.id,
      changesSummary: {
        pregnancyId,
        motherId,
        type,
        fileUrl,
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
        message: 'Archive entry created successfully',
        data: clinicalArchive,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/clinical-archives:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
