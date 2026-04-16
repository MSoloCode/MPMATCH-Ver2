import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signToken, hashPassword } from '@/lib/auth';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';

/**
 * Request body validation interface
 */
interface CHWRegistrationBody {
  fullName: string;
  phone: string;
  districtId: string | number;
  facilityId?: string | number;
  password?: string;
}

/**
 * POST /api/chws/register
 * Register a new Community Health Worker (CHW) in the system
 * Reference: CHWs register themselves through the public registration flow
 *
 * Request body:
 * {
 *   "fullName": "John Doe",
 *   "phone": "0701234567" or "+256701234567",
 *   "districtId": 1,
 *   "facilityId": 5
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "message": "CHW registration successful",
 *   "data": {
 *     "userId": 123,
 *     "token": "eyJhbGciOiJIUzI1NiIs...",
 *     "phone": "+256701234567",
 *     "role": "CHW"
 *   }
 * }
 *
 * Response on validation failure (422):
 * {
 *   "success": false,
 *   "error": "Invalid phone format. Must be 07XXXXXX or +256XXXXXXXXX"
 * }
 *
 * Response on phone already registered (409):
 * {
 *   "success": false,
 *   "error": "Phone number is already registered"
 * }
 *
 * Response on facility not found (404):
 * {
 *   "success": false,
 *   "error": "Facility not found"
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
    // 1. PARSE & VALIDATE REQUEST BODY
    // ========================================================================
    let body: CHWRegistrationBody;

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

    const { fullName, phone, districtId, facilityId } = body;

    // ========================================================================
    // 2. VALIDATE INPUTS
    // ========================================================================

    // Validate fullName
    if (!fullName || typeof fullName !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'fullName is required and must be a string',
        },
        { status: 422 }
      );
    }

    const trimmedFullName = fullName.trim();
    if (trimmedFullName.length < 2 || trimmedFullName.length > 100) {
      return NextResponse.json(
        {
          success: false,
          error: 'Full name must be between 2 and 100 characters',
        },
        { status: 422 }
      );
    }

    // Validate phone format: 07XXXXXX or +256XXXXXXXXX
    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Phone number is required and must be a string',
        },
        { status: 422 }
      );
    }

    const phoneRegex = /^(07\d{6}|\+256[0-9]{9})$/;
    if (!phoneRegex.test(phone.trim())) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid phone format. Must be 07XXXXXX or +256XXXXXXXXX',
        },
        { status: 422 }
      );
    }

    // Normalize phone to lowercase for consistent storage
    const normalizedPhone = phone.toLowerCase();

    // Validate districtId
    if (!districtId) {
      return NextResponse.json(
        {
          success: false,
          error: 'District is required',
        },
        { status: 422 }
      );
    }

    const districtIdNumber = Number(districtId);
    if (!Number.isInteger(districtIdNumber) || districtIdNumber <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'districtId must be a positive integer',
        },
        { status: 422 }
      );
    }

    // Validate facilityId (optional - can be assigned later)
    let facilityIdNumber: number | null = null;
    if (facilityId) {
      facilityIdNumber = Number(facilityId);
      if (!Number.isInteger(facilityIdNumber) || facilityIdNumber <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'facilityId must be a positive integer if provided',
          },
          { status: 422 }
        );
      }
    }

    // ========================================================================
    // 3. EXTRACT AUDIT CONTEXT
    // ========================================================================
    const { ipAddress, userAgent } = extractAuditContext(request);

    // ========================================================================
    // 4. VERIFY DISTRICT EXISTS
    // ========================================================================
    const district = await db.district.findUnique({
      where: { id: districtIdNumber },
      select: {
        id: true,
        name: true,
        countryId: true,
      },
    });

    if (!district) {
      return NextResponse.json(
        {
          success: false,
          error: 'District not found',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 5. VERIFY FACILITY EXISTS (IF PROVIDED)
    // ========================================================================
    if (facilityIdNumber) {
      const facility = await db.facility.findUnique({
        where: { id: facilityIdNumber },
        select: { id: true, districtId: true },
      });

      if (!facility) {
        return NextResponse.json(
          {
            success: false,
            error: 'Facility not found',
          },
          { status: 404 }
        );
      }

      // Verify facility is in the selected district
      if (facility.districtId !== districtIdNumber) {
        return NextResponse.json(
          {
            success: false,
            error: 'Selected facility does not belong to the selected district',
          },
          { status: 422 }
        );
      }
    }

    // ========================================================================
    // 6. CHECK IF PHONE ALREADY REGISTERED
    // ========================================================================
    const existingUser = await db.user.findFirst({
      where: { phone: normalizedPhone },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Phone number is already registered',
        },
        { status: 409 }
      );
    }

    // ========================================================================
    // 7. CREATE CHW USER RECORD
    // ========================================================================
    const currentTime = new Date();

    // Generate a temporary password (they can set their own on first login)
    const tempPassword = await hashPassword(Math.random().toString(36).substring(2, 10));

    const user = await db.user.create({
      data: {
        name: trimmedFullName,
        username: normalizedPhone,
        passwordHash: tempPassword,
        phone: normalizedPhone,
        role: 'CHW',
        districtId: districtIdNumber,
        hospitalId: facilityIdNumber,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
      },
    });

    // ========================================================================
    // 8. CREATE JWT TOKEN FOR AUTO-LOGIN
    // ========================================================================
    const token = signToken({
      userId: user.id,
      phone: user.phone,
      role: user.role,
      districtId: districtIdNumber,
      countryId: district.countryId, // Include country for system-wide reference
      facilityId: facilityIdNumber || undefined,
    });

    // ========================================================================
    // 9. LOG CONSENT TO CONSENT RECORD (for audit trail)
    // ========================================================================
    try {
      await db.consentRecord.create({
        data: {
          userId: user.id,
          type: 'DATA_COLLECTION',
          acceptedAt: new Date(),
          ipAddress: ipAddress,
        },
      });
    } catch (error) {
      console.error('Error creating consent record:', error);
      // Don't fail registration if consent logging fails
    }

    // ========================================================================
    // 10. WRITE AUDIT LOG
    // ========================================================================
    try {
      await writeAuditLog({
        actorId: null,
        actorRole: 'PUBLIC',
        action: 'CREATE',
        resource: 'user',
        resourceId: user.id,
        changesSummary: {
          fullName: trimmedFullName,
          phone: normalizedPhone,
          role: 'CHW',
          districtId: districtIdNumber,
          districtName: district.name,
          facilityId: facilityIdNumber,
          registrationType: 'CHW_SELF_REGISTRATION',
        },
        ipAddress: ipAddress,
        userAgent: userAgent,
      });
    } catch (error) {
      console.error('Failed to write audit log:', error);
      // Don't fail the request if audit logging fails
    }

    // ========================================================================
    // 11. RETURN SUCCESS RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        message: 'CHW registration successful',
        data: {
          userId: user.id,
          token: token,
          phone: user.phone,
          fullName: user.name,
          role: user.role,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in CHW registration handler:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
