import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  extractUser,
  getTenantScopingFilter,
  assertValidTenantScope,
  ScopedUserPayload,
} from '@/lib/rbac';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';
import { sendSMS, formatPhoneNumber } from '@/services/sms';

const ALLOWED_ROLES_POST = ['NURSE', 'MIDWIFE', 'DOCTOR', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN'];
const ALLOWED_ROLES_GET = ['NURSE', 'MIDWIFE', 'DOCTOR', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'ADMIN'];

/**
 * POST /api/vitals
 * Create a new vital signs record for an ANC visit
 * Detects high-risk BP and triggers alert + SMS notification
 */
export async function POST(request: NextRequest) {
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
    if (!ALLOWED_ROLES_POST.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: insufficient permissions' },
        { status: 403 }
      );
    }

    // Validate tenant scope
    try {
      assertValidTenantScope(user as ScopedUserPayload);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: invalid tenant scope' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      ancVisitId,
      systolicBP,
      diastolicBP,
      bpNotTaken,
      temperatureC,
      weightKg,
      pulseBpm,
      respRate,
      oxygenSatPct,
    } = body;

    // Validate ancVisitId is provided
    if (!ancVisitId) {
      return NextResponse.json(
        { success: false, error: 'ancVisitId is required' },
        { status: 422 }
      );
    }

    // Fetch ANC visit and validate it exists and belongs to pregnancy in user's scope
    const ancVisit = await db.ancVisit.findUnique({
      where: { id: ancVisitId },
      include: {
        pregnancy: {
          include: { mother: true },
        },
      },
    });

    if (!ancVisit) {
      return NextResponse.json(
        { success: false, error: 'ANC visit not found' },
        { status: 404 }
      );
    }

    // Check if pregnancy belongs to user's scope
    const tenantFilter = getTenantScopingFilter(user as any);
    const isInScope = await db.pregnancy.findUnique({
      where: {
        id: ancVisit.pregnancy.id,
        AND: tenantFilter,
      },
    });

    if (!isInScope) {
      return NextResponse.json(
        { success: false, error: 'Pregnancy not found in your scope' },
        { status: 403 }
      );
    }

    // Validate pregnancy is ACTIVE
    if (ancVisit.pregnancy.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Cannot record vitals for non-active pregnancy' },
        { status: 422 }
      );
    }

    // Validate BP measurements
    let finalSystolicBP = null;
    let finalDiastolicBP = null;

    if (bpNotTaken === true) {
      // Nullify BP if not taken
      finalSystolicBP = null;
      finalDiastolicBP = null;
    } else if (bpNotTaken === false || bpNotTaken === undefined) {
      // If bpNotTaken is false or not specified, BP is expected
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

    // Validate optional numeric fields
    const validateOptionalNumeric = (value: any, fieldName: string) => {
      if (value === undefined || value === null) return null;
      const num = Number(value);
      if (isNaN(num)) {
        throw new Error(`${fieldName} must be numeric`);
      }
      return num;
    };

    try {
      var temp = validateOptionalNumeric(temperatureC, 'temperatureC');
      var weight = validateOptionalNumeric(weightKg, 'weightKg');
      var pulse = validateOptionalNumeric(pulseBpm, 'pulseBpm');
      var respiration = validateOptionalNumeric(respRate, 'respRate');
      var oxygen = validateOptionalNumeric(oxygenSatPct, 'oxygenSatPct');
    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 422 }
      );
    }

    // Create vitals record
    const vitals = await db.vitals.create({
      data: {
        ancVisitId,
        pregnancyId: ancVisit.pregnancy.id,
        motherId: ancVisit.pregnancy.motherId,
        systolicBP: finalSystolicBP,
        diastolicBP: finalDiastolicBP,
        temperatureC: temp,
        weightKg: weight,
        pulseBpm: pulse,
        respRate: respiration,
        oxygenSatPct: oxygen,
        createdById: user.userId,
      },
    });

    // Detect high-risk BP and trigger alert + SMS
    let highRiskFlagged = false;

    if (finalSystolicBP !== null && finalDiastolicBP !== null) {
      if (finalSystolicBP >= 140 || finalDiastolicBP >= 90) {
        // Only flag if pregnancy not already high-risk
        if (!ancVisit.pregnancy.isHighRisk) {
          // Update pregnancy to high-risk
          await db.pregnancy.update({
            where: { id: ancVisit.pregnancy.id },
            data: { isHighRisk: true },
          });

          // Determine SMS recipient (facility on-call contact)
          let recipientPhone: string | null = null;

          const facility = await db.facility.findUnique({
            where: { id: ancVisit.pregnancy.mother.facilityId },
            select: { onCallPhone: true },
          });
          if (facility?.onCallPhone) {
            recipientPhone = facility.onCallPhone;
          }

          // Create HIGH_RISK_BP alert
          const alert = await db.alert.create({
            data: {
              type: 'HIGH_RISK_BP',
              status: 'OPEN',
              motherId: ancVisit.pregnancy.motherId,
              pregnancyId: ancVisit.pregnancy.id,
              ancVisitId,
              initiatedById: user.userId,
              metadata: JSON.stringify({
                bpSystolic: finalSystolicBP,
                bpDiastolic: finalDiastolicBP,
                recordedAt: new Date().toISOString(),
              }),
            },
          });

          // Send SMS to assigned midwife (non-blocking)
          if (recipientPhone) {
            const mother = await db.mother.findUnique({
              where: { id: ancVisit.pregnancy.motherId },
              select: { fullName: true },
            });

            const message = `High BP recorded for ${mother?.fullName || 'Mother'}. Please review.`;

            sendSMS({
              to: recipientPhone,
              message,
              type: 'HIGH_RISK_ALERT',
              userId: user.userId,
            }).catch((err) => {
              // Log error but don't block response
              console.error('Failed to send high-risk BP SMS:', err);
            });
          }

          highRiskFlagged = true;
        }
      }
    }

    // Audit log
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId,
      actorRole: user.role,
      action: 'CREATE',
      resource: 'vitals',
      resourceId: vitals.id,
      changesSummary: {
        ancVisitId,
        systolicBP: finalSystolicBP,
        diastolicBP: finalDiastolicBP,
        temperatureC: temp,
        weightKg: weight,
        pulseBpm: pulse,
        respRate: respiration,
        oxygenSatPct: oxygen,
        bpNotTaken,
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((err) => {
      // Log audit errors but don't block response
      console.error('Audit log failed:', err);
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          vitalsId: vitals.id,
          highRiskFlagged,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/vitals error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/vitals
 * Query vitals by ancVisitId or pregnancyId
 * ?ancVisitId=X — vitals for a specific visit
 * ?pregnancyId=X — all vitals across a pregnancy (for timeline chart)
 */
export async function GET(request: NextRequest) {
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
    if (!ALLOWED_ROLES_GET.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: insufficient permissions' },
        { status: 403 }
      );
    }

    // Validate tenant scope
    try {
      assertValidTenantScope(user as ScopedUserPayload);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: invalid tenant scope' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const ancVisitId = searchParams.get('ancVisitId');
    const pregnancyId = searchParams.get('pregnancyId');
    const skip = parseInt(searchParams.get('skip') || '0', 10);
    const take = Math.min(parseInt(searchParams.get('take') || '20', 10), 100);

    // Validate that at least one query parameter is provided
    if (!ancVisitId && !pregnancyId) {
      return NextResponse.json(
        { success: false, error: 'Either ancVisitId or pregnancyId query parameter is required' },
        { status: 422 }
      );
    }

    const tenantFilter = getTenantScopingFilter(user as any);

    // Query by ancVisitId
    if (ancVisitId && !pregnancyId) {
      // Validate ancVisitId exists and belongs to pregnancy in user's scope
      const ancVisitIdNum = parseInt(ancVisitId, 10);
      const ancVisit = await db.ancVisit.findUnique({
        where: { id: ancVisitIdNum },
        include: {
          pregnancy: true,
        },
      });

      if (!ancVisit) {
        return NextResponse.json(
          { success: false, error: 'ANC visit not found' },
          { status: 404 }
        );
      }

      // Check if pregnancy belongs to user's scope
      const isInScope = await db.pregnancy.findUnique({
        where: {
          id: ancVisit.pregnancy.id,
          AND: tenantFilter,
        },
      });

      if (!isInScope) {
        return NextResponse.json(
          { success: false, error: 'ANC visit not found in your scope' },
          { status: 403 }
        );
      }

      // Fetch vitals for this ancVisit
      const vitals = await db.vitals.findMany({
        where: {
          ancVisitId: ancVisitIdNum,
          pregnancy: {
            AND: tenantFilter,
          },
        },
        include: {
          ancVisit: true,
          pregnancy: true,
          mother: true,
          createdBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const total = vitals.length;

      // Audit log
      const auditContext = extractAuditContext(request);
      writeAuditLog({
        actorId: user.userId,
        actorRole: user.role,
        action: 'READ_SENSITIVE',
        resource: 'vitals',
        resourceId: ancVisitId ? parseInt(ancVisitId, 10) : 0,
        changesSummary: { query: 'ancVisitId', total },
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      }).catch((err) => {
        console.error('Audit log failed:', err);
      });

      return NextResponse.json(
        {
          success: true,
          data: vitals,
          pagination: {
            total,
            returned: vitals.length,
            skip: 0,
            take: vitals.length,
          },
        },
        { status: 200 }
      );
    }

    // Query by pregnancyId
    if (pregnancyId) {
      // Validate pregnancyId exists and belongs to user's scope
      const pregnancyIdNum = parseInt(pregnancyId, 10);
      const pregnancy = await db.pregnancy.findUnique({
        where: {
          id: pregnancyIdNum,
          AND: tenantFilter,
        },
      });

      if (!pregnancy) {
        return NextResponse.json(
          { success: false, error: 'Pregnancy not found in your scope' },
          { status: 403 }
        );
      }

      // Fetch vitals for this pregnancy with pagination
      const vitals = await db.vitals.findMany({
        where: {
          pregnancyId: pregnancyIdNum,
          pregnancy: {
            AND: tenantFilter,
          },
        },
        include: {
          ancVisit: true,
          createdBy: { select: { id: true, name: true, role: true } },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      });

      const total = await db.vitals.count({
        where: {
          pregnancyId: pregnancyIdNum,
          pregnancy: {
            AND: tenantFilter,
          },
        },
      });

      // Audit log
      const auditContext = extractAuditContext(request);
      writeAuditLog({
        actorId: user.userId,
        actorRole: user.role,
        action: 'READ_SENSITIVE',
        resource: 'vitals',
        resourceId: pregnancyId ? parseInt(pregnancyId, 10) : 0,
        changesSummary: { query: 'pregnancyId', total, skip, take },
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      }).catch((err) => {
        console.error('Audit log failed:', err);
      });

      return NextResponse.json(
        {
          success: true,
          data: vitals,
          pagination: {
            total,
            returned: vitals.length,
            skip,
            take,
          },
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('GET /api/vitals error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
