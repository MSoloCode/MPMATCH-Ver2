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
 * GET /api/pregnancies
 * Retrieve pregnancies with automatic tenant scoping
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles: DOCTOR, NURSE, MIDWIFE, DHO, ORG_ADMIN, HOSPITAL_ADMIN, SYSTEM_ADMIN
 * 
 * Query parameters:
 * - status: Filter by pregnancy status (ACTIVE|CLOSED|DELIVERED)
 * - isHighRisk: Filter by high-risk flag (true|false)
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
 *       "id": 1,
 *       "motherId": 42,
 *       "lmpDate": "2026-01-15T00:00:00Z",
 *       "edd": "2026-10-22T00:00:00Z",
 *       "gravida": 2,
 *       "parity": 1,
 *       "status": "ACTIVE",
 *       "isHighRisk": false,
 *       "antenatalStatus": "ACTIVE",
 *       "mother": {
 *         "id": 42,
 *         "fullName": "Jane Doe",
 *         "phone": "+256701234567",
 *         "facility": {
 *           "id": 5,
 *           "name": "Mulago Hospital",
 *           "districtId": 1
 *         }
 *       }
 *     }
 *   ],
 *   "pagination": {
 *     "total": 47,
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
      'DHO',
      'ORG_ADMIN',
      'HOSPITAL_ADMIN',
      'SYSTEM_ADMIN',
    ];

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions to access pregnancies',
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

    // Status filter (optional)
    const status = searchParams.get('status');
    const validStatuses = ['ACTIVE', 'CLOSED', 'DELIVERED'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Allowed: ${validStatuses.join(', ')}`,
        },
        { status: 422 }
      );
    }

    // High-risk filter (optional)
    const isHighRiskParam = searchParams.get('isHighRisk');
    let isHighRisk: boolean | undefined;
    if (isHighRiskParam) {
      if (!['true', 'false'].includes(isHighRiskParam)) {
        return NextResponse.json(
          {
            success: false,
            error: 'isHighRisk must be true or false',
          },
          { status: 422 }
        );
      }
      isHighRisk = isHighRiskParam === 'true';
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
    };

    // Add additional filters
    if (status) {
      whereClause.status = status;
    }
    if (isHighRisk !== undefined) {
      whereClause.isHighRisk = isHighRisk;
    }

    // ========================================================================
    // 6. QUERY PREGNANCIES WITH RELATIONS
    // ========================================================================
    const [pregnancies, totalCount] = await Promise.all([
      db.pregnancy.findMany({
        where: whereClause,
        select: {
          id: true,
          motherId: true,
          lmpDate: true,
          edd: true,
          gravida: true,
          parity: true,
          multiplePregnancy: true,
          isHighRisk: true,
          antenatalStatus: true,
          status: true,
          deliveryDate: true,
          deliveryOutcome: true,
          babyWeightKg: true,
          createdAt: true,
          updatedAt: true,
          mother: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              village: true,
              facility: {
                select: {
                  id: true,
                  name: true,
                  districtId: true,
                },
              },
            },
          },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      db.pregnancy.count({ where: whereClause }),
    ]);

    // ========================================================================
    // 7. LOG AUDIT (non-blocking)
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId || null,
      actorRole: user.role,
      action: 'READ',
      resource: 'pregnancy',
      changesSummary: {
        filters: {
          status: status || 'all',
          isHighRisk: isHighRisk || 'all',
        },
        resultCount: pregnancies.length,
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
        data: pregnancies,
        pagination: {
          total: totalCount,
          returned: pregnancies.length,
          skip,
          take,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/pregnancies:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
