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
import { sendSMS, formatPhoneNumber } from '@/services/sms';

/**
 * GET /api/referrals
 * Retrieve referrals with automatic tenant scoping
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles:
 * - DOCTOR, NURSE, MIDWIFE: Own hospital scope
 * - HOSPITAL_ADMIN: Hospital scope
 * - DHO, ORG_ADMIN: District/organization scope
 * - SYSTEM_ADMIN: Unrestricted access
 *
 * Query parameters:
 * - status: Filter by referral status (PENDING|ACCEPTED|COMPLETED|DECLINED)
 * - urgency: Filter by urgency level (ROUTINE|URGENT|EMERGENCY)
 * - toFacilityId: Filter by receiving facility ID
 * - motherId: Filter by specific mother ID
 * - skip: Pagination offset (default: 0)
 * - take: Number of records to return (default: 20, max: 100)
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
          error: 'Insufficient permissions to view referrals',
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
    const validStatuses = ['PENDING', 'ACCEPTED', 'COMPLETED', 'DECLINED'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Allowed: ${validStatuses.join(', ')}`,
        },
        { status: 422 }
      );
    }

    // Urgency filter (optional)
    const urgency = searchParams.get('urgency');
    const validUrgencies = ['ROUTINE', 'URGENT', 'EMERGENCY'];
    if (urgency && !validUrgencies.includes(urgency)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid urgency. Allowed: ${validUrgencies.join(', ')}`,
        },
        { status: 422 }
      );
    }

    // Receiving facility filter (optional)
    let toFacilityId: number | undefined;
    const toFacilityIdParam = searchParams.get('toFacilityId');
    if (toFacilityIdParam) {
      toFacilityId = parseInt(toFacilityIdParam, 10);
      if (isNaN(toFacilityId) || toFacilityId <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'toFacilityId must be a positive integer',
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

    // Pagination parameters
    let skip = 0;
    let take = 20;

    const skipParam = searchParams.get('skip');
    if (skipParam) {
      skip = Math.max(0, parseInt(skipParam, 10));
      if (isNaN(skip)) skip = 0;
    }

    const takeParam = searchParams.get('take');
    if (takeParam) {
      take = Math.min(100, Math.max(1, parseInt(takeParam, 10)));
      if (isNaN(take)) take = 20;
    }

    // ========================================================================
    // 5. BUILD WHERE CLAUSE WITH TENANT SCOPING
    // ========================================================================
    const scopeFilter = getTenantScopingFilter(user as ScopedUserPayload);

    const whereClause: any = {
      ...scopeFilter,
    };

    if (status) {
      whereClause.status = status;
    }

    if (urgency) {
      whereClause.urgency = urgency;
    }

    if (toFacilityId !== undefined) {
      whereClause.toFacilityId = toFacilityId;
    }

    if (motherId !== undefined) {
      whereClause.motherId = motherId;
    }

    // ========================================================================
    // 6. FETCH REFERRALS WITH RELATIONS
    // ========================================================================
    const [referrals, total] = await Promise.all([
      db.referral.findMany({
        where: whereClause,
        include: {
          mother: {
            select: {
              id: true,
              fullName: true,
              phone: true,
            },
          },
          fromFacility: {
            select: {
              id: true,
              name: true,
            },
          },
          toFacility: {
            select: {
              id: true,
              name: true,
            },
          },
          pregnancy: {
            select: {
              id: true,
              edd: true,
              gravida: true,
              parity: true,
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
        orderBy: {
          createdAt: 'desc',
        },
      }),
      db.referral.count({
        where: whereClause,
      }),
    ]);

    // ========================================================================
    // 7. RETURN RESPONSE
    // ========================================================================
    return NextResponse.json({
      success: true,
      data: referrals,
      pagination: {
        total,
        returned: referrals.length,
        skip,
        take,
      },
    });
  } catch (error) {
    console.error('Error fetching referrals:', error);
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
 * POST /api/referrals
 * Create a new referral
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles:
 * - DOCTOR, NURSE, MIDWIFE: Create referrals within their hospital scope
 * - HOSPITAL_ADMIN: Hospital scope
 * - SYSTEM_ADMIN: Unrestricted access
 *
 * Request body (all required unless noted):
 * {
 *   "motherId": 42,
 *   "pregnancyId": 5,
 *   "toFacilityId": 3,
 *   "reason": "High blood pressure with symptoms",
 *   "notes": "Patient showing signs of preeclampsia",
 *   "urgency": "URGENT"
 * }
 *
 * Response on success (201):
 * {
 *   "success": true,
 *   "data": { ...created referral object... },
 *   "message": "Referral created successfully"
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
      'HOSPITAL_ADMIN',
      'SYSTEM_ADMIN',
    ];

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions to create referrals',
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

    const { motherId, pregnancyId, toFacilityId, reason, notes, urgency } = body;

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

    if (!pregnancyId || typeof pregnancyId !== 'number' || pregnancyId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'pregnancyId is required and must be a positive integer',
        },
        { status: 422 }
      );
    }

    if (!toFacilityId || typeof toFacilityId !== 'number' || toFacilityId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'toFacilityId is required and must be a positive integer',
        },
        { status: 422 }
      );
    }

    if (!urgency || typeof urgency !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'urgency is required',
        },
        { status: 422 }
      );
    }

    const validUrgencies = ['ROUTINE', 'URGENT', 'EMERGENCY'];
    if (!validUrgencies.includes(urgency)) {
      return NextResponse.json(
        {
          success: false,
          error: `urgency must be one of: ${validUrgencies.join(', ')}`,
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 5. GET TENANT SCOPING FILTER
    // ========================================================================
    const scopeFilter = getTenantScopingFilter(user as ScopedUserPayload);

    // ========================================================================
    // 6. VERIFY MOTHER EXISTS
    // ========================================================================
    const mother = await db.mother.findFirst({
      where: {
        id: motherId,
        ...scopeFilter,
      },
    });

    if (!mother) {
      return NextResponse.json(
        {
          success: false,
          error: 'Mother not found or access denied',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 7. VERIFY PREGNANCY EXISTS AND BELONGS TO MOTHER
    // ========================================================================
    const pregnancy = await db.pregnancy.findFirst({
      where: {
        id: pregnancyId,
        motherId: motherId,
        ...scopeFilter,
      },
    });

    if (!pregnancy) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pregnancy not found or does not belong to this mother',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 8. VERIFY RECEIVING FACILITY EXISTS
    // ========================================================================
    const toFacility = await db.facility.findUnique({
      where: { id: toFacilityId },
    });

    if (!toFacility) {
      return NextResponse.json(
        {
          success: false,
          error: 'Receiving facility not found',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 9. GET REFERRING FACILITY FROM MOTHER
    // ========================================================================
    // The mother is always associated with a facility, so we use that
    const fromFacilityId = mother.facilityId;

    // ========================================================================
    // 10. CREATE REFERRAL
    // ========================================================================
    const referral = await db.referral.create({
      data: {
        motherId,
        pregnancyId,
        fromFacilityId,
        toFacilityId,
        reason: reason || null,
        notes: notes || null,
        urgency,
        status: 'PENDING',
        createdById: user.id,
      },
      include: {
        mother: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
        fromFacility: {
          select: {
            id: true,
            name: true,
          },
        },
        toFacility: {
          select: {
            id: true,
            name: true,
          },
        },
        pregnancy: {
          select: {
            id: true,
            edd: true,
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
    // 11. SEND SMS FOR EMERGENCY URGENCY (non-blocking)
    // ========================================================================
    if (urgency === 'EMERGENCY') {
      // Fetch receiving facility with emergency contact details
      const receivingFacility = await db.facility.findUnique({
        where: { id: toFacilityId },
        select: {
          name: true,
          emergencyPhone: true,
          onCallPhone: true,
        },
      }).catch(err => {
        console.error('Failed to fetch receiving facility for SMS:', err);
        return null;
      });

      if (receivingFacility && (receivingFacility.emergencyPhone || receivingFacility.onCallPhone)) {
        const emergencyPhone = receivingFacility.emergencyPhone || receivingFacility.onCallPhone;
        const smsMessage = `EMERGENCY REFERRAL: Patient ${mother.fullName} (${mother.phone}) referred from ${referral.fromFacility.name} to ${receivingFacility.name}. Reason: ${reason || 'Not specified'}. Contact referrer at ${referral.fromFacility.name}`;

        try {
          const formattedPhone = formatPhoneNumber(emergencyPhone as string);
          sendSMS({
            to: formattedPhone,
            message: smsMessage,
            type: 'EMERGENCY_REFERRAL',
            userId: user.id,
          }).catch(err => {
            console.error('Failed to send emergency referral SMS:', err);
          });
        } catch (phoneErr) {
          console.error('Failed to format emergency phone number:', phoneErr);
        }
      }
    }

    // ========================================================================
    // 12. WRITE AUDIT LOG (non-blocking)
    // ========================================================================
    writeAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'CREATE',
      resource: 'referral',
      resourceId: referral.id,
      changesSummary: {
        motherId,
        pregnancyId,
        fromFacilityId,
        toFacilityId,
        urgency,
        status: 'PENDING',
      },
      ipAddress: extractAuditContext(request).ipAddress,
      userAgent: extractAuditContext(request).userAgent,
    }).catch((err) => {
      console.error('Failed to write audit log for referral creation:', err);
    });

    // ========================================================================
    // 13. RETURN RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: referral,
        message: 'Referral created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating referral:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
