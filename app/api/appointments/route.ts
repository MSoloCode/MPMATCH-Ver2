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
 * GET /api/appointments
 * Retrieve appointments with automatic tenant scoping
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles:
 * - DOCTOR, NURSE, MIDWIFE: Own hospital scope
 * - CHW: Own district scope, manage community appointments
 * - DHO, ORG_ADMIN: District/organization scope, read-only
 * - HOSPITAL_ADMIN: Hospital scope
 * - COMMUNITY_USER: Own appointments only (if exposed)
 * - SYSTEM_ADMIN: Unrestricted access
 * 
 * Query parameters:
 * - status: Filter by appointment status (SCHEDULED|CONFIRMED|MISSED|LIKELY_MISSED|CANCELLED|ATTENDED)
 * - motherId: Filter by specific mother ID
 * - pregnancyId: Filter by specific pregnancy ID
 * - startDate: Filter appointments on or after date (ISO 8601)
 * - endDate: Filter appointments on or before date (ISO 8601)
 * - upcoming: If true, show only future appointments (status=SCHEDULED|CONFIRMED, date >= now)
 * - assignedCHWId: Filter by assigned CHW (for facility staff)
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
 *       "id": 42,
 *       "motherId": 42,
 *       "pregnancyId": 1,
 *       "ancVisitId": 15,
 *       "appointmentDateTime": "2026-04-20T10:00:00Z",
 *       "purpose": "ROUTINE",
 *       "purposeOther": null,
 *       "status": "SCHEDULED",
 *       "notes": "Routine 28-week checkup",
 *       "createdAt": "2026-04-10T14:30:00Z",
 *       "mother": {
 *         "id": 42,
 *         "fullName": "Jane Doe",
 *         "phone": "+256701234567"
 *       },
 *       "pregnancy": {
 *         "id": 1,
 *         "status": "ACTIVE"
 *       },
 *       "assignedCHW": {
 *         "id": 5,
 *         "name": "John CHW",
 *         "role": "CHW"
 *       },
 *       "createdBy": {
 *         "id": 10,
 *         "name": "Dr. Smith",
 *         "role": "DOCTOR"
 *       }
 *     }
 *   ],
 *   "pagination": {
 *     "total": 142,
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
      'COMMUNITY_USER', // Can view own appointments
    ];

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions to access appointments',
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

    // Status filter (optional)
    const status = searchParams.get('status');
    const validStatuses = [
      'SCHEDULED',
      'CONFIRMED',
      'MISSED',
      'LIKELY_MISSED',
      'CANCELLED',
      'ATTENDED',
    ];
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

    // Assigned CHW ID filter (optional)
    let assignedCHWId: number | undefined;
    const assignedCHWIdParam = searchParams.get('assignedCHWId');
    if (assignedCHWIdParam) {
      assignedCHWId = parseInt(assignedCHWIdParam, 10);
      if (isNaN(assignedCHWId) || assignedCHWId <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'assignedCHWId must be a positive integer',
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

    // Upcoming appointments filter
    const upcomingParam = searchParams.get('upcoming');
    const upcoming = upcomingParam === 'true';

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

    // COMMUNITY_USER: Only their own appointments
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
      whereClause.motherId = user.motherId;
    } else {
      // Other roles: Apply tenant scoping
      whereClause = getTenantScopingFilter(user as ScopedUserPayload);
    }

    // Add additional filters
    if (status) {
      whereClause.status = status;
    }
    if (motherId) {
      whereClause.motherId = motherId;
    }
    if (pregnancyId) {
      whereClause.pregnancyId = pregnancyId;
    }
    if (assignedCHWId) {
      whereClause.assignedCHWId = assignedCHWId;
    }

    // Date range filter
    if (startDate || endDate) {
      whereClause.appointmentDateTime = {};
      if (startDate) {
        whereClause.appointmentDateTime.gte = startDate;
      }
      if (endDate) {
        whereClause.appointmentDateTime.lte = endDate;
      }
    }

    // Upcoming appointments: Future dates with SCHEDULED or CONFIRMED status
    if (upcoming) {
      const now = new Date();
      whereClause.AND = [
        {
          appointmentDateTime: {
            gte: now,
          },
        },
        {
          status: {
            in: ['SCHEDULED', 'CONFIRMED'],
          },
        },
      ];
    }

    // ========================================================================
    // 6. QUERY APPOINTMENTS WITH RELATIONS
    // ========================================================================
    const [appointments, totalCount] = await Promise.all([
      db.appointment.findMany({
        where: whereClause,
        select: {
          id: true,
          motherId: true,
          pregnancyId: true,
          ancVisitId: true,
          appointmentDateTime: true,
          purpose: true,
          purposeOther: true,
          status: true,
          notes: true,
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
            },
          },
          assignedCHW: {
            select: {
              id: true,
              name: true,
              role: true,
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
        orderBy: { appointmentDateTime: 'asc' },
      }),
      db.appointment.count({ where: whereClause }),
    ]);

    // ========================================================================
    // 7. CALCULATE LIKELY_MISSED STATUS (Server-side)
    // ========================================================================
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const appointmentsWithCalculatedStatus = appointments.map((appt: any) => {
      // If status is SCHEDULED and appointment is past the 24-hour threshold, mark as LIKELY_MISSED
      if (
        appt.status === 'SCHEDULED' &&
        new Date(appt.appointmentDateTime) < twentyFourHoursAgo
      ) {
        return {
          ...appt,
          status: 'LIKELY_MISSED',
        };
      }
      return appt;
    });

    // ========================================================================
    // 8. LOG AUDIT (non-blocking)
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId || user.motherId || null,
      actorRole: user.role,
      action: 'READ',
      resource: 'appointment',
      resourceId: 0,
      changesSummary: {
        filters: {
          status: status || 'all',
          motherId: motherId || 'all',
          pregnancyId: pregnancyId || 'all',
          upcoming,
          dateRange: startDate || endDate ? { start: startDate, end: endDate } : 'all',
        },
        resultCount: appointments.length,
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((error) => {
      console.error('Failed to write audit log:', error);
      // Don't fail the request over audit logging
    });

    // ========================================================================
    // 9. RETURN SUCCESS RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: appointmentsWithCalculatedStatus,
        pagination: {
          total: totalCount,
          returned: appointmentsWithCalculatedStatus.length,
          skip,
          take,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/appointments:', error);
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
 * POST /api/appointments
 * Create a new appointment
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles:
 * - DOCTOR, NURSE, MIDWIFE: Create appointments within their hospital scope
 * - HOSPITAL_ADMIN: Hospital scope
 * - DHO, ORG_ADMIN: Organization/district scope
 * - SYSTEM_ADMIN: Unrestricted access
 *
 * Request body:
 * {
 *   "motherId": 42,
 *   "pregnancyId": 1,
 *   "ancVisitId": 15,
 *   "appointmentDateTime": "2026-04-25T10:00:00Z",
 *   "purpose": "ROUTINE",
 *   "purposeOther": null,
 *   "notes": "Routine 28-week checkup"
 * }
 *
 * Response on success (201):
 * {
 *   "success": true,
 *   "data": { ...appointment object... },
 *   "message": "Appointment created successfully"
 * }
 *
 * Response on unauthorized (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized - no token provided"
 * }
 *
 * Response on validation error (422):
 * {
 *   "success": false,
 *   "error": "motherId is required and must be a positive integer"
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
          error: 'Insufficient permissions to create appointments',
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
    // 4. PARSE AND VALIDATE REQUEST BODY
    // ========================================================================
    let body;
    try {
      body = await request.json();
    } catch (error) {
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
      pregnancyId,
      ancVisitId,
      appointmentDateTime,
      purpose,
      purposeOther,
      notes,
    } = body;

    // Validate required fields
    if (!motherId || typeof motherId !== 'number' || motherId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'motherId is required and must be a positive integer',
        },
        { status: 422 }
      );
    }

    if (!appointmentDateTime || typeof appointmentDateTime !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'appointmentDateTime is required and must be ISO 8601 format',
        },
        { status: 422 }
      );
    }

    const apptDate = new Date(appointmentDateTime);
    if (isNaN(apptDate.getTime())) {
      return NextResponse.json(
        {
          success: false,
          error: 'appointmentDateTime must be valid ISO 8601 date',
        },
        { status: 422 }
      );
    }

    if (!purpose || typeof purpose !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'purpose is required',
        },
        { status: 422 }
      );
    }

    const validPurposes = ['ROUTINE', 'SCANNING', 'REVIEW', 'OTHER'];
    if (!validPurposes.includes(purpose)) {
      return NextResponse.json(
        {
          success: false,
          error: `purpose must be one of: ${validPurposes.join(', ')}`,
        },
        { status: 422 }
      );
    }

    if (purpose === 'OTHER' && !purposeOther) {
      return NextResponse.json(
        {
          success: false,
          error: 'purposeOther is required when purpose is OTHER',
        },
        { status: 422 }
      );
    }

    // Optional field validations
    if (pregnancyId && (typeof pregnancyId !== 'number' || pregnancyId <= 0)) {
      return NextResponse.json(
        {
          success: false,
          error: 'pregnancyId must be a positive integer',
        },
        { status: 422 }
      );
    }

    if (ancVisitId && (typeof ancVisitId !== 'number' || ancVisitId <= 0)) {
      return NextResponse.json(
        {
          success: false,
          error: 'ancVisitId must be a positive integer',
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 5. VERIFY MOTHER EXISTS AND WITHIN TENANT SCOPE
    // ========================================================================
    const scopeFilter = getTenantScopingFilter(user as ScopedUserPayload);
    const mother = await db.mother.findFirst({
      where: {
        id: motherId,
        ...scopeFilter,
        deletedAt: null,
      },
      select: {
        id: true,
        facilityId: true,
        districtId: true,
      },
    });

    if (!mother) {
      return NextResponse.json(
        {
          success: false,
          error: 'Mother not found or outside your scope',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 6. VERIFY PREGNANCY IF PROVIDED
    // ========================================================================
    if (pregnancyId) {
      const pregnancy = await db.pregnancy.findFirst({
        where: {
          id: pregnancyId,
          motherId,
          ...scopeFilter,
        },
        select: { id: true },
      });

      if (!pregnancy) {
        return NextResponse.json(
          {
            success: false,
            error: 'Pregnancy not found or not linked to this mother',
          },
          { status: 404 }
        );
      }
    }

    // ========================================================================
    // 7. VERIFY ANC VISIT IF PROVIDED
    // ========================================================================
    if (ancVisitId) {
      const ancVisit = await db.ancVisit.findFirst({
        where: {
          id: ancVisitId,
          motherId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!ancVisit) {
        return NextResponse.json(
          {
            success: false,
            error: 'ANC visit not found or not linked to this mother',
          },
          { status: 404 }
        );
      }
    }

    // ========================================================================
    // 8. AUTO-ASSIGN CHW FROM FACILITY
    // ========================================================================
    let assignedCHWId: number | null = null;
    if (mother.facilityId && mother.districtId) {
      // Find CHW in the same district
      const chw = await db.user.findFirst({
        where: {
          role: 'CHW',
          districtId: mother.districtId,
          isActive: true,
        },
        select: { id: true },
      });
      if (chw) {
        assignedCHWId = chw.id;
      }
    }

    // ========================================================================
    // 9. CREATE APPOINTMENT
    // ========================================================================
    const appointment = await db.appointment.create({
      data: {
        motherId,
        pregnancyId: pregnancyId || null,
        ancVisitId: ancVisitId || null,
        appointmentDateTime: apptDate,
        purpose,
        purposeOther: purposeOther || null,
        status: 'SCHEDULED',
        assignedCHWId,
        notes: notes || null,
        createdById: user.userId || user.motherId || 0,
      },
      select: {
        id: true,
        motherId: true,
        pregnancyId: true,
        ancVisitId: true,
        appointmentDateTime: true,
        purpose: true,
        purposeOther: true,
        status: true,
        notes: true,
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
          },
        },
        assignedCHW: {
          select: {
            id: true,
            name: true,
            role: true,
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
    });

    // ========================================================================
    // 10. LOG AUDIT (non-blocking)
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId || null,
      actorRole: user.role,
      action: 'CREATE',
      resource: 'appointment',
      resourceId: appointment.id,
      changesSummary: {
        motherId: appointment.motherId,
        pregnancyId: appointment.pregnancyId,
        ancVisitId: appointment.ancVisitId,
        appointmentDateTime: appointment.appointmentDateTime,
        purpose: appointment.purpose,
        status: appointment.status,
        assignedCHWId,
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((error) => {
      console.error('Failed to write audit log:', error);
      // Don't fail the request over audit logging
    });

    // ========================================================================
    // 11. RETURN SUCCESS RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: appointment,
        message: 'Appointment created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/appointments:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
