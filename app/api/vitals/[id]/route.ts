import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractUser, getTenantScopingFilter, assertValidTenantScope } from '@/lib/rbac';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';
import { sendSMS } from '@/services/sms';

const ALLOWED_ROLES = ['NURSE', 'MIDWIFE', 'DOCTOR', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'ADMIN'];

/**
 * PATCH /api/vitals/:id
 * Update vital signs record with corrections
 * Re-evaluates high-risk status if BP is changed
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Extract and validate user authorization
    let user;
    try {
      user = extractUser(request);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check role permission
    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: insufficient permissions' },
        { status: 403 }
      );
    }

    // Validate tenant scope
    try {
      assertValidTenantScope(user as any);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: invalid tenant scope' },
        { status: 403 }
      );
    }

    const resolvedParams = await params;
    const vitalsId = parseInt(resolvedParams.id, 10);

    if (isNaN(vitalsId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid vital record ID' },
        { status: 400 }
      );
    }

    // Fetch existing vital record
    const existingVitals = await db.vitals.findUnique({
      where: { id: vitalsId },
      include: {
        ancVisit: true,
      },
    });

    if (!existingVitals) {
      return NextResponse.json(
        { success: false, error: 'Vital record not found' },
        { status: 404 }
      );
    }

    // Fetch pregnancy and check if it belongs to user's scope
    const tenantFilter = getTenantScopingFilter(user as any);
    const pregnancy = await db.pregnancy.findUnique({
      where: { id: existingVitals.pregnancyId },
      include: {
        mother: {
          include: { facility: { select: { onCallPhone: true } } },
        },
      },
    });

    if (!pregnancy) {
      return NextResponse.json(
        { success: false, error: 'Pregnancy record not found' },
        { status: 404 }
      );
    }

    const isInScope = await db.pregnancy.findUnique({
      where: {
        id: pregnancy.id,
        AND: tenantFilter,
      },
    });

    if (!isInScope) {
      return NextResponse.json(
        { success: false, error: 'Vital record not found in your scope' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      systolicBP,
      diastolicBP,
      bpNotTaken,
      temperatureC,
      weightKg,
      pulseBpm,
      respRate,
      oxygenSatPct,
    } = body;

    // Track what changed for audit log
    const changesSummary: any = {};
    const updateData: any = {};

    // Validate and prepare BP updates
    if (bpNotTaken !== undefined) {
      let finalSystolicBP = existingVitals.systolicBP;
      let finalDiastolicBP = existingVitals.diastolicBP;

      if (bpNotTaken === true) {
        // Nullify BP if not taken
        finalSystolicBP = null;
        finalDiastolicBP = null;
      } else if (bpNotTaken === false) {
        // BP is expected
        if (systolicBP === undefined || systolicBP === null || diastolicBP === undefined || diastolicBP === null) {
          return NextResponse.json(
            { success: false, error: 'systolicBP and diastolicBP are required when bpNotTaken is false' },
            { status: 422 }
          );
        }

        // Validate BP values are numeric
        const sysBP = Number(systolicBP);
        const diagBP = Number(diastolicBP);

        if (isNaN(sysBP) || isNaN(diagBP)) {
          return NextResponse.json(
            { success: false, error: 'systolicBP and diastolicBP must be numeric' },
            { status: 422 }
          );
        }

        // Validate BP range (40-300)
        if (sysBP < 40 || sysBP > 300 || diagBP < 40 || diagBP > 300) {
          return NextResponse.json(
            { success: false, error: 'Blood pressure must be between 40 and 300 mmHg' },
            { status: 422 }
          );
        }

        finalSystolicBP = sysBP;
        finalDiastolicBP = diagBP;
      }

      if (finalSystolicBP !== existingVitals.systolicBP) {
        updateData.systolicBP = finalSystolicBP;
        changesSummary.systolicBP = { from: existingVitals.systolicBP, to: finalSystolicBP };
      }

      if (finalDiastolicBP !== existingVitals.diastolicBP) {
        updateData.diastolicBP = finalDiastolicBP;
        changesSummary.diastolicBP = { from: existingVitals.diastolicBP, to: finalDiastolicBP };
      }
    } else if (systolicBP !== undefined || diastolicBP !== undefined) {
      // Partial BP update
      if ((systolicBP !== undefined && systolicBP !== null) || (diastolicBP !== undefined && diastolicBP !== null)) {
        const sysBP = systolicBP !== undefined ? Number(systolicBP) : existingVitals.systolicBP;
        const diagBP = diastolicBP !== undefined ? Number(diastolicBP) : existingVitals.diastolicBP;

        if ((systolicBP !== undefined && sysBP !== null && isNaN(sysBP)) || (diastolicBP !== undefined && diagBP !== null && isNaN(diagBP))) {
          return NextResponse.json(
            { success: false, error: 'systolicBP and diastolicBP must be numeric' },
            { status: 422 }
          );
        }

        if (
          (systolicBP !== undefined && sysBP !== null && (sysBP < 40 || sysBP > 300)) ||
          (diastolicBP !== undefined && diagBP !== null && (diagBP < 40 || diagBP > 300))
        ) {
          return NextResponse.json(
            { success: false, error: 'Blood pressure must be between 40 and 300 mmHg' },
            { status: 422 }
          );
        }

        if (systolicBP !== undefined && sysBP !== existingVitals.systolicBP) {
          updateData.systolicBP = sysBP;
          changesSummary.systolicBP = { from: existingVitals.systolicBP, to: sysBP };
        }

        if (diastolicBP !== undefined && diagBP !== existingVitals.diastolicBP) {
          updateData.diastolicBP = diagBP;
          changesSummary.diastolicBP = { from: existingVitals.diastolicBP, to: diagBP };
        }
      }
    }

    // Validate and prepare optional numeric field updates
    const validateAndUpdate = (value: any, fieldName: string, existingValue: any) => {
      if (value === undefined || value === null) return;

      const num = Number(value);
      if (isNaN(num)) {
        throw new Error(`${fieldName} must be numeric`);
      }

      if (num !== existingValue) {
        updateData[fieldName] = num;
        changesSummary[fieldName] = { from: existingValue, to: num };
      }
    };

    try {
      if (temperatureC !== undefined) validateAndUpdate(temperatureC, 'temperatureC', existingVitals.temperatureC);
      if (weightKg !== undefined) validateAndUpdate(weightKg, 'weightKg', existingVitals.weightKg);
      if (pulseBpm !== undefined) validateAndUpdate(pulseBpm, 'pulseBpm', existingVitals.pulseBpm);
      if (respRate !== undefined) validateAndUpdate(respRate, 'respRate', existingVitals.respRate);
      if (oxygenSatPct !== undefined) validateAndUpdate(oxygenSatPct, 'oxygenSatPct', existingVitals.oxygenSatPct);
    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 422 }
      );
    }

    // If no changes, return existing vitals
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          success: true,
          data: existingVitals,
          message: 'No changes made',
        },
        { status: 200 }
      );
    }

    // Update vital record
    const updatedVitals = await db.vitals.update({
      where: { id: vitalsId },
      data: updateData,
      include: {
        ancVisit: true,
        createdBy: { select: { id: true, name: true } },
      },
    });

    // Re-evaluate high-risk status if BP changed
    if (updateData.systolicBP !== undefined || updateData.diastolicBP !== undefined) {
      const newSystolic = updateData.systolicBP ?? existingVitals.systolicBP;
      const newDiastolic = updateData.diastolicBP ?? existingVitals.diastolicBP;

      // Check if new BP is high-risk
      const isHighRiskBP = newSystolic !== null && newDiastolic !== null && (newSystolic >= 140 || newDiastolic >= 90);

      if (isHighRiskBP && !pregnancy.isHighRisk) {
        // Transition to high-risk
        await db.pregnancy.update({
          where: { id: pregnancy.id },
          data: { isHighRisk: true },
        });

        // Create HIGH_RISK_BP alert
        const alert = await db.alert.create({
          data: {
            type: 'HIGH_RISK_BP',
            status: 'OPEN',
            motherId: pregnancy.motherId,
            pregnancyId: pregnancy.id,
            ancVisitId: existingVitals.ancVisitId || undefined,
            initiatedById: user.userId,
            metadata: JSON.stringify({
              bpSystolic: newSystolic,
              bpDiastolic: newDiastolic,
              recordedAt: new Date().toISOString(),
              correctionNote: 'High BP detected during vital correction',
            }),
          },
        });

        changesSummary.highRiskAlert = {
          created: true,
          alertId: alert.id,
          reason: 'BP corrected to high-risk threshold',
        };

        // Send SMS to facility on-call (non-blocking)
        if (pregnancy.mother.facility?.onCallPhone) {
          const message = `High BP recorded for ${pregnancy.mother.fullName}. Please review.`;
          sendSMS({
            to: pregnancy.mother.facility.onCallPhone,
            message,
            type: 'HIGH_RISK_ALERT',
            userId: user.userId,
          }).catch((err) => {
            console.error('Failed to send high-risk BP SMS on correction:', err);
          });
        }
      }
    }

    // Audit log with change summary
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId,
      actorRole: user.role,
      action: 'UPDATE',
      resource: 'vitals',
      resourceId: vitalsId,
      changesSummary,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((err) => {
      console.error('Audit log failed:', err);
    });

    return NextResponse.json(
      {
        success: true,
        data: updatedVitals,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('PATCH /api/vitals/:id error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
