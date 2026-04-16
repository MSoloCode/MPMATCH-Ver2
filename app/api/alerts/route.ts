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
 * GET /api/alerts
 * Retrieve alerts with automatic tenant scoping
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles:
 * - DOCTOR, MIDWIFE: Own hospital scope, create/read own alerts
 * - NURSE: Own hospital scope, read-only
 * - CHW: Own district scope, create/read community alerts
 * - AMBULANCE_MANAGER: Own district scope, alert management
 * - DHO, ORG_ADMIN: District/organization scope, read-only
 * - HOSPITAL_ADMIN: Hospital scope
 * - SYSTEM_ADMIN: Unrestricted access
 * 
 * Query parameters:
 * - type: Filter by alert type (MANUAL_EMERGENCY|HIGH_RISK_BP|DANGER_SIGN|COMMUNITY_REQUEST)
 * - status: Filter by alert status (OPEN|ACKNOWLEDGED|CLOSED)
 * - motherId: Filter by specific mother ID
 * - pregnancyId: Filter by specific pregnancy ID
 * - myAlerts: If true, show only alerts created by or assigned to current user (default: false)
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
 *       "type": "HIGH_RISK_BP",
 *       "status": "OPEN",
 *       "motherId": 42,
 *       "pregnancyId": 1,
 *       "ancVisitId": 15,
 *       "metadata": {"bpSystolic": 160, "bpDiastolic": 110},
 *       "createdAt": "2026-04-10T14:30:00Z",
 *       "mother": {
 *         "id": 42,
 *         "fullName": "Jane Doe",
 *         "phone": "+256701234567"
 *       },
 *       "initiatedBy": {
 *         "id": 10,
 *         "name": "Dr. Smith",
 *         "role": "DOCTOR"
 *       },
 *       "assignedTo": {
 *         "id": 20,
 *         "name": "Ambulance Manager",
 *         "role": "AMBULANCE_MANAGER"
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
      'MIDWIFE',
      'NURSE',
      'CHW',
      'AMBULANCE_MANAGER',
      'DHO',
      'ORG_ADMIN',
      'HOSPITAL_ADMIN',
      'SYSTEM_ADMIN',
    ];

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions to access alerts',
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
    // 4. PARSE & VALIDATE QUERY PARAMETERS
    // ========================================================================
    const { searchParams } = request.nextUrl;

    // Alert type filter (optional)
    const type = searchParams.get('type');
    const validTypes = ['MANUAL_EMERGENCY', 'HIGH_RISK_BP', 'DANGER_SIGN', 'COMMUNITY_REQUEST'];
    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid type. Allowed: ${validTypes.join(', ')}`,
        },
        { status: 422 }
      );
    }

    // Alert status filter (optional)
    const status = searchParams.get('status');
    const validStatuses = ['OPEN', 'ACKNOWLEDGED', 'CLOSED'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Allowed: ${validStatuses.join(', ')}`,
        },
        { status: 422 }
      );
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

    // My alerts filter (optional)
    const myAlertsParam = searchParams.get('myAlerts');
    const myAlerts = myAlertsParam === 'true';

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
    const scopeFilter = getTenantScopingFilter(user as ScopedUserPayload);

    const whereClause: any = {
      ...scopeFilter,
    };

    // Add additional filters
    if (type) {
      whereClause.type = type;
    }
    if (status) {
      whereClause.status = status;
    }
    if (motherId) {
      whereClause.motherId = motherId;
    }
    if (pregnancyId) {
      whereClause.pregnancyId = pregnancyId;
    }

    // My alerts: Only alerts created by or assigned to user
    if (myAlerts) {
      whereClause.OR = [
        { initiatedById: user.userId },
        { assignedToId: user.userId },
      ];
    }

    // ========================================================================
    // 6. QUERY ALERTS WITH RELATIONS
    // ========================================================================
    const [alerts, totalCount] = await Promise.all([
      db.alert.findMany({
        where: whereClause,
        select: {
          id: true,
          type: true,
          status: true,
          motherId: true,
          pregnancyId: true,
          ancVisitId: true,
          metadata: true,
          closedAt: true,
          createdAt: true,
          updatedAt: true,
          mother: {
            select: {
              id: true,
              fullName: true,
              phone: true,
            },
          },
          pregnancy: {
            select: {
              id: true,
              status: true,
              isHighRisk: true,
            },
          },
          ancVisit: {
            select: {
              id: true,
              visitNumber: true,
            },
          },
          initiatedBy: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      db.alert.count({ where: whereClause }),
    ]);

    // ========================================================================
    // 7. LOG AUDIT (non-blocking)
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId || null,
      actorRole: user.role,
      action: 'READ',
      resource: 'alert',
      changesSummary: {
        filters: {
          type: type || 'all',
          status: status || 'all',
          motherId: motherId || 'all',
          pregnancyId: pregnancyId || 'all',
          myAlerts,
        },
        resultCount: alerts.length,
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
        data: alerts,
        pagination: {
          total: totalCount,
          returned: alerts.length,
          skip,
          take,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/alerts:', error);
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
 * POST /api/alerts
 * Create a new alert (authenticated users only)
 * PROTECTED - Requires valid JWT token
 *
 * Allowed roles:
 * - DOCTOR, MIDWIFE, NURSE, CHW, HOSPITAL_ADMIN, SYSTEM_ADMIN
 *
 * Request body:
 * {
 *   "motherId": 42,
 *   "type": "MANUAL_EMERGENCY",
 *   "description": "Mother experiencing severe symptoms",
 *   "facilityId": 5,
 *   "pregnancyId": 1 (optional),
 *   "ancVisitId": 15 (optional)
 * }
 *
 * Response on success (201):
 * {
 *   "success": true,
 *   "message": "Alert created successfully",
 *   "data": {
 *     "id": 123,
 *     "motherId": 42,
 *     "type": "MANUAL_EMERGENCY",
 *     "status": "OPEN",
 *     "createdAt": "2026-04-16T10:30:00Z"
 *   }
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
 *   "error": "Insufficient permissions"
 * }
 *
 * Response on validation error (422):
 * {
 *   "success": false,
 *   "error": "Validation error message"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // ========================================================================
    // 1. AUTHENTICATION & AUTHORIZATION
    // ========================================================================
    let user;
    try {
      user = extractUser(request);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 401 }
        );
      }
      throw error;
    }

    const allowedRoles = ['DOCTOR', 'MIDWIFE', 'NURSE', 'CHW', 'HOSPITAL_ADMIN', 'SYSTEM_ADMIN'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to create alerts' },
        { status: 403 }
      );
    }

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

    const { motherId, type, description, facilityId, pregnancyId, ancVisitId } = body;

    // Validate motherId
    if (!motherId || typeof motherId !== 'number' || motherId <= 0) {
      return NextResponse.json(
        { success: false, error: 'motherId is required and must be a positive integer' },
        { status: 422 }
      );
    }

    // Validate type
    const validTypes = ['MANUAL_EMERGENCY', 'HIGH_RISK_BP', 'DANGER_SIGN', 'COMMUNITY_REQUEST'];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `type is required. Must be one of: ${validTypes.join(', ')}` },
        { status: 422 }
      );
    }

    // Validate description
    if (description && typeof description !== 'string') {
      return NextResponse.json(
        { success: false, error: 'description must be a string' },
        { status: 422 }
      );
    }

    // ========================================================================
    // 3. VERIFY MOTHER EXISTS
    // ========================================================================
    const mother = await db.mother.findUnique({
      where: { id: motherId },
    });

    if (!mother) {
      return NextResponse.json(
        { success: false, error: 'Mother not found' },
        { status: 404 }
      );
    }

    // ========================================================================
    // 4. CREATE ALERT
    // ========================================================================
    const alert = await db.alert.create({
      data: {
        motherId,
        type,
        status: 'OPEN',
        pregnancyId: pregnancyId ? Number(pregnancyId) : null,
        ancVisitId: ancVisitId ? Number(ancVisitId) : null,
        initiatedById: user.userId,
        metadata: description
          ? {
              description: description.trim().substring(0, 500),
              createdVia: 'CLINICAL_STAFF',
            }
          : { createdVia: 'CLINICAL_STAFF' },
      },
    });

    // ========================================================================
    // 5. WRITE AUDIT LOG
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId || null,
      actorRole: user.role,
      action: 'CREATE',
      resource: 'alert',
      resourceId: alert.id.toString(),
      changesSummary: {
        motherId,
        type,
        status: 'OPEN',
        description: description ? 'provided' : 'not provided',
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((error) => {
      console.error('Failed to write audit log:', error);
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Alert created successfully',
        data: alert,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/alerts:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
