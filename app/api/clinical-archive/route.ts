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
 * POST /api/clinical-archive
 * Create a new clinical archive entry (medical document, test result, etc.)
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles: DOCTOR, MIDWIFE, NURSE, HOSPITAL_ADMIN, SYSTEM_ADMIN
 *
 * Request body (JSON):
 * {
 *   "pregnancyId": 42,
 *   "type": "TEST_RESULT",           // TEST_RESULT|IMAGING|MEDICATION|PROCEDURE|OTHER
 *   "title": "Blood Test Results",
 *   "datePerformed": "2026-04-15T10:30:00Z",  // Optional ISO 8601 date
 *   "notes": "Normal results",       // Optional
 *   "fileUrl": "/uploads/clinical-archives/1713177000000-test.pdf"  // Optional
 * }
 *
 * Response on success (201):
 * {
 *   "success": true,
 *   "message": "Archive created successfully",
 *   "data": {
 *     "id": 5,
 *     "archiveId": 5,
 *     "pregnancyId": 42,
 *     "motherId": 10,
 *     "type": "TEST_RESULT",
 *     "title": "Blood Test Results",
 *     "datePerformed": "2026-04-15T10:30:00Z",
 *     "notes": "Normal results",
 *     "fileUrl": "/uploads/clinical-archives/1713177000000-test.pdf",
 *     "uploadedById": 1,
 *     "createdAt": "2026-04-20T14:30:00Z",
 *     "deletedAt": null
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
 *   "error": "Insufficient permissions"
 * }
 *
 * Response on validation error (422):
 * {
 *   "success": false,
 *   "error": "pregnancyId must be a positive integer"
 * }
 *
 * Response on not found (404):
 * {
 *   "success": false,
 *   "error": "Pregnancy not found"
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
    const allowedRoles = ['DOCTOR', 'MIDWIFE', 'NURSE', 'HOSPITAL_ADMIN', 'SYSTEM_ADMIN'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions to create clinical archive',
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
    // 4. PARSE REQUEST BODY
    // ========================================================================
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body - must be valid JSON',
        },
        { status: 422 }
      );
    }

    const { pregnancyId, type, title, datePerformed, notes, fileUrl } = body;

    // ========================================================================
    // 5. VALIDATE REQUIRED FIELDS
    // ========================================================================
    if (!pregnancyId || isNaN(pregnancyId) || pregnancyId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'pregnancyId must be a positive integer',
        },
        { status: 422 }
      );
    }

    if (!type || typeof type !== 'string' || type.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'type is required and must be a non-empty string',
        },
        { status: 422 }
      );
    }

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'title is required and must be a non-empty string',
        },
        { status: 422 }
      );
    }

    // Validate type enum
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

    // Validate datePerformed if provided
    let parsedDatePerformed: Date | null = null;
    if (datePerformed) {
      try {
        parsedDatePerformed = new Date(datePerformed);
        if (isNaN(parsedDatePerformed.getTime())) {
          return NextResponse.json(
            {
              success: false,
              error: 'datePerformed must be a valid ISO 8601 date string',
            },
            { status: 422 }
          );
        }
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: 'datePerformed must be a valid ISO 8601 date string',
          },
          { status: 422 }
        );
      }
    }

    // ========================================================================
    // 6. VERIFY PREGNANCY EXISTS AND GET MOTHER ID
    // ========================================================================
    const pregnancy = await db.pregnancy.findUnique({
      where: { id: pregnancyId },
      select: { id: true, motherId: true },
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

    const motherId = pregnancy.motherId;

    // ========================================================================
    // 7. CREATE CLINICAL ARCHIVE RECORD
    // ========================================================================
    const archive = await db.clinicalArchive.create({
      data: {
        pregnancyId,
        motherId,
        type: type.trim(),
        title: title.trim(),
        datePerformed: parsedDatePerformed,
        notes: notes ? (typeof notes === 'string' ? notes.trim() : '') : null,
        fileUrl: fileUrl ? (typeof fileUrl === 'string' ? fileUrl.trim() : '') : null,
        uploadedById: user.id,
      },
    });

    // ========================================================================
    // 8. AUDIT LOG (Non-blocking)
    // ========================================================================
    writeAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'CREATE',
      resource: 'clinical_archive',
      resourceId: archive.id,
      changesSummary: {
        pregnancyId,
        motherId,
        type,
        title,
        datePerformed: parsedDatePerformed?.toISOString(),
        fileUrl: fileUrl || null,
      },
      ...extractAuditContext(request),
    }).catch((err) => console.error('Audit log failed:', err));

    // ========================================================================
    // 9. RETURN SUCCESS RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        message: 'Archive created successfully',
        data: {
          ...archive,
          archiveId: archive.id,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating clinical archive:', error);
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
 * GET /api/clinical-archive?pregnancyId=X
 * Retrieve clinical archive entries for a specific pregnancy
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles:
 * - Clinical staff (DOCTOR, MIDWIFE, NURSE, HOSPITAL_ADMIN, SYSTEM_ADMIN) - scoped by tenant
 * - Community users (COMMUNITY_USER) - only for their own pregnancy (motherId match)
 *
 * Query parameters:
 * - pregnancyId (required): The pregnancy ID to fetch archives for
 * - skip: Pagination offset (default: 0)
 * - take: Number of records to return (default: 20, max: 100)
 *
 * Request headers:
 * {
 *   "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs..."
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 5,
 *       "pregnancyId": 42,
 *       "motherId": 10,
 *       "type": "TEST_RESULT",
 *       "title": "Blood Test Results",
 *       "datePerformed": "2026-04-15T10:30:00Z",
 *       "notes": "Normal results",
 *       "fileUrl": "/uploads/clinical-archives/1713177000000-test.pdf",
 *       "uploadedById": 1,
 *       "createdAt": "2026-04-20T14:30:00Z",
 *       "deletedAt": null,
 *       "uploadedBy": {
 *         "id": 1,
 *         "name": "Dr. John Smith",
 *         "role": "DOCTOR"
 *       }
 *     }
 *   ],
 *   "pagination": {
 *     "total": 5,
 *     "returned": 5,
 *     "skip": 0,
 *     "take": 20
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
 *   "error": "Insufficient permissions"
 * }
 *
 * Response on server error (500):
 * {
 *   "success": false,
 *   "error": "Internal server error"
 * }
 */
