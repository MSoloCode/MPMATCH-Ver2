import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  extractUser,
  assertValidTenantScope,
  getTenantScopingFilter,
  UnauthorizedError,
  ForbiddenError
} from '@/lib/rbac';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';
import { triggerDangerSignAlert } from '@/services/danger-sign';

/**
 * POST /api/symptoms
 * Create a new symptom record and trigger danger sign escalation if needed.
 * 
 * Allowed roles: NURSE, MIDWIFE, DOCTOR, HOSPITAL_ADMIN, SYSTEM_ADMIN
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Extract and validate user
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

    // Step 2: Check role permissions
    const allowedRoles = ['NURSE', 'MIDWIFE', 'DOCTOR', 'HOSPITAL_ADMIN', 'SYSTEM_ADMIN'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Step 3: Validate tenant scope
    try {
      assertValidTenantScope(user as any);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 403 }
        );
      }
      throw error;
    }

    // Step 4: Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const {
      ancVisitId,
      pregnancyId,
      bleeding = false,
      severeHeadache = false,
      blurredVision = false,
      swelling = false,
      fever = false,
      abdominalPain = false,
      reducedFetalMovement = false,
      other
    } = body;

    // Validate required fields
    if (!pregnancyId || typeof pregnancyId !== 'number' || pregnancyId <= 0) {
      return NextResponse.json(
        { success: false, error: 'pregnancyId is required and must be a positive integer' },
        { status: 422 }
      );
    }

    if (ancVisitId !== undefined && (typeof ancVisitId !== 'number' || ancVisitId <= 0)) {
      return NextResponse.json(
        { success: false, error: 'ancVisitId must be a positive integer' },
        { status: 422 }
      );
    }

    // Validate symptom fields are booleans
    const symptoms = {
      bleeding: Boolean(bleeding),
      severeHeadache: Boolean(severeHeadache),
      blurredVision: Boolean(blurredVision),
      swelling: Boolean(swelling),
      fever: Boolean(fever),
      abdominalPain: Boolean(abdominalPain),
      reducedFetalMovement: Boolean(reducedFetalMovement)
    };

    // Validate other field if provided
    let otherText = null;
    if (other !== undefined && other !== null) {
      if (typeof other !== 'string') {
        return NextResponse.json(
          { success: false, error: 'other must be a string' },
          { status: 422 }
        );
      }
      otherText = other.substring(0, 500);
    }

    // Step 5: Get tenant scope filter
    const scopeFilter = getTenantScopingFilter(user as any);

    // Step 6: Verify pregnancy exists and is in scope
    const pregnancy = await db.pregnancy.findFirst({
      where: {
        id: pregnancyId,
        ...scopeFilter
      },
      select: {
        id: true,
        motherId: true,
        isHighRisk: true
      }
    });

    if (!pregnancy) {
      return NextResponse.json(
        { success: false, error: 'Pregnancy not found or access denied' },
        { status: 404 }
      );
    }

    // Step 7: Verify ancVisit exists (if provided) and is in scope
    if (ancVisitId) {
      const ancVisit = await db.ancVisit.findFirst({
        where: {
          id: ancVisitId,
          pregnancyId: pregnancy.id
        }
      });

      if (!ancVisit) {
        return NextResponse.json(
          { success: false, error: 'ANC visit not found or access denied' },
          { status: 404 }
        );
      }
    }

    // Step 8: Detect danger signs
    const dangerSignsDetected: string[] = [];
    if (symptoms.bleeding) dangerSignsDetected.push('Bleeding');
    if (symptoms.severeHeadache) dangerSignsDetected.push('Severe Headache');
    if (symptoms.blurredVision) dangerSignsDetected.push('Blurred Vision');
    if (symptoms.reducedFetalMovement) dangerSignsDetected.push('Reduced Fetal Movement');

    let alertCreated = false;

    // Step 9: Create symptoms record
    const symptom = await db.symptoms.create({
      data: {
        pregnancyId: pregnancy.id,
        motherId: pregnancy.motherId,
        ancVisitId: ancVisitId || null,
        bleeding: symptoms.bleeding,
        severeHeadache: symptoms.severeHeadache,
        blurredVision: symptoms.blurredVision,
        swelling: symptoms.swelling,
        fever: symptoms.fever,
        abdominalPain: symptoms.abdominalPain,
        reducedFetalMovement: symptoms.reducedFetalMovement,
        other: otherText,
        createdById: user.userId || user.id
      }
    });

    // Step 10: Handle danger sign escalation
    if (dangerSignsDetected.length > 0) {
      // Update pregnancy to high-risk
      await db.pregnancy.update({
        where: { id: pregnancy.id },
        data: { isHighRisk: true }
      });

      // Trigger danger sign alert
      try {
        const dangerSignResult = await triggerDangerSignAlert({
          motherId: pregnancy.motherId,
          pregnancyId: pregnancy.id,
          ancVisitId: ancVisitId || 0, // ancVisitId might be null, use 0 as fallback
          dangerSigns: dangerSignsDetected,
          actorId: user.userId || user.id
        });

        alertCreated = !!dangerSignResult.alertId;
      } catch (error) {
        console.error('Failed to trigger danger sign alert:', error);
        // Don't fail the request if alert creation fails
      }
    }

    // Step 11: Audit log (non-blocking)
    writeAuditLog({
      actorId: user.userId || user.id,
      actorRole: user.role,
      action: 'CREATE',
      resource: 'symptoms',
      resourceId: symptom.id,
      changesSummary: {
        pregnancyId: pregnancy.id,
        motherId: pregnancy.motherId,
        ancVisitId: ancVisitId || null,
        ...symptoms,
        dangerSignsDetected
      },
      ipAddress: extractAuditContext(request).ipAddress,
      userAgent: extractAuditContext(request).userAgent
    }).catch((err) => {
      console.error('Failed to write audit log:', err);
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          symptomsId: symptom.id,
          dangerSignsDetected,
          alertCreated
        },
        message: 'Symptoms recorded'
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/symptoms error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/symptoms
 * List symptoms with pagination and filters.
 * 
 * Query params:
 *   - ancVisitId: Filter by ANC visit ID (one of ancVisitId or pregnancyId required)
 *   - pregnancyId: Filter by pregnancy ID (one of ancVisitId or pregnancyId required)
 *   - skip: Number of records to skip (default: 0)
 *   - take: Number of records to return (default: 20, max: 100)
 * 
 * Allowed roles: NURSE, MIDWIFE, DOCTOR, CHW, HOSPITAL_ADMIN, SYSTEM_ADMIN
 */
