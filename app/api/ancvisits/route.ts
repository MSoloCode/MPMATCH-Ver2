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
 * GET /api/ancvisits
 * Retrieve ANC (Antenatal Care) visits with automatic tenant scoping
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles:
 * - DOCTOR, NURSE, MIDWIFE: Own hospital scope
 * - CHW: Own district scope
 * - DHO, ORG_ADMIN: District/organization scope (read-only)
 * - HOSPITAL_ADMIN: Hospital scope
 * - SYSTEM_ADMIN: Unrestricted access
 * 
 * Query parameters:
 * - visitType: Filter by visit type (ROUTINE|SCANNING|REVIEW|OTHER)
 * - pregnancyId: Filter by specific pregnancy ID
 * - motherId: Filter by specific mother ID
 * - startDate: Filter visits on or after date (ISO 8601)
 * - endDate: Filter visits on or before date (ISO 8601)
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
 *       "id": 15,
 *       "pregnancyId": 1,
 *       "motherId": 42,
 *       "visitNumber": 3,
 *       "visitType": "ROUTINE",
 *       "visitDateTime": "2026-04-10T14:30:00Z",
 *       "nextAppointment": "2026-05-10T14:30:00Z",
 *       "notes": "BP elevated, advised rest",
 *       "createdAt": "2026-04-10T14:45:00Z",
 *       "pregnancy": {
 *         "id": 1,
 *         "status": "ACTIVE",
 *         "isHighRisk": false
 *       },
 *       "mother": {
 *         "id": 42,
 *         "fullName": "Jane Doe",
 *         "phone": "+256701234567"
 *       },
 *       "createdBy": {
 *         "id": 10,
 *         "name": "Dr. Smith",
 *         "role": "DOCTOR"
 *       }
 *     }
 *   ],
 *   "pagination": {
 *     "total": 287,
 *     "returned": 20,
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
 *   "error": "Insufficient permissions or invalid tenant scope"
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
      assertValidTenantScope(user);
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
    // 4. PARSE & VALIDATE QUERY PARAMETERS
    // ========================================================================
    const { searchParams } = request.nextUrl;

    // Visit type filter (optional)
    const visitType = searchParams.get('visitType');
    const validVisitTypes = ['ROUTINE', 'SCANNING', 'REVIEW', 'OTHER'];
    if (visitType && !validVisitTypes.includes(visitType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid visitType. Allowed: ${validVisitTypes.join(', ')}`,
        },
        { status: 422 }
      );
    }

    // Pregnancy ID filter (optional)
    let pregnancyId: number | undefined;
    const pregnancyIdParam = searchParams.get('pregnancyId');
    if (pregnancyIdParam) {
      pregnancyId = parseInt(pregnancyIdParam, 10);
      if (isNaN(pregnancyId) || pregnancyId <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'pregnancyId must be a positive integer',
          },
          { status: 422 }
        );
      }
    }

    // Mother ID filter (optional)
    let motherId: number | undefined;
    const motherIdParam = searchParams.get('motherId');
    if (motherIdParam) {
      motherId = parseInt(motherIdParam, 10);
      if (isNaN(motherId) || motherId <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'motherId must be a positive integer',
          },
          { status: 422 }
        );
      }
    }

    // Date range filters (optional)
    let startDate: Date | undefined;
    const startDateParam = searchParams.get('startDate');
    if (startDateParam) {
      startDate = new Date(startDateParam);
      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          {
            success: false,
            error: 'startDate must be valid ISO 8601 date',
          },
          { status: 422 }
        );
      }
    }

    let endDate: Date | undefined;
    const endDateParam = searchParams.get('endDate');
    if (endDateParam) {
      endDate = new Date(endDateParam);
      if (isNaN(endDate.getTime())) {
        return NextResponse.json(
          {
            success: false,
            error: 'endDate must be valid ISO 8601 date',
          },
          { status: 422 }
        );
      }
    }

    // Pagination parameters
    let skip = 0;
    let take = 20;

    const skipParam = searchParams.get('skip');
    if (skipParam) {
      skip = Math.max(0, parseInt(skipParam, 10));
      if (isNaN(skip)) {
        return NextResponse.json(
          {
            success: false,
            error: 'skip must be a non-negative integer',
          },
          { status: 422 }
        );
      }
    }

    const takeParam = searchParams.get('take');
    if (takeParam) {
      take = Math.max(1, Math.min(100, parseInt(takeParam, 10)));
      if (isNaN(take)) {
        return NextResponse.json(
          {
            success: false,
            error: 'take must be a positive integer (max 100)',
          },
          { status: 422 }
        );
      }
    }

    // ========================================================================
    // 5. BUILD WHERE CLAUSE WITH TENANT SCOPING
    // ========================================================================
    const scopeFilter = getTenantScopingFilter(user);

    const whereClause: any = {
      ...scopeFilter,
      deletedAt: null, // Always exclude soft-deleted records
    };

    // Add additional filters
    if (visitType) {
      whereClause.visitType = visitType;
    }
    if (pregnancyId) {
      whereClause.pregnancyId = pregnancyId;
    }
    if (motherId) {
      whereClause.motherId = motherId;
    }

    // Date range filter
    if (startDate || endDate) {
      whereClause.visitDateTime = {};
      if (startDate) {
        whereClause.visitDateTime.gte = startDate;
      }
      if (endDate) {
        whereClause.visitDateTime.lte = endDate;
      }
    }

    // ========================================================================
    // 6. QUERY ANC VISITS WITH RELATIONS
    // ========================================================================
    const [ancVisits, totalCount] = await Promise.all([
      db.ancVisit.findMany({
        where: whereClause,
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
        },
        skip,
        take,
        orderBy: { visitDateTime: 'desc' },
      }),
      db.ancVisit.count({ where: whereClause }),
    ]);

    // ========================================================================
    // 7. LOG AUDIT (non-blocking)
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId || null,
      actorRole: user.role,
      action: 'READ',
      resource: 'ancvisit',
      changesSummary: {
        filters: {
          visitType: visitType || 'all',
          pregnancyId: pregnancyId || 'all',
          motherId: motherId || 'all',
          dateRange: startDate || endDate ? { start: startDate, end: endDate } : 'all',
        },
        resultCount: ancVisits.length,
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
        data: ancVisits,
        pagination: {
          total: totalCount,
          returned: ancVisits.length,
          skip,
          take,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/ancvisits:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
