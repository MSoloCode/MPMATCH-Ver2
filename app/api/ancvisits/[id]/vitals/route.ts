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
 * PATCH /api/ancvisits/[id]/vitals
 * Create or update vitals for an ANC visit
 * PROTECTED - Requires valid JWT token
 *
 * Path parameters:
 * - id: ANC visit ID (positive integer)
 *
 * Request body:
 * {
 *   "systolicBP": 120,
 *   "diastolicBP": 80,
 *   "bpNotTaken": false,
 *   "temperatureC": 36.8,
 *   "weightKg": 62,
 *   "pulseBpm": 76,
 *   "respRate": 18,
 *   "oxygenSatPct": 98
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": { vitals object }
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

    const { systolicBP, diastolicBP, bpNotTaken, temperatureC, weightKg, pulseBpm, respRate, oxygenSatPct } = body;

    // Validate BP requirement
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

    // Validate optional fields
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

    // Get tenant scoping filter
    const scopeFilter = getTenantScopingFilter(user as ScopedUserPayload);

    // Fetch visit to verify it exists and get pregnancy/mother details
    const visit = await db.ancVisit.findFirst({
      where: {
        id: visitId,
        deletedAt: null,
        pregnancy: {
          ...scopeFilter,
        },
      },
      select: {
        id: true,
        pregnancyId: true,
        motherId: true,
      },
    });

    if (!visit) {
      return NextResponse.json(
        {
          success: false,
          error: 'ANC visit not found',
        },
        { status: 404 }
      );
    }

    // Check if vitals already exist for this visit
    const existingVitals = await db.vitals.findFirst({
      where: {
        ancVisitId: visitId,
      },
    });

    let updatedVitals;
    if (existingVitals) {
      // Update existing vitals
      updatedVitals = await db.vitals.update({
        where: {
          id: existingVitals.id,
        },
        data: {
          systolicBP: bpNotTaken ? null : systolicBP,
          diastolicBP: bpNotTaken ? null : diastolicBP,
          bpNotTaken: !!bpNotTaken,
          temperatureC: temperatureC || null,
          weightKg: weightKg || null,
          pulseBpm: pulseBpm || null,
          respRate: respRate || null,
          oxygenSatPct: oxygenSatPct || null,
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
          updatedAt: true,
        },
      });
    } else {
      // Create new vitals if they don't exist
      updatedVitals = await db.vitals.create({
        data: {
          ancVisitId: visitId,
          pregnancyId: visit.pregnancyId,
          motherId: visit.motherId,
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
          updatedAt: true,
        },
      });
    }

    // Log audit (non-blocking)
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId || null,
      actorRole: user.role,
      action: existingVitals ? 'UPDATE' : 'CREATE',
      resource: 'vitals',
      resourceId: updatedVitals.id,
      changesSummary: {
        ancVisitId: visitId,
        systolicBP,
        diastolicBP,
        bpNotTaken,
        temperatureC,
        weightKg,
        pulseBpm,
        respRate,
        oxygenSatPct,
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((error) => {
      console.error('Failed to write audit log:', error);
    });

    return NextResponse.json({
      success: true,
      data: updatedVitals,
    });
  } catch (error) {
    console.error('Error in PATCH /api/ancvisits/[id]/vitals:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
