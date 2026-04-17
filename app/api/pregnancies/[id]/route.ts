import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  extractUser,
  getTenantScopingFilter,
  UnauthorizedError,
  ForbiddenError,
} from '@/lib/rbac';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';

/**
 * GET /api/pregnancies/[id]
 * Retrieve a specific pregnancy by ID
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles: DOCTOR, NURSE, MIDWIFE, DHO, ORG_ADMIN, HOSPITAL_ADMIN, SYSTEM_ADMIN
 *
 * URL parameters:
 * - id: Pregnancy ID (number)
 *
 * Response on success (200):
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
 *     "antenatalStatus": "ACTIVE",
 *     "status": "ACTIVE",
 *     "createdAt": "2026-04-16T10:30:00Z",
 *     "mother": {
 *       "id": 42,
 *       "fullName": "Jane Doe",
 *       "phone": "+256701234567",
 *       "facility": { "id": 5, "name": "Mulago Hospital", "districtId": 1 }
 *     }
 *   }
 * }
 *
 * Response on not found (404):
 * {
 *   "success": false,
 *   "error": "Pregnancy not found"
 * }
 *
 * Response on unauthorized (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized - no token provided"
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ========================================================================
    // 1. EXTRACT AND VALIDATE AUTHORIZATION
    // ========================================================================
    const resolvedParams = await params;
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

    // Verify user has permission to read pregnancies
    const allowedRoles = ['DOCTOR', 'NURSE', 'MIDWIFE', 'DHO', 'ORG_ADMIN', 'HOSPITAL_ADMIN', 'SYSTEM_ADMIN'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions to view pregnancies',
        },
        { status: 403 }
      );
    }

    // ========================================================================
    // 2. VALIDATE PREGNANCY ID
    // ========================================================================
    const pregnancyId = parseInt(resolvedParams.id, 10);
    if (isNaN(pregnancyId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid pregnancy ID',
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // 3. FETCH PREGNANCY DETAILS WITH RELATIONS
    // ========================================================================
    const pregnancy = await db.pregnancy.findUnique({
      where: { id: pregnancyId },
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
        deliveryDate: true,
        deliveryOutcome: true,
        deliveryMode: true,
        babyWeightKg: true,
        complications: true,
        ancCardUrl: true,
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
        // Include ANC visits with vitals and symptoms
        ancVisits: {
          where: { deletedAt: null },
          orderBy: { visitDateTime: 'asc' },
          select: {
            id: true,
            visitNumber: true,
            visitType: true,
            purposeOther: true,
            visitDateTime: true,
            nextAppointment: true,
            notes: true,
            createdAt: true,
            vitals: {
              select: {
                id: true,
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
            },
            symptoms: {
              select: {
                id: true,
                bleeding: true,
                severeHeadache: true,
                blurredVision: true,
                swelling: true,
                fever: true,
                abdominalPain: true,
                reducedFetalMovement: true,
                other: true,
                createdAt: true,
              },
            },
          },
        },
        // Include obstetric history
        obstetricHistory: {
          orderBy: { year: 'asc' },
          select: {
            id: true,
            year: true,
            outcome: true,
            deliveryMode: true,
            complications: true,
            createdAt: true,
          },
        },
        // Include clinical archives
        clinicalArchives: {
          where: { deletedAt: null },
          orderBy: { datePerformed: 'desc' },
          select: {
            id: true,
            type: true,
            title: true,
            datePerformed: true,
            notes: true,
            fileUrl: true,
            uploadedById: true,
            createdAt: true,
            uploadedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!pregnancy) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pregnancy not found',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 4. LOG AUDIT (non-blocking)
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId || null,
      actorRole: user.role,
      action: 'READ',
      resource: 'pregnancy',
      resourceId: pregnancy.id,
      changesSummary: {
        motherId: pregnancy.motherId,
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((error) => {
      console.error('Failed to write audit log:', error);
      // Don't fail the request over audit logging
    });

    // ========================================================================
    // 5. RETURN SUCCESS RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: {
          ...pregnancy,
          riskFactors: JSON.parse(pregnancy.riskFactors || '[]'),
          complications: JSON.parse(pregnancy.complications || '[]'),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/pregnancies/[id]:', error);
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
 * PUT /api/pregnancies/[id]
 * Update a specific pregnancy record
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles: DOCTOR, NURSE, MIDWIFE, DHO, ORG_ADMIN, HOSPITAL_ADMIN, SYSTEM_ADMIN
 *
 * Request body (JSON):
 * {
 *   "isHighRisk": boolean (optional),
 *   "status": "ACTIVE" | "CLOSED" | "DELIVERED" (optional),
 *   "antenatalStatus": "YET_TO_START" | "ACTIVE" | "COMPLETED" (optional),
 *   "deliveryDate": ISO date string (optional),
 *   "deliveryOutcome": "LIVE_BIRTH" | "MISCARRIAGE" | "STILLBIRTH" | "ABORTION" (optional),
 *   "deliveryMode": "SVD" | "C_SECTION" | "ASSISTED" (optional),
 *   "babyWeightKg": number (optional),
 *   "complications": string[] (optional)
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "message": "Pregnancy updated successfully",
 *   "data": { ...updated pregnancy object }
 * }
 *
 * Response on not found (404):
 * {
 *   "success": false,
 *   "error": "Pregnancy not found"
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ========================================================================
    // 1. EXTRACT AND VALIDATE AUTHORIZATION
    // ========================================================================
    const resolvedParams = await params;
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

    // Verify user has permission to update pregnancies
    const allowedRoles = ['DOCTOR', 'NURSE', 'MIDWIFE', 'DHO', 'ORG_ADMIN', 'HOSPITAL_ADMIN', 'SYSTEM_ADMIN'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions to update pregnancies',
        },
        { status: 403 }
      );
    }

    // ========================================================================
    // 2. VALIDATE PREGNANCY ID
    // ========================================================================
    const pregnancyId = parseInt(resolvedParams.id, 10);
    if (isNaN(pregnancyId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid pregnancy ID',
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // 3. PARSE AND VALIDATE REQUEST BODY
    // ========================================================================
    let updateData;
    try {
      updateData = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
        },
        { status: 400 }
      );
    }

    // Build update object with only allowed fields
    const update: any = {};

    if (typeof updateData.isHighRisk === 'boolean') {
      update.isHighRisk = updateData.isHighRisk;
    }

    if (updateData.status && ['ACTIVE', 'CLOSED', 'DELIVERED'].includes(updateData.status)) {
      update.status = updateData.status;
    }

    if (updateData.antenatalStatus && ['YET_TO_START', 'ACTIVE', 'COMPLETED'].includes(updateData.antenatalStatus)) {
      update.antenatalStatus = updateData.antenatalStatus;
    }

    if (updateData.deliveryDate) {
      update.deliveryDate = new Date(updateData.deliveryDate);
    }

    if (updateData.deliveryOutcome && ['LIVE_BIRTH', 'MISCARRIAGE', 'STILLBIRTH', 'ABORTION'].includes(updateData.deliveryOutcome)) {
      update.deliveryOutcome = updateData.deliveryOutcome;
    }

    if (updateData.deliveryMode && ['SVD', 'C_SECTION', 'ASSISTED'].includes(updateData.deliveryMode)) {
      update.deliveryMode = updateData.deliveryMode;
    }

    if (typeof updateData.babyWeightKg === 'number') {
      update.babyWeightKg = updateData.babyWeightKg;
    }

    if (Array.isArray(updateData.complications)) {
      update.complications = JSON.stringify(updateData.complications);
    }

    // ========================================================================
    // 4. CHECK PREGNANCY EXISTS
    // ========================================================================
    const existingPregnancy = await db.pregnancy.findUnique({
      where: { id: pregnancyId },
      select: { id: true },
    });

    if (!existingPregnancy) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pregnancy not found',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 5. UPDATE PREGNANCY
    // ========================================================================
    const updatedPregnancy = await db.pregnancy.update({
      where: { id: pregnancyId },
      data: update,
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
        deliveryDate: true,
        deliveryOutcome: true,
        deliveryMode: true,
        babyWeightKg: true,
        complications: true,
        ancCardUrl: true,
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
        ancVisits: {
          where: { deletedAt: null },
          orderBy: { visitDateTime: 'asc' },
          select: {
            id: true,
            visitNumber: true,
            visitType: true,
            purposeOther: true,
            visitDateTime: true,
            nextAppointment: true,
            notes: true,
            createdAt: true,
            vitals: {
              select: {
                id: true,
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
            },
            symptoms: {
              select: {
                id: true,
                bleeding: true,
                severeHeadache: true,
                blurredVision: true,
                swelling: true,
                fever: true,
                abdominalPain: true,
                reducedFetalMovement: true,
                other: true,
                createdAt: true,
              },
            },
          },
        },
        obstetricHistory: {
          orderBy: { year: 'asc' },
          select: {
            id: true,
            year: true,
            outcome: true,
            deliveryMode: true,
            complications: true,
            createdAt: true,
          },
        },
        clinicalArchives: {
          where: { deletedAt: null },
          orderBy: { datePerformed: 'desc' },
          select: {
            id: true,
            type: true,
            title: true,
            datePerformed: true,
            notes: true,
            fileUrl: true,
            uploadedById: true,
            createdAt: true,
            uploadedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // ========================================================================
    // 6. LOG AUDIT
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId || null,
      actorRole: user.role,
      action: 'UPDATE',
      resource: 'pregnancy',
      resourceId: updatedPregnancy.id,
      changesSummary: Object.keys(update).length > 0 ? update : { noChanges: true },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((error) => {
      console.error('Failed to write audit log:', error);
    });

    // ========================================================================
    // 7. RETURN SUCCESS RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        message: 'Pregnancy updated successfully',
        data: {
          ...updatedPregnancy,
          riskFactors: JSON.parse(updatedPregnancy.riskFactors || '[]'),
          complications: JSON.parse(updatedPregnancy.complications || '[]'),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in PUT /api/pregnancies/[id]:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
