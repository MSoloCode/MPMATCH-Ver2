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
    const scopeFilter = getTenantScopingFilter(user as ScopedUserPayload);

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
      resourceId: 0,
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

/**
 * POST /api/ancvisits
 * Create a new ANC (Antenatal Care) visit
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles:
 * - DOCTOR, NURSE, MIDWIFE: Create visits in own hospital scope
 * - DHO, ORG_ADMIN, HOSPITAL_ADMIN, SYSTEM_ADMIN: Create visits in their scope
 *
 * Request body:
 * {
 *   "pregnancyId": 1,
 *   "motherId": 42,
 *   "visitType": "ROUTINE|SCANNING|REVIEW|OTHER",
 *   "visitDateTime": "2026-04-17T14:30:00Z",
 *   "nextAppointment": "2026-05-17T14:30:00Z",
 *   "notes": "Patient doing well",
 *   "purposeOther": "Custom reason (required if visitType is OTHER)"
 * }
 *
 * Response on success (201):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 16,
 *     "visitNumber": 4,
 *     "pregnancyId": 1,
 *     "motherId": 42,
 *     "visitType": "ROUTINE",
 *     "visitDateTime": "2026-04-17T14:30:00Z",
 *     "nextAppointment": "2026-05-17T14:30:00Z",
 *     "notes": "Patient doing well",
 *     "createdById": 10,
 *     "createdAt": "2026-04-17T15:00:00Z"
 *   }
 * }
 *
 * Response on validation error (422):
 * {
 *   "success": false,
 *   "error": "Invalid request"
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
          error: 'Insufficient permissions to create ANC visits',
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
      pregnancyId,
      motherId,
      visitType,
      visitDateTime,
      nextAppointment,
      notes = '',
      purposeOther = '',
      vitals,
    } = body;

    // ========================================================================
    // 5. VALIDATE REQUIRED FIELDS
    // ========================================================================
    if (!pregnancyId || typeof pregnancyId !== 'number' || pregnancyId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'pregnancyId is required and must be a positive integer',
        },
        { status: 422 }
      );
    }

    if (!motherId || typeof motherId !== 'number' || motherId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'motherId is required and must be a positive integer',
        },
        { status: 422 }
      );
    }

    if (!visitType || !['ROUTINE', 'SCANNING', 'REVIEW', 'OTHER'].includes(visitType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'visitType must be one of: ROUTINE, SCANNING, REVIEW, OTHER',
        },
        { status: 422 }
      );
    }

    if (!visitDateTime) {
      return NextResponse.json(
        {
          success: false,
          error: 'visitDateTime is required',
        },
        { status: 422 }
      );
    }

    if (visitType === 'OTHER' && !purposeOther) {
      return NextResponse.json(
        {
          success: false,
          error: 'purposeOther is required when visitType is OTHER',
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 5b. VALIDATE VITALS (if provided)
    // ========================================================================
    if (vitals) {
      const { systolicBP, diastolicBP, bpNotTaken, temperatureC, weightKg, pulseBpm, respRate, oxygenSatPct } = vitals;

      // BP validation: Must have both systolic and diastolic OR bpNotTaken must be true
      if (!bpNotTaken) {
        if (systolicBP === undefined || systolicBP === null || systolicBP === '') {
          return NextResponse.json(
            {
              success: false,
              error: 'systolicBP is required unless bpNotTaken is true',
            },
            { status: 422 }
          );
        }
        if (diastolicBP === undefined || diastolicBP === null || diastolicBP === '') {
          return NextResponse.json(
            {
              success: false,
              error: 'diastolicBP is required unless bpNotTaken is true',
            },
            { status: 422 }
          );
        }
        if (typeof systolicBP !== 'number' || systolicBP <= 0) {
          return NextResponse.json(
            {
              success: false,
              error: 'systolicBP must be a positive number',
            },
            { status: 422 }
          );
        }
        if (typeof diastolicBP !== 'number' || diastolicBP <= 0) {
          return NextResponse.json(
            {
              success: false,
              error: 'diastolicBP must be a positive number',
            },
            { status: 422 }
          );
        }
      }

      // Validate optional numeric fields (allow null/undefined, but if provided must be valid numbers)
      if (temperatureC !== undefined && temperatureC !== null && typeof temperatureC !== 'number') {
        return NextResponse.json(
          {
            success: false,
            error: 'temperatureC must be a number',
          },
          { status: 422 }
        );
      }
      if (weightKg !== undefined && weightKg !== null && typeof weightKg !== 'number') {
        return NextResponse.json(
          {
            success: false,
            error: 'weightKg must be a number',
          },
          { status: 422 }
        );
      }
      if (pulseBpm !== undefined && pulseBpm !== null && typeof pulseBpm !== 'number') {
        return NextResponse.json(
          {
            success: false,
            error: 'pulseBpm must be a number',
          },
          { status: 422 }
        );
      }
      if (respRate !== undefined && respRate !== null && typeof respRate !== 'number') {
        return NextResponse.json(
          {
            success: false,
            error: 'respRate must be a number',
          },
          { status: 422 }
        );
      }
      if (oxygenSatPct !== undefined && oxygenSatPct !== null && typeof oxygenSatPct !== 'number') {
        return NextResponse.json(
          {
            success: false,
            error: 'oxygenSatPct must be a number',
          },
          { status: 422 }
        );
      }
    }

    // Parse dates
    const visitDate = new Date(visitDateTime);
    if (isNaN(visitDate.getTime())) {
      return NextResponse.json(
        {
          success: false,
          error: 'visitDateTime must be a valid ISO 8601 date',
        },
        { status: 422 }
      );
    }

    let nextApptDate: Date | null = null;
    if (nextAppointment) {
      nextApptDate = new Date(nextAppointment);
      if (isNaN(nextApptDate.getTime())) {
        return NextResponse.json(
          {
            success: false,
            error: 'nextAppointment must be a valid ISO 8601 date',
          },
          { status: 422 }
        );
      }
    }

    // ========================================================================
    // 6. VERIFY PREGNANCY AND MOTHER EXIST AND BELONG TO USER'S SCOPE
    // ========================================================================
    const scopeFilter = getTenantScopingFilter(user as ScopedUserPayload);

    const pregnancy = await db.pregnancy.findFirst({
      where: {
        id: pregnancyId,
        motherId: motherId,
        ...scopeFilter,
      },
      select: {
        id: true,
        motherId: true,
        antenatalStatus: true,
      },
    });

    if (!pregnancy) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pregnancy not found or access denied',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 7. GET CURRENT VISIT NUMBER FOR THIS PREGNANCY
    // ========================================================================
    const lastVisit = await db.ancVisit.findFirst({
      where: {
        pregnancyId: pregnancyId,
        deletedAt: null,
      },
      orderBy: { visitNumber: 'desc' },
      select: { visitNumber: true },
    });

    const visitNumber = (lastVisit?.visitNumber || 0) + 1;

    // ========================================================================
    // 8. CREATE ANC VISIT
    // ========================================================================
    const newVisit = await db.ancVisit.create({
      data: {
        pregnancyId,
        motherId,
        visitNumber,
        visitType,
        purposeOther: visitType === 'OTHER' ? purposeOther : null,
        visitDateTime: visitDate,
        nextAppointment: nextApptDate,
        notes: notes || null,
        createdById: user.userId,
      },
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
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    // ========================================================================
    // 8b. CREATE VITALS RECORD (if vitals data provided)
    // ========================================================================
    let createdVitals = null;
    if (vitals) {
      const { systolicBP, diastolicBP, bpNotTaken, temperatureC, weightKg, pulseBpm, respRate, oxygenSatPct } = vitals;
      
      createdVitals = await db.vitals.create({
        data: {
          ancVisitId: newVisit.id,
          pregnancyId: pregnancyId,
          motherId: motherId,
          systolicBP: bpNotTaken ? null : systolicBP,
          diastolicBP: bpNotTaken ? null : diastolicBP,
          bpNotTaken: !!bpNotTaken,
          temperatureC: temperatureC || null,
          weightKg: weightKg || null,
          pulseBpm: pulseBpm || null,
          respRate: respRate || null,
          oxygenSatPct: oxygenSatPct || null,
          createdById: user.userId,
        },
        select: {
          id: true,
          ancVisitId: true,
          systolicBP: true,
          diastolicBP: true,
          bpNotTaken: true,
          temperatureC: true,
          weightKg: true,
          pulseBpm: true,
          respRate: true,
          oxygenSatPct: true,
          createdAt: true,
        },
      });
    }

    // ========================================================================
    // 9. CREATE REMINDER SCHEDULE (if nextAppointment is set)
    // ========================================================================
    if (nextApptDate) {
      // Calculate sendAt as 24 hours before the appointment
      const sendAtTime = new Date(nextApptDate.getTime() - 24 * 60 * 60 * 1000);

      db.reminderSchedule.create({
        data: {
          ancVisitId: newVisit.id,
          motherId: motherId,
          sendAt: sendAtTime,
          type: 'ANC_REMINDER',
          status: 'PENDING',
        },
      }).catch((error) => {
        console.error('Failed to create reminder schedule:', error);
        // Don't block visit creation on reminder creation failure
      });
    }

    // ========================================================================
    // 10. LOG AUDIT (non-blocking)
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId || null,
      actorRole: user.role,
      action: 'CREATE',
      resource: 'ancvisit',
      resourceId: newVisit.id,
      changesSummary: {
        visitNumber: newVisit.visitNumber,
        visitType: newVisit.visitType,
        pregnancyId: newVisit.pregnancyId,
        motherId: newVisit.motherId,
        nextAppointment: newVisit.nextAppointment,
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((error) => {
      console.error('Failed to write audit log:', error);
    });

    // ========================================================================
    // 12. RETURN SUCCESS RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: {
          ...newVisit,
          vitals: createdVitals,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/ancvisits:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
