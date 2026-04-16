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
    const scopeFilter = getTenantScopingFilter(user as ScopedUserPayload);

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
      resourceId: 0,
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

/**
 * POST /api/pregnancies
 * Create a new pregnancy episode for a mother
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles: DOCTOR, NURSE, MIDWIFE, DHO, ORG_ADMIN, HOSPITAL_ADMIN, SYSTEM_ADMIN
 *
 * Request body:
 * {
 *   "motherId": 42,
 *   "lmpDate": "2025-10-15",  // ISO date string, must be valid past date ≤ 42 weeks ago
 *   "edd": "2026-07-23",       // Optional, auto-calculated as lmpDate + 280 days if omitted
 *   "gravida": 2,              // Optional, auto-calculated from obstetricHistory if omitted
 *   "parity": 1,               // Optional, auto-calculated from obstetricHistory if omitted
 *   "multiplePregnancy": "NONE|TWINS|TRIPLETS_PLUS",
 *   "riskFactors": ["Hypertension", "Diabetes"],  // Array of risk factor strings
 *   "antenatalStatus": "YET_TO_START|ACTIVE|COMPLETED",
 *   "obstetricHistory": [
 *     {
 *       "year": 2024,
 *       "outcome": "LIVE_BIRTH|MISCARRIAGE|STILLBIRTH|ABORTION",
 *       "deliveryMode": "SVD|C_SECTION|ASSISTED",
 *       "complications": ["Gestational diabetes"]
 *     }
 *   ]
 * }
 *
 * Response on success (201):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 1,
 *     "motherId": 42,
 *     "lmpDate": "2025-10-15T00:00:00Z",
 *     "edd": "2026-07-23T00:00:00Z",
 *     "gravida": 2,
 *     "parity": 1,
 *     "multiplePregnancy": "NONE",
 *     "riskFactors": ["Hypertension", "Diabetes"],
 *     "isHighRisk": true,
 *     "antenatalStatus": "YET_TO_START",
 *     "status": "ACTIVE",
 *     "createdAt": "2026-04-16T10:30:00Z"
 *   }
 * }
 *
 * Response on validation error (422):
 * {
 *   "success": false,
 *   "error": "Invalid lmpDate: must be a past date not more than 42 weeks ago"
 * }
 *
 * Response on unauthorized (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized - no token provided"
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

    // Verify user has permission to create pregnancies
    const allowedRoles = ['DOCTOR', 'NURSE', 'MIDWIFE', 'DHO', 'ORG_ADMIN', 'HOSPITAL_ADMIN', 'SYSTEM_ADMIN'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions to create pregnancies',
        },
        { status: 403 }
      );
    }

    // ========================================================================
    // 2. PARSE REQUEST BODY
    // ========================================================================
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON body',
        },
        { status: 400 }
      );
    }

    const {
      motherId,
      lmpDate,
      edd: providedEdd,
      gravida: providedGravida,
      parity: providedParity,
      multiplePregnancy = 'NONE',
      riskFactors = [],
      antenatalStatus = 'YET_TO_START',
      obstetricHistory = [],
    } = body;

    // ========================================================================
    // 3. VALIDATE REQUIRED FIELDS
    // ========================================================================
    if (!motherId || typeof motherId !== 'number') {
      return NextResponse.json(
        {
          success: false,
          error: 'motherId is required and must be a number',
        },
        { status: 422 }
      );
    }

    if (!lmpDate || typeof lmpDate !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'lmpDate is required and must be a string (ISO date format)',
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 4. VALIDATE LMP DATE
    // ========================================================================
    let lmpDateObj;
    try {
      lmpDateObj = new Date(lmpDate);
      if (isNaN(lmpDateObj.getTime())) {
        throw new Error('Invalid date');
      }
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'lmpDate must be a valid ISO date string (e.g., 2025-10-15)',
        },
        { status: 422 }
      );
    }

    const now = new Date();
    if (lmpDateObj > now) {
      return NextResponse.json(
        {
          success: false,
          error: 'lmpDate must be a past date',
        },
        { status: 422 }
      );
    }

    // Check if lmpDate is not more than 42 weeks (294 days) ago
    const maxLmpDateMs = now.getTime() - 294 * 24 * 60 * 60 * 1000;
    if (lmpDateObj.getTime() < maxLmpDateMs) {
      return NextResponse.json(
        {
          success: false,
          error: 'lmpDate must not be more than 42 weeks ago',
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 5. VALIDATE MULTIPLE PREGNANCY VALUE
    // ========================================================================
    const validMultiplePregnancyValues = ['NONE', 'TWINS', 'TRIPLETS_PLUS'];
    if (!validMultiplePregnancyValues.includes(multiplePregnancy)) {
      return NextResponse.json(
        {
          success: false,
          error: `multiplePregnancy must be one of: ${validMultiplePregnancyValues.join(', ')}`,
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 6. VALIDATE ANTENATAL STATUS
    // ========================================================================
    const validAntenatalStatuses = ['YET_TO_START', 'ACTIVE', 'COMPLETED'];
    if (!validAntenatalStatuses.includes(antenatalStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `antenatalStatus must be one of: ${validAntenatalStatuses.join(', ')}`,
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 7. VALIDATE RISK FACTORS
    // ========================================================================
    if (!Array.isArray(riskFactors)) {
      return NextResponse.json(
        {
          success: false,
          error: 'riskFactors must be an array',
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 8. VALIDATE OBSTETRIC HISTORY
    // ========================================================================
    if (!Array.isArray(obstetricHistory)) {
      return NextResponse.json(
        {
          success: false,
          error: 'obstetricHistory must be an array',
        },
        { status: 422 }
      );
    }

    const validOutcomes = ['LIVE_BIRTH', 'MISCARRIAGE', 'STILLBIRTH', 'ABORTION'];
    const validDeliveryModes = ['SVD', 'C_SECTION', 'ASSISTED'];

    for (let i = 0; i < obstetricHistory.length; i++) {
      const record = obstetricHistory[i];
      if (!record.year || typeof record.year !== 'number') {
        return NextResponse.json(
          {
            success: false,
            error: `obstetricHistory[${i}]: year is required and must be a number`,
          },
          { status: 422 }
        );
      }
      if (!record.outcome || !validOutcomes.includes(record.outcome)) {
        return NextResponse.json(
          {
            success: false,
            error: `obstetricHistory[${i}]: outcome must be one of ${validOutcomes.join(', ')}`,
          },
          { status: 422 }
        );
      }
      if (record.deliveryMode && !validDeliveryModes.includes(record.deliveryMode)) {
        return NextResponse.json(
          {
            success: false,
            error: `obstetricHistory[${i}]: deliveryMode must be one of ${validDeliveryModes.join(', ')}`,
          },
          { status: 422 }
        );
      }
      if (record.complications && !Array.isArray(record.complications)) {
        return NextResponse.json(
          {
            success: false,
            error: `obstetricHistory[${i}]: complications must be an array`,
          },
          { status: 422 }
        );
      }
    }

    // ========================================================================
    // 9. VERIFY MOTHER EXISTS
    // ========================================================================
    const mother = await db.mother.findUnique({
      where: { id: motherId },
    });

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
    // 10. CALCULATE EDD IF NOT PROVIDED
    // ========================================================================
    let eddDate = providedEdd ? new Date(providedEdd) : new Date(lmpDateObj);
    if (!providedEdd) {
      eddDate.setDate(eddDate.getDate() + 280);
    }

    // ========================================================================
    // 11. CALCULATE GRAVIDA AND PARITY FROM OBSTETRIC HISTORY
    // ========================================================================
    let gravida = providedGravida ?? obstetricHistory.length;
    let parity = providedParity ?? obstetricHistory.filter((record) => record.outcome === 'LIVE_BIRTH').length;

    // ========================================================================
    // 12. DETERMINE IF HIGH RISK
    // ========================================================================
    const highRiskFactors = ['Hypertension', 'Diabetes', 'HIV+', 'Previous C-section'];
    const isHighRisk = riskFactors.some((factor) => highRiskFactors.includes(factor));

    // ========================================================================
    // 13. CREATE PREGNANCY AND OBSTETRIC HISTORY RECORDS
    // ========================================================================
    const pregnancy = await db.pregnancy.create({
      data: {
        motherId,
        lmpDate: lmpDateObj,
        edd: eddDate,
        gravida,
        parity,
        multiplePregnancy,
        riskFactors: JSON.stringify(riskFactors),
        isHighRisk,
        antenatalStatus,
        status: 'ACTIVE',
        openedById: user.userId,
        obstetricHistory: {
          createMany: {
            data: obstetricHistory.map((record) => ({
              year: record.year,
              outcome: record.outcome,
              deliveryMode: record.deliveryMode || null,
              complications: record.complications ? JSON.stringify(record.complications) : null,
            })),
          },
        },
      },
      select: {
        id: true,
        motherId: true,
        lmpDate: true,
        edd: true,
        gravida: true,
        parity: true,
        multiplePregnancy: true,
        riskFactors: true,
        isHighRisk: true,
        antenatalStatus: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // ========================================================================
    // 14. LOG AUDIT (non-blocking)
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId || null,
      actorRole: user.role,
      action: 'CREATE',
      resource: 'pregnancy',
      resourceId: pregnancy.id,
      changesSummary: {
        motherId,
        lmpDate: lmpDate,
        isHighRisk,
        riskFactors,
        obstetricHistoryCount: obstetricHistory.length,
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((error) => {
      console.error('Failed to write audit log:', error);
      // Don't fail the request over audit logging
    });

    // ========================================================================
    // 15. RETURN SUCCESS RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        message: 'Pregnancy created successfully',
        data: {
          ...pregnancy,
          riskFactors: JSON.parse(pregnancy.riskFactors || '[]'),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/pregnancies:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
