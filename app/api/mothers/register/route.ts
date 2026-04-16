import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signToken } from '@/lib/auth';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';

/**
 * Request body validation interface
 */
interface MotherRegistrationBody {
  fullName: string;
  phone: string;
  districtId: string | number;
  village?: string;
}

/**
 * POST /api/mothers/register
 * Register a new mother in the system
 * Reference: Mothers register themselves through the public registration flow
 *
 * Request body:
 * {
 *   "fullName": "Jane Doe",
 *   "phone": "0701234567" or "+256701234567",
 *   "districtId": 1,
 *   "village": "Bukoto"
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "message": "Registration successful",
 *   "data": {
 *     "motherId": 123,
 *     "token": "eyJhbGciOiJIUzI1NiIs...",
 *     "phone": "+256701234567"
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
 * Response on district not found (404):
 * {
 *   "success": false,
 *   "error": "District not found"
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
    let body: MotherRegistrationBody;

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

    const { fullName, phone, districtId, village } = body;

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

    // Validate village (optional)
    const trimmedVillage = village ? String(village).trim().substring(0, 100) : null;

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
    // 5. CHECK IF PHONE ALREADY REGISTERED
    // ========================================================================
    const existingMother = await db.mother.findUnique({
      where: { phone: normalizedPhone },
      select: { id: true },
    });

    if (existingMother) {
      return NextResponse.json(
        {
          success: false,
          error: 'Phone number is already registered',
        },
        { status: 409 }
      );
    }

    // ========================================================================
    // 6. GET DEFAULT FACILITY FOR DISTRICT
    // ========================================================================
    // Get first available facility in the district (or primary facility)
    const facility = await db.facility.findFirst({
      where: { districtId: districtIdNumber },
      select: { id: true },
      orderBy: { type: 'desc' }, // Prioritize Hospital > Health Center > Clinic
    });

    if (!facility) {
      return NextResponse.json(
        {
          success: false,
          error: 'No healthcare facility found in selected district',
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // 7. CREATE MOTHER RECORD
    // ========================================================================
    const currentTime = new Date();

    const mother = await db.mother.create({
      data: {
        fullName: trimmedFullName,
        phone: normalizedPhone,
        districtId: districtIdNumber,
        facilityId: facility.id,
        village: trimmedVillage,
        consentAccepted: true,
        consentDate: currentTime,
        consentIp: ipAddress,
        registeredById: null, // Public registration, no actor
        dob: null, // Can be collected in future profile update
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
      },
    });

    // ========================================================================
    // 8. CREATE JWT TOKEN FOR AUTO-LOGIN
    // ========================================================================
    const token = signToken({
      motherId: mother.id,
      phone: mother.phone,
      role: 'COMMUNITY_USER', // IMPORTANT: Role must be COMMUNITY_USER, not MOTHER
      districtId: districtIdNumber,
      countryId: district.countryId, // Include country for potential use
    });

    // ========================================================================
    // 9. LOG CONSENT TO CONSENT RECORD (for audit trail)
    // ========================================================================
    try {
      await db.consentRecord.create({
        data: {
          motherId: mother.id,
          type: 'DATA_COLLECTION',
          consentGiven: true,
          consentDate: currentTime,
          consentIp: ipAddress,
          expiryDate: new Date(currentTime.getTime() + 2 * 365 * 24 * 60 * 60 * 1000), // 2 years
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
        resource: 'mother',
        resourceId: mother.id,
        changesSummary: {
          fullName: trimmedFullName,
          phone: normalizedPhone,
          districtId: districtIdNumber,
          districtName: district.name,
          village: trimmedVillage,
          consentAccepted: true,
          registrationType: 'SELF_REGISTRATION',
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
        message: 'Registration successful',
        data: {
          motherId: mother.id,
          token: token,
          phone: mother.phone,
          fullName: mother.fullName,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in mother registration handler:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