export async function GET(request: NextRequest) {
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
    // 2. PARSE QUERY PARAMETERS
    // ========================================================================
    const { searchParams } = request.nextUrl;
    const pregnancyId = searchParams.get('pregnancyId');

    if (!pregnancyId || isNaN(parseInt(pregnancyId, 10)) || parseInt(pregnancyId, 10) <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'pregnancyId query parameter is required and must be a positive integer',
        },
        { status: 422 }
      );
    }

    const pregnancyIdNum = parseInt(pregnancyId, 10);

    // Pagination parameters
    let skip = 0;
    let take = 20;

    const skipParam = searchParams.get('skip');
    if (skipParam) {
      skip = Math.max(0, parseInt(skipParam, 10));
    }

    const takeParam = searchParams.get('take');
    if (takeParam) {
      take = Math.min(100, Math.max(1, parseInt(takeParam, 10)));
    }

    // ========================================================================
    // 3. DETERMINE ACCESS LEVEL AND APPLY FILTERS
    // ========================================================================
    let scopeFilter: Record<string, any> = {};
    const isClinicalStaff = [
      'DOCTOR',
      'MIDWIFE',
      'NURSE',
      'HOSPITAL_ADMIN',
      'SYSTEM_ADMIN',
    ].includes(user.role);

    if (isClinicalStaff) {
      // Clinical staff: validate tenant scope
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
    } else if (user.role === 'COMMUNITY_USER') {
      // Community user: must have motherId and it must match the pregnancy's mother
      if (!user.motherId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Community user must have a linked mother record',
          },
          { status: 403 }
        );
      }
    } else {
      // Other roles not allowed
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions to access clinical archives',
        },
        { status: 403 }
      );
    }

    // ========================================================================
    // 4. VERIFY PREGNANCY EXISTS
    // ========================================================================
    const pregnancy = await db.pregnancy.findUnique({
      where: { id: pregnancyIdNum },
      select: { id: true, motherId: true },
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
    // 5. VERIFY COMMUNITY USER ACCESS
    // ========================================================================
    if (user.role === 'COMMUNITY_USER' && pregnancy.motherId !== user.motherId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions - you can only access archives for your own pregnancy',
        },
        { status: 403 }
      );
    }

    // ========================================================================
    // 6. BUILD WHERE CLAUSE WITH FILTERS
    // ========================================================================
    const where: Record<string, any> = {
      pregnancyId: pregnancyIdNum,
      deletedAt: null, // Exclude soft-deleted records
      ...scopeFilter,
    };

    // ========================================================================
    // 7. EXECUTE PAIRED QUERIES (data + count)
    // ========================================================================
    const [data, total] = await Promise.all([
      db.clinicalArchive.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: {
            select: { id: true, name: true, role: true },
          },
        },
      }),
      db.clinicalArchive.count({ where }),
    ]);

    // ========================================================================
    // 8. RETURN SUCCESS RESPONSE
    // ========================================================================
    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total,
        returned: data.length,
        skip,
        take,
      },
    });
  } catch (error) {
    console.error('Error fetching clinical archives:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
