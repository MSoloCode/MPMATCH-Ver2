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
 * GET /api/mothers
 * Retrieve mothers with automatic tenant scoping
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles:
 * - DOCTOR, NURSE, MIDWIFE, CHW: Hospital/district scope
 * - DHO, ORG_ADMIN, HOSPITAL_ADMIN: District/hospital scope
 * - COMMUNITY_USER: Own mother record only (if exposed)
 * - SYSTEM_ADMIN: Unrestricted access
 * 
 * Query parameters:
 * - consentAccepted: Filter by consent status (true|false)
 * - skip: Pagination offset (default: 0)
 * - take: Number of records to return (default: 20, max: 100)
 * - search: Search by fullName or phone (partial match, min 2 chars)
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
 *       "id": 42,
 *       "fullName": "Jane Doe",
 *       "phone": "+256701234567",
 *       "village": "Bukoto",
 *       "dob": "1990-03-15T00:00:00Z",
 *       "districtId": 1,
 *       "facilityId": 5,
 *       "consentAccepted": true,
 *       "consentDate": "2026-04-01T10:30:00Z",
 *       "district": {
 *         "id": 1,
 *         "name": "Kampala"
 *       },
 *       "facility": {
 *         "id": 5,
 *         "name": "Mulago Hospital"
 *       }
 *     }
 *   ],
 *   "pagination": {
 *     "total": 156,
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
      'COMMUNITY_USER', // Can view own mother record if implemented
    ];

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions to access mothers',
        },
        { status: 403 }
      );
    }

    // ========================================================================
    // 3. VALIDATE TENANT SCOPE (except COMMUNITY_USER)
    // ========================================================================
    if (user.role !== 'COMMUNITY_USER') {
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
    }

    // ========================================================================
    // 4. PARSE & VALIDATE QUERY PARAMETERS
    // ========================================================================
    const { searchParams } = request.nextUrl;

    // Consent filter (optional)
    const consentAcceptedParam = searchParams.get('consentAccepted');
    let consentAccepted: boolean | undefined;
    if (consentAcceptedParam) {
      if (!['true', 'false'].includes(consentAcceptedParam)) {
        return NextResponse.json(
          {
            success: false,
            error: 'consentAccepted must be true or false',
          },
          { status: 422 }
        );
      }
      consentAccepted = consentAcceptedParam === 'true';
    }

    // Search filter (optional)
    const search = searchParams.get('search');
    if (search && search.trim().length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: 'Search term must be at least 2 characters',
        },
        { status: 422 }
      );
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
    let whereClause: any = {};

    // COMMUNITY_USER: Only their own mother record
    if (user.role === 'COMMUNITY_USER') {
      if (!user.motherId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing motherId in token for COMMUNITY_USER',
          },
          { status: 403 }
        );
      }
      whereClause.id = user.motherId;
    } else {
      // Other roles: Apply tenant scoping
      whereClause = getTenantScopingFilter(user as ScopedUserPayload);
    }

    // Add additional filters
    if (consentAccepted !== undefined) {
      whereClause.consentAccepted = consentAccepted;
    }

    if (search) {
      // Search by fullName or phone (case-insensitive)
      whereClause.OR = [
        {
          fullName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          phone: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    // ========================================================================
    // 6. QUERY MOTHERS WITH RELATIONS
    // ========================================================================
    const [mothers, totalCount] = await Promise.all([
      db.mother.findMany({
        where: whereClause,
        select: {
          id: true,
          fullName: true,
          phone: true,
          dob: true,
          village: true,
          districtId: true,
          facilityId: true,
          consentAccepted: true,
          consentDate: true,
          createdAt: true,
          updatedAt: true,
          district: {
            select: {
              id: true,
              name: true,
            },
          },
          facility: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      db.mother.count({ where: whereClause }),
    ]);

    // ========================================================================
    // 7. LOG AUDIT (non-blocking)
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId || user.motherId || null,
      actorRole: user.role,
      action: 'READ',
      resource: 'mother',
      resourceId: 0,
      changesSummary: {
        filters: {
          consentAccepted: consentAccepted || 'all',
          search: search || 'none',
        },
        resultCount: mothers.length,
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
        data: mothers,
        pagination: {
          total: totalCount,
          returned: mothers.length,
          skip,
          take,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/mothers:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
