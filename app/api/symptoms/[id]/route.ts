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
 * GET /api/symptoms/:id
 * Retrieve a single symptom record by ID.
 * 
 * Allowed roles: NURSE, MIDWIFE, DOCTOR, CHW, HOSPITAL_ADMIN, SYSTEM_ADMIN
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Step 4: Parse and validate ID parameter
    const resolvedParams = await params;
    const symptomsId = parseInt(resolvedParams.id, 10);
    if (isNaN(symptomsId) || symptomsId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid symptoms ID' },
        { status: 422 }
      );
    }

    // Step 5: Get tenant scope filter
    const scopeFilter = getTenantScopingFilter(user as any);

    // Step 6: Retrieve symptom record with scope filtering
    const symptom = await db.symptoms.findFirst({
      where: {
        id: symptomsId,
        ...scopeFilter
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      }
    });

    if (!symptom) {
      return NextResponse.json(
        { success: false, error: 'Symptom record not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: symptom
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/symptoms/:id error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/symptoms/:id
 * Update a symptom record (correction/amendment).
 * 
 * Body: Any subset of {
 *   bleeding, severeHeadache, blurredVision, swelling, fever, abdominalPain, reducedFetalMovement, other
 * }
 * 
 * Danger signs are re-checked after update. If new danger signs are detected,
 * a new alert is triggered. If danger signs are removed, the alert is left as-is.
 * 
 * Allowed roles: NURSE, MIDWIFE, DOCTOR, HOSPITAL_ADMIN, SYSTEM_ADMIN
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Step 2: Check role permissions (UPDATE permission required)
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

    // Step 4: Parse and validate ID parameter
    const resolvedParams = await params;
    const symptomsId = parseInt(resolvedParams.id, 10);
    if (isNaN(symptomsId) || symptomsId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid symptoms ID' },
        { status: 422 }
      );
    }

    // Step 5: Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // Step 6: Get tenant scope filter
    const scopeFilter = getTenantScopingFilter(user as any);

    // Step 7: Retrieve existing symptom record with scope filtering
    const existingSymptom = await db.symptoms.findFirst({
      where: {
        id: symptomsId,
        ...scopeFilter
      },
      include: {
        pregnancy: {
          select: {
            isHighRisk: true
          }
        }
      }
    });

    if (!existingSymptom) {
      return NextResponse.json(
        { success: false, error: 'Symptom record not found or access denied' },
        { status: 404 }
      );
    }

    // Step 8: Build update data from request body
    const updateData: any = {};
    const oldValues: any = {
      bleeding: existingSymptom.bleeding,
      severeHeadache: existingSymptom.severeHeadache,
      blurredVision: existingSymptom.blurredVision,
      swelling: existingSymptom.swelling,
      fever: existingSymptom.fever,
      abdominalPain: existingSymptom.abdominalPain,
      reducedFetalMovement: existingSymptom.reducedFetalMovement,
      other: existingSymptom.other
    };

    const allowedFields = [
      'bleeding',
      'severeHeadache',
      'blurredVision',
      'swelling',
      'fever',
      'abdominalPain',
      'reducedFetalMovement',
      'other'
    ];

    for (const field of allowedFields) {
      if (field in body) {
        if (field === 'other') {
          if (body[field] !== null && body[field] !== undefined) {
            if (typeof body[field] !== 'string') {
              return NextResponse.json(
                { success: false, error: 'other must be a string' },
                { status: 422 }
              );
            }
            updateData[field] = body[field].substring(0, 500);
          } else {
            updateData[field] = null;
          }
        } else {
          // Boolean field
          updateData[field] = Boolean(body[field]);
        }
      }
    }

    // Step 9: Update symptom record
    const updatedSymptom = await db.symptoms.update({
      where: { id: symptomsId },
      data: updateData,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      }
    });

    // Step 10: Re-check danger signs with updated values
    const oldDangerSigns: string[] = [];
    if (oldValues.bleeding) oldDangerSigns.push('Bleeding');
    if (oldValues.severeHeadache) oldDangerSigns.push('Severe Headache');
    if (oldValues.blurredVision) oldDangerSigns.push('Blurred Vision');
    if (oldValues.reducedFetalMovement) oldDangerSigns.push('Reduced Fetal Movement');

    const newDangerSigns: string[] = [];
    if (updatedSymptom.bleeding) newDangerSigns.push('Bleeding');
    if (updatedSymptom.severeHeadache) newDangerSigns.push('Severe Headache');
    if (updatedSymptom.blurredVision) newDangerSigns.push('Blurred Vision');
    if (updatedSymptom.reducedFetalMovement) newDangerSigns.push('Reduced Fetal Movement');

    let alertCreated = false;

    // Check if new danger signs were added
    const newlyDetected = newDangerSigns.filter((sign) => !oldDangerSigns.includes(sign));

    if (newlyDetected.length > 0) {
      // Trigger alert for newly detected signs
      try {
        const dangerSignResult = await triggerDangerSignAlert({
          motherId: updatedSymptom.motherId,
          pregnancyId: updatedSymptom.pregnancyId,
          ancVisitId: updatedSymptom.ancVisitId || 0,
          dangerSigns: newlyDetected,
          actorId: user.userId || user.id
        });

        alertCreated = !!dangerSignResult.alertId;

        // Update pregnancy to high-risk if not already
        if (!existingSymptom.pregnancy?.isHighRisk) {
          await db.pregnancy.update({
            where: { id: updatedSymptom.pregnancyId },
            data: { isHighRisk: true }
          });
        }
      } catch (error) {
        console.error('Failed to trigger danger sign alert on update:', error);
        // Don't fail the request if alert creation fails
      }
    }

    // Step 11: Audit log (non-blocking)
    const changes: any = {};
    for (const field of allowedFields) {
      if (field in updateData) {
        changes[field] = {
          oldValue: oldValues[field],
          newValue: updateData[field]
        };
      }
    }

    writeAuditLog({
      actorId: user.userId || user.id,
      actorRole: user.role,
      action: 'UPDATE',
      resource: 'symptoms',
      resourceId: symptomsId,
      changesSummary: {
        changes,
        oldDangerSigns,
        newDangerSigns,
        newlyDetectedSigns: newlyDetected,
        alertCreated
      },
      ipAddress: extractAuditContext(request).ipAddress,
      userAgent: extractAuditContext(request).userAgent
    }).catch((err) => {
      console.error('Failed to write audit log:', err);
    });

    return NextResponse.json(
      {
        success: true,
        data: updatedSymptom,
        message: 'Symptom record updated',
        metadata: {
          newlyDetectedDangerSigns: newlyDetected,
          alertCreated
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('PATCH /api/symptoms/:id error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