export async function GET(request: NextRequest) {
  try {
    // Step 1: Extract and validate user
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

    // Step 2: Check role permissions
    const allowedRoles = ['NURSE', 'MIDWIFE', 'DOCTOR', 'CHW', 'HOSPITAL_ADMIN', 'SYSTEM_ADMIN'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Step 3: Validate tenant scope
    try {
      assertValidTenantScope(user as any);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 403 }
        );
      }
      throw error;
    }

    // Step 4: Parse and validate query parameters
    const { searchParams } = new URL(request.url);

    const ancVisitIdParam = searchParams.get('ancVisitId');
    const pregnancyIdParam = searchParams.get('pregnancyId');

    let ancVisitId: number | undefined;
    let pregnancyId: number | undefined;

    if (ancVisitIdParam) {
      ancVisitId = parseInt(ancVisitIdParam, 10);
      if (isNaN(ancVisitId) || ancVisitId <= 0) {
        return NextResponse.json(
          { success: false, error: 'ancVisitId must be a positive integer' },
          { status: 422 }
        );
      }
    }

    if (pregnancyIdParam) {
      pregnancyId = parseInt(pregnancyIdParam, 10);
      if (isNaN(pregnancyId) || pregnancyId <= 0) {
        return NextResponse.json(
          { success: false, error: 'pregnancyId must be a positive integer' },
          { status: 422 }
        );
      }
    }

    // One of ancVisitId or pregnancyId must be provided
    if (!ancVisitId && !pregnancyId) {
      return NextResponse.json(
        { success: false, error: 'One of ancVisitId or pregnancyId must be provided' },
        { status: 422 }
      );
    }

    // Parse pagination parameters
    let skip = 0;
    const skipParam = searchParams.get('skip');
    if (skipParam) {
      skip = Math.max(0, parseInt(skipParam, 10));
      if (isNaN(skip)) skip = 0;
    }

    let take = 20;
    const takeParam = searchParams.get('take');
    if (takeParam) {
      take = Math.min(100, Math.max(1, parseInt(takeParam, 10)));
      if (isNaN(take)) take = 20;
    }

    // Step 5: Get tenant scope filter
    const scopeFilter = getTenantScopingFilter(user as any);

    // Step 6: Build where clause
    const where: any = {
      ...scopeFilter
    };

    if (ancVisitId) {
      where.ancVisitId = ancVisitId;
    }

    if (pregnancyId) {
      where.pregnancyId = pregnancyId;
    }

    // Step 7: Execute queries in parallel
    const [symptoms, total] = await Promise.all([
      db.symptoms.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              role: true
            }
          }
        }
      }),
      db.symptoms.count({ where })
    ]);

    return NextResponse.json(
      {
        success: true,
        data: symptoms,
        pagination: {
          total,
          returned: symptoms.length,
          skip,
          take
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/symptoms error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
