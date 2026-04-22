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
 * GET /api/referrals/[id]
 * Retrieve a single referral with full pregnancy history snapshot
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles:
 * - DOCTOR, NURSE, MIDWIFE: View referrals within their hospital scope
 * - HOSPITAL_ADMIN: Hospital scope
 * - DHO, ORG_ADMIN: District/organization scope
 * - SYSTEM_ADMIN: Unrestricted access
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": {
 *     ...referral fields...,
 *     pregnancySnapshot: {
 *       id, motherId, lmpDate, edd, gravida, parity, status, isHighRisk,
 *       antenatalStatus, multiplePregnancy, riskFactors, complications
 *     }
 *   }
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
    // 4. PARSE ID PARAMETER
    // ========================================================================
    const resolvedParams = await params;
    const referralId = parseInt(resolvedParams.id, 10);

    if (isNaN(referralId) || referralId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid referral ID',
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 5. GET TENANT SCOPING FILTER
    // ========================================================================
    const scopeFilter = getTenantScopingFilter(user as ScopedUserPayload);

    // ========================================================================
    // 6. FETCH REFERRAL WITH RELATIONS
    // ========================================================================
    const referral = await db.referral.findFirst({
      where: {
        id: referralId,
        ...scopeFilter,
      },
      include: {
        mother: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            village: true,
            facilityId: true,
          },
        },
        fromFacility: {
          select: {
            id: true,
            name: true,
            emergencyPhone: true,
            onCallPhone: true,
          },
        },
        toFacility: {
          select: {
            id: true,
            name: true,
            emergencyPhone: true,
            onCallPhone: true,
          },
        },
        pregnancy: {
          select: {
            id: true,
            motherId: true,
            lmpDate: true,
            edd: true,
            gravida: true,
            parity: true,
            status: true,
            isHighRisk: true,
            antenatalStatus: true,
            multiplePregnancy: true,
            riskFactors: true,
            complications: true,
            ancVisits: {
              select: {
                id: true,
                visitNumber: true,
                visitDateTime: true,
                visitType: true,
              },
              orderBy: { visitNumber: 'desc' },
              take: 5,
            },
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

    if (!referral) {
      return NextResponse.json(
        {
          success: false,
          error: 'Referral not found',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 7. RETURN RESPONSE WITH PREGNANCY SNAPSHOT
    // ========================================================================
    return NextResponse.json({
      success: true,
      data: {
        ...referral,
        pregnancySnapshot: referral.pregnancy
          ? {
              id: referral.pregnancy.id,
              motherId: referral.pregnancy.motherId,
              lmpDate: referral.pregnancy.lmpDate,
              edd: referral.pregnancy.edd,
              gravida: referral.pregnancy.gravida,
              parity: referral.pregnancy.parity,
              status: referral.pregnancy.status,
              isHighRisk: referral.pregnancy.isHighRisk,
              antenatalStatus: referral.pregnancy.antenatalStatus,
              multiplePregnancy: referral.pregnancy.multiplePregnancy,
              riskFactors: referral.pregnancy.riskFactors,
              complications: referral.pregnancy.complications,
              recentVisits: referral.pregnancy.ancVisits,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Error fetching referral:', error);
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
 * PATCH /api/referrals/[id]
 * Update a referral (status, statusNotes)
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles:
 * - DOCTOR, NURSE, MIDWIFE: Update referrals within their hospital scope
 * - HOSPITAL_ADMIN: Hospital scope
 * - SYSTEM_ADMIN: Unrestricted access
 *
 * Request body (at least one required):
 * {
 *   "status": "ACCEPTED",
 *   "statusNotes": "Patient accepted for care"
 * }
 *
 * Allowed status values:
 * - PENDING, ACCEPTED, COMPLETED, DECLINED
 *
 * Immutable fields (cannot be updated):
 * - motherId, pregnancyId, fromFacilityId, toFacilityId, createdById, createdAt
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": { ...updated referral object... },
 *   "message": "Referral updated successfully"
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
          error: 'Insufficient permissions to update referrals',
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
    // 4. PARSE ID PARAMETER
    // ========================================================================
    const resolvedParams = await params;
    const referralId = parseInt(resolvedParams.id, 10);

    if (isNaN(referralId) || referralId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid referral ID',
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 5. PARSE AND VALIDATE REQUEST BODY
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

    const { status, statusNotes } = body;

    // Check if at least one field is provided to update
    if (status === undefined && statusNotes === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'At least one field must be provided (status or statusNotes)',
        },
        { status: 422 }
      );
    }

    // Check for immutable field attempts
    const immutableFields = [
      'motherId',
      'pregnancyId',
      'fromFacilityId',
      'toFacilityId',
      'createdById',
      'createdAt',
      'reason',
      'notes',
      'urgency',
    ];
    const attemptedImmutableUpdates = immutableFields.filter((field) => field in body);
    if (attemptedImmutableUpdates.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot update immutable fields: ${attemptedImmutableUpdates.join(', ')}`,
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 6. VALIDATE STATUS IF PROVIDED
    // ========================================================================
    if (status !== undefined) {
      if (typeof status !== 'string') {
        return NextResponse.json(
          {
            success: false,
            error: 'status must be a string',
          },
          { status: 422 }
        );
      }

      const validStatuses = ['PENDING', 'ACCEPTED', 'COMPLETED', 'DECLINED'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid status. Allowed: ${validStatuses.join(', ')}`,
          },
          { status: 422 }
        );
      }
    }

    // ========================================================================
    // 7. VALIDATE STATUS NOTES IF PROVIDED
    // ========================================================================
    if (statusNotes !== undefined && statusNotes !== null) {
      if (typeof statusNotes !== 'string') {
        return NextResponse.json(
          {
            success: false,
            error: 'statusNotes must be a string',
          },
          { status: 422 }
        );
      }
    }

    // ========================================================================
    // 8. FETCH EXISTING REFERRAL WITH FULL DETAILS
    // ========================================================================
    const scopeFilter = getTenantScopingFilter(user as ScopedUserPayload);
    const existingReferral = await db.referral.findFirst({
      where: {
        id: referralId,
        // Verify ownership: user must be from the referring facility
        fromFacility: scopeFilter,
      },
      include: {
        mother: true,
        fromFacility: true,
        toFacility: true,
        pregnancy: true,
      },
    });

    if (!existingReferral) {
      return NextResponse.json(
        {
          success: false,
          error: 'Referral not found or access denied',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 9. BUILD UPDATE OBJECT
    // ========================================================================
    const updateData: any = {};

    if (status !== undefined) {
      updateData.status = status;
    }

    if (statusNotes !== undefined) {
      updateData.statusNotes = statusNotes;
    }

    // ========================================================================
    // 10. UPDATE REFERRAL
    // ========================================================================
    const updatedReferral = await db.referral.update({
      where: { id: referralId },
      data: updateData,
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
            emergencyPhone: true,
            onCallPhone: true,
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
    // 11. SEND SMS NOTIFICATIONS BASED ON STATUS CHANGE
    // ========================================================================
    if (status === 'ACCEPTED') {
      // Notify referring facility via SMS when referral is accepted
      const referringFacilityPhone = existingReferral.fromFacility.emergencyPhone || 
                                      existingReferral.fromFacility.onCallPhone;
      
      if (referringFacilityPhone) {
        const smsMessage = `REFERRAL ACCEPTED: Patient ${existingReferral.mother.fullName} referral to ${updatedReferral.toFacility.name} has been accepted. ${statusNotes ? `Notes: ${statusNotes}` : ''}`;
        
        try {
          const formattedPhone = formatPhoneNumber(referringFacilityPhone);
          sendSMS({
            to: formattedPhone,
            message: smsMessage,
            type: 'REFERRAL_ACCEPTED',
            userId: user.id,
          }).catch(err => {
            console.error('Failed to send referral accepted SMS:', err);
          });
        } catch (phoneErr) {
          console.error('Failed to format referral facility phone:', phoneErr);
        }
      }
    } else if (status === 'DECLINED') {
      // On DECLINED: notify referring facility and suggest next nearest facility
      const referringFacilityPhone = existingReferral.fromFacility.emergencyPhone || 
                                      existingReferral.fromFacility.onCallPhone;
      
      // Suggest next nearest facility to the mother's location
      let suggestedFacility = null;
      
      if (referringFacilityPhone) {
        if (existingReferral.mother) {
          try {
            // Fetch mother's facility to get district
            const motherFacility = await db.facility.findUnique({
              where: { id: existingReferral.mother.facilityId },
              select: { districtId: true },
            });

            if (motherFacility) {
              // Find other facilities in the same district (excluding the declined one)
              const alternativeFacilities = await db.facility.findMany({
                where: {
                  districtId: motherFacility.districtId,
                  id: { not: existingReferral.toFacilityId },
                },
                select: {
                  id: true,
                  name: true,
                  emergencyPhone: true,
                  onCallPhone: true,
                },
                take: 1,
              });

              if (alternativeFacilities.length > 0) {
                suggestedFacility = alternativeFacilities[0];
              }
            }
          } catch (err) {
            console.error('Failed to find alternative facility:', err);
          }
        }

        const suggestedText = suggestedFacility 
          ? ` Consider referring to ${suggestedFacility.name} instead.`
          : '';

        const smsMessage = `REFERRAL DECLINED: Patient ${existingReferral.mother.fullName} referral to ${updatedReferral.toFacility.name} has been declined.${suggestedText} ${statusNotes ? `Reason: ${statusNotes}` : ''}`;
        
        try {
          const formattedPhone = formatPhoneNumber(referringFacilityPhone);
          sendSMS({
            to: formattedPhone,
            message: smsMessage,
            type: 'REFERRAL_DECLINED',
            userId: user.id,
          }).catch(err => {
            console.error('Failed to send referral declined SMS:', err);
          });
        } catch (phoneErr) {
          console.error('Failed to format referral facility phone:', phoneErr);
        }
      }

      // Optionally return suggested facility in response for mobile app to use
      if (suggestedFacility) {
        (updatedReferral as any).suggestedAlternativeFacility = {
          id: suggestedFacility.id,
          name: suggestedFacility.name,
          phone: suggestedFacility.emergencyPhone || suggestedFacility.onCallPhone,
        };
      }
    }

    // ========================================================================
    // 12. WRITE AUDIT LOG (non-blocking)
    // ========================================================================
    writeAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'UPDATE',
      resource: 'referral',
      resourceId: referralId,
      changesSummary: updateData,
      ipAddress: extractAuditContext(request).ipAddress,
      userAgent: extractAuditContext(request).userAgent,
    }).catch((err) => {
      console.error('Failed to write audit log for referral update:', err);
    });

    // ========================================================================
    // 13. RETURN RESPONSE
    // ========================================================================
    return NextResponse.json({
      success: true,
      data: updatedReferral,
      message: 'Referral updated successfully',
    });
  } catch (error) {
    console.error('Error updating referral:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
