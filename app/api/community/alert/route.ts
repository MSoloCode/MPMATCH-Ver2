import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-helpers';
import { sendSMS, formatPhoneNumber } from '@/services/sms';
import { haversineDistanceKm } from '@/lib/geo';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';

/**
 * Request body validation interface
 */
interface CommunityAlertRequestBody {
  description: string;
}

/**
 * POST /api/community/alert
 * Create a COMMUNITY_REQUEST alert from an authenticated mother
 *
 * Authentication: Required (Bearer token in Authorization header)
 * Role: COMMUNITY_USER (mother)
 *
 * Request body:
 * {
 *   "description": "Severe headache and bleeding"
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": {
 *     "alertId": 123,
 *     "assignedCHW": {
 *       "id": 5,
 *       "name": "John Okello",
 *       "phone": "0701234567"
 *     }
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
 *   "error": "Access denied. Community users only."
 * }
 *
 * Response on mother not found (400):
 * {
 *   "success": false,
 *   "error": "Mother record not found"
 * }
 *
 * Response on no CHWs available (400):
 * {
 *   "success": false,
 *   "error": "No available CHWs in your district"
 * }
 *
 * Response on validation failure (422):
 * {
 *   "success": false,
 *   "error": "description is required and must be a string (max 500 characters)"
 * }
 *
 * Response on server error (500):
 * {
 *   "success": false,
 *   "error": "Internal server error"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // ========================================================================
    // 1. AUTHENTICATE REQUEST
    // ========================================================================
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return auth.response;
    }

    const { motherId, role } = auth.payload!;

    // ========================================================================
    // 2. VERIFY ROLE (must be COMMUNITY_USER)
    // ========================================================================
    if (role !== 'COMMUNITY_USER') {
      return NextResponse.json(
        {
          success: false,
          error: 'Access denied. Community users only.',
        },
        { status: 403 }
      );
    }

    // motherId should exist for COMMUNITY_USER role
    if (!motherId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid token payload - motherId is required',
        },
        { status: 401 }
      );
    }

    // ========================================================================
    // 3. PARSE & VALIDATE REQUEST BODY
    // ========================================================================
    let body: CommunityAlertRequestBody;

    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
        },
        { status: 400 }
      );
    }

    const { description } = body;

    // Validate description
    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'description is required and must be a string',
        },
        { status: 422 }
      );
    }

    const trimmedDescription = description.trim();
    if (trimmedDescription.length === 0 || trimmedDescription.length > 500) {
      return NextResponse.json(
        {
          success: false,
          error: 'description must be between 1 and 500 characters',
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 4. FETCH MOTHER & VALIDATE
    // ========================================================================
    const mother = await db.mother.findUnique({
      where: { id: motherId },
      include: {
        district: true,
        facility: true,
        chw: {
          include: {
            hospital: true,
          },
        },
      },
    });

    if (!mother) {
      return NextResponse.json(
        {
          success: false,
          error: 'Mother record not found',
        },
        { status: 400 }
      );
    }

    if (!mother.districtId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Mother does not have a district assigned',
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // 5. GET REFERENCE LOCATION FOR GEO QUERIES
    // ========================================================================
    // Use mother's assigned CHW's facility coordinates if available,
    // otherwise use mother's own facility coordinates
    let referenceFacility = mother.facility;
    if (mother.chw && mother.chw.hospital?.facility) {
      referenceFacility = mother.chw.hospital.facility;
    }

    if (!referenceFacility || !referenceFacility.lat || !referenceFacility.lng) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unable to determine location reference for CHW matching',
        },
        { status: 500 }
      );
    }

    const referenceLat = referenceFacility.lat;
    const referenceLng = referenceFacility.lng;

    // ========================================================================
    // 6. FIND THE NEAREST CHW IN THE SAME DISTRICT
    // ========================================================================
    // Query all CHWs in the mother's district with their facility information
    const chws = await db.user.findMany({
      where: {
        role: 'CHW',
        isActive: true,
        districtId: mother.districtId,
        facilityId: { not: null },
      },
      include: {
        facility: true,
      },
    });

    if (chws.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No available CHWs in your district',
        },
        { status: 400 }
      );
    }

    // Calculate distances and find nearest CHW
    interface CHWWithDistance {
      chw: typeof chws[0];
      distanceKm: number;
    }

    const chwsWithDistance: CHWWithDistance[] = chws
      .filter((chw) => chw.facility && chw.facility.lat && chw.facility.lng)
      .map((chw) => ({
        chw,
        distanceKm: haversineDistanceKm(
          referenceLat,
          referenceLng,
          chw.facility!.lat!,
          chw.facility!.lng!
        ),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    if (chwsWithDistance.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No available CHWs with valid location data in your district',
        },
        { status: 400 }
      );
    }

    const nearestCHW = chwsWithDistance[0].chw;
    const nearestCHWFacility = nearestCHW.facility!;

    // ========================================================================
    // 7. CREATE ALERT RECORD
    // ========================================================================
    const alert = await db.alert.create({
      data: {
        type: 'COMMUNITY_REQUEST',
        status: 'OPEN',
        motherId: mother.id,
        initiatedById: motherId,
        assignedToId: nearestCHW.id,
        metadata: JSON.stringify({
          description: trimmedDescription,
          motherPhone: mother.phone,
          initiatingCommunityUserId: motherId,
          referenceLocation: {
            facilityName: referenceFacility.name,
            lat: referenceLat,
            lng: referenceLng,
          },
          assignedCHWLocation: {
            facilityName: nearestCHWFacility.name,
            lat: nearestCHWFacility.lat,
            lng: nearestCHWFacility.lng,
          },
        }),
      },
    });

    // ========================================================================
    // 8. SEND SMS NOTIFICATIONS (PARALLEL, NON-BLOCKING)
    // ========================================================================
    const auditContext = extractAuditContext(request);

    // Format phone numbers
    const chwFormattedPhone = nearestCHW.phone
      ? formatPhoneNumber(nearestCHW.phone)
      : nearestCHW.phone;
    const facilityFormattedPhone = nearestCHWFacility.onCallPhone
      ? formatPhoneNumber(nearestCHWFacility.onCallPhone)
      : nearestCHWFacility.onCallPhone;

    // SMS message to nearest CHW
    const chwSmsMessage = `Emergency alert from community user in ${mother.village || mother.district?.name}:\n"${trimmedDescription}"\n\nContact: ${mother.phone}`;

    // SMS message to facility
    const facilitySmsMessage = `Community alert assigned to CHW ${nearestCHW.name}:\n"${trimmedDescription}"\n\nReferrer: ${mother.fullName} (${mother.phone})`;

    // Send SMS in parallel without blocking response
    Promise.all([
      chwFormattedPhone
        ? sendSMS({
            to: chwFormattedPhone,
            message: chwSmsMessage,
            type: 'COMMUNITY_REQUEST',
            userId: nearestCHW.id,
          }).catch((error) => {
            console.error('SMS to CHW failed:', error);
          })
        : Promise.resolve(),
      facilityFormattedPhone
        ? sendSMS({
            to: facilityFormattedPhone,
            message: facilitySmsMessage,
            type: 'COMMUNITY_REQUEST_FACILITY',
            userId: nearestCHW.id,
          }).catch((error) => {
            console.error('SMS to facility failed:', error);
          })
        : Promise.resolve(),
    ]).catch((error) => {
      console.error('SMS batch send failed:', error);
    });

    // Write audit log asynchronously (non-blocking)
    writeAuditLog({
      action: 'CREATE',
      entity: 'Alert',
      entityId: alert.id,
      userId: motherId,
      changes: {
        type: 'COMMUNITY_REQUEST',
        status: 'OPEN',
        assignedToId: nearestCHW.id,
      },
      ipAddress: auditContext.ip,
      userAgent: auditContext.userAgent,
    }).catch((error) => {
      console.error('Audit log write failed:', error);
    });

    // ========================================================================
    // 9. RETURN SUCCESS RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: {
          alertId: alert.id,
          assignedCHW: {
            id: nearestCHW.id,
            name: nearestCHW.name,
            phone: nearestCHW.phone,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error creating community alert:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
