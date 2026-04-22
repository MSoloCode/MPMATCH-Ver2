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
 * PATCH /api/ancvisits/[id]/symptoms
 * Create or update symptoms for an ANC visit
 * PROTECTED - Requires valid JWT token
 *
 * Path parameters:
 * - id: ANC visit ID (positive integer)
 *
 * Request body:
 * {
 *   "bleeding": false,
 *   "severeHeadache": false,
 *   "blurredVision": false,
 *   "swelling": false,
 *   "fever": false,
 *   "abdominalPain": false,
 *   "reducedFetalMovement": false,
 *   "other": "Optional notes about other symptoms"
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": { symptoms object with id, ancVisitId, pregnancyId, motherId, ... }
 * }
 *
 * Response on error (400/422/401/403/500):
 * {
 *   "success": false,
 *   "error": "Error message"
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Extract ID from params
    const resolvedParams = await params;
    const visitId = parseInt(resolvedParams.id, 10);

    if (isNaN(visitId) || visitId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid visit ID',
        },
        { status: 422 }
      );
    }

    // Extract and validate auth
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

    // Check role permissions
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
          error: 'Insufficient permissions',
        },
        { status: 403 }
      );
    }

    // Validate tenant scope
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

    // Parse request body
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
      bleeding,
      severeHeadache,
      blurredVision,
      swelling,
      fever,
      abdominalPain,
      reducedFetalMovement,
      other,
    } = body;

    // Validate symptom fields are booleans (except 'other' which is optional string)
    const symptomFields = [
      'bleeding',
      'severeHeadache',
      'blurredVision',
      'swelling',
      'fever',
      'abdominalPain',
      'reducedFetalMovement',
    ];

    for (const field of symptomFields) {
      const value = body[field];
      if (value !== undefined && typeof value !== 'boolean') {
        return NextResponse.json(
          {
            success: false,
            error: `${field} must be a boolean`,
          },
          { status: 422 }
        );
      }
    }

    if (other !== undefined && typeof other !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'other must be a string',
        },
        { status: 422 }
      );
    }

    // Fetch the ANC visit to get pregnancyId and motherId and validate it exists
    const ancVisit = await db.ancVisit.findUnique({
      where: { id: visitId },
      select: {
        id: true,
        pregnancyId: true,
        pregnancy: {
          select: {
            motherId: true,
          },
        },
      },
    });

    if (!ancVisit) {
      return NextResponse.json(
        {
          success: false,
          error: 'ANC visit not found',
        },
        { status: 404 }
      );
    }

    const pregnancyId = ancVisit.pregnancyId;
    const motherId = ancVisit.pregnancy.motherId;

    // Get tenant scoping filter to ensure user can access this pregnancy
    const tenantFilter = getTenantScopingFilter(user as ScopedUserPayload);
    const pregnancy = await db.pregnancy.findUnique({
      where: { id: pregnancyId },
      select: { id: true, ...tenantFilter }, // Validate tenant scope
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

    // Check if symptoms already exist for this visit
    const existingSymptoms = await db.symptoms.findFirst({
      where: { ancVisitId: visitId },
    });

    let symptoms;

    if (existingSymptoms) {
      // Update existing symptoms
      symptoms = await db.symptoms.update({
        where: { id: existingSymptoms.id },
        data: {
          bleeding: bleeding ?? existingSymptoms.bleeding,
          severeHeadache: severeHeadache ?? existingSymptoms.severeHeadache,
          blurredVision: blurredVision ?? existingSymptoms.blurredVision,
          swelling: swelling ?? existingSymptoms.swelling,
          fever: fever ?? existingSymptoms.fever,
          abdominalPain: abdominalPain ?? existingSymptoms.abdominalPain,
          reducedFetalMovement:
            reducedFetalMovement ?? existingSymptoms.reducedFetalMovement,
          other: other ?? existingSymptoms.other,
        },
      });
    } else {
      // Create new symptoms record
      symptoms = await db.symptoms.create({
        data: {
          ancVisitId: visitId,
          pregnancyId,
          motherId,
          createdById: user.id,
          bleeding: bleeding ?? false,
          severeHeadache: severeHeadache ?? false,
          blurredVision: blurredVision ?? false,
          swelling: swelling ?? false,
          fever: fever ?? false,
          abdominalPain: abdominalPain ?? false,
          reducedFetalMovement: reducedFetalMovement ?? false,
          other: other ?? null,
        },
      });
    }

    // Write audit log
    const auditContext = extractAuditContext(request);
    await writeAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: existingSymptoms ? 'UPDATE' : 'CREATE',
      resource: 'symptoms',
      resourceId: symptoms.id,
      changesSummary: {
        bleeding,
        severeHeadache,
        blurredVision,
        swelling,
        fever,
        abdominalPain,
        reducedFetalMovement,
        other,
      },
      ...auditContext,
    });

    return NextResponse.json(
      {
        success: true,
        data: symptoms,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in PATCH /api/ancvisits/[id]/symptoms:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
