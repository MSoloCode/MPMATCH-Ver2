import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signToken, hashPassword } from '@/lib/auth';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';

/**
 * Request body validation interface
 */
interface MotherRegistrationBody {
  fullName: string;
  phone: string;
  districtId: string | number;
  village?: string;
  username: string;
  password: string;
}

/**
 * POST /api/mothers/register
 * Register a new mother in the system with username and password
 * Reference: Mothers register themselves through the public registration flow
 *
 * Request body:
 * {
 *   "fullName": "Jane Doe",
 *   "phone": "0701234567" or "+256701234567",
 *   "districtId": 1,
 *   "village": "Bukoto",
 *   "username": "janedoe",
 *   "password": "securePassword123"
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "message": "Registration successful",
 *   "data": {
 *     "motherId": 123,
 *     "userId": 456,
 *     "token": "eyJhbGciOiJIUzI1NiIs...",
 *     "phone": "+256701234567",
 *     "fullName": "Jane Doe"
 *   }
 * }
 *
 * Response on validation failure (422):
 * {
 *   "success": false,
 *   "error": "Invalid phone format. Must be 07XXXXXX or +256XXXXXXXXX"
 * }
 *
 * Response on phone/username already registered (409):
 * {
 *   "success": false,
 *   "error": "Phone number is already registered" or "Username is already taken"
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

    const { fullName, phone, districtId, village, username, password } = body;

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

    // Validate username
    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'username is required and must be a string',
        },
        { status: 422 }
      );
    }

    const trimmedUsername = username.trim();
    const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;
    if (!usernameRegex.test(trimmedUsername)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Username must be 3-20 characters, start with a letter, and contain only letters, numbers, and underscore',
        },
        { status: 422 }
      );
    }

    // Validate password
    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'password is required and must be a string',
        },
        { status: 422 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password must be at least 8 characters',
        },
        { status: 422 }
      );
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
    // 6. CHECK IF USERNAME ALREADY TAKEN
    // ========================================================================
    const existingUser = await db.user.findUnique({
      where: { username: trimmedUsername },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Username is already taken',
        },
        { status: 409 }
      );
    }

    // ========================================================================
    // 7. GET DEFAULT FACILITY FOR DISTRICT
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
    // 8. HASH PASSWORD
    // ========================================================================
    const passwordHash = await hashPassword(password);

    // ========================================================================
    // 9. CREATE MOTHER RECORD & USER ACCOUNT
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

    // Create User account for login
    const user = await db.user.create({
      data: {
        name: trimmedFullName,
        username: trimmedUsername,
        passwordHash: passwordHash,
        phone: normalizedPhone,
        role: 'COMMUNITY_USER',
        isActive: true,
        motherId: mother.id,
        districtId: districtIdNumber,
        countryId: district.countryId,
      },
      select: {
        id: true,
        username: true,
      },
    });

    // ========================================================================
    // 10. CREATE JWT TOKEN FOR AUTO-LOGIN
    // ========================================================================
    const token = signToken({
      userId: user.id,
      motherId: mother.id,
      username: trimmedUsername,
      phone: normalizedPhone,
      role: 'COMMUNITY_USER',
      districtId: districtIdNumber,
      countryId: district.countryId, // Include country for potential use
    });

    // ========================================================================
    // 11. LOG CONSENT TO CONSENT RECORD (for audit trail)
    // ========================================================================
    try {
      await db.consentRecord.create({
        data: {
          motherId: mother.id,
          type: 'DATA_COLLECTION',
          ipAddress: ipAddress,
          userId: user.id,
        },
      });
    } catch (error) {
      console.error('Error creating consent record:', error);
      // Don't fail registration if consent logging fails
    }

    // ========================================================================
    // 12. WRITE AUDIT LOG
    // ========================================================================
    try {
      await writeAuditLog({
        actorId: user.id,
        actorRole: 'COMMUNITY_USER',
        action: 'CREATE',
        resource: 'mother',
        resourceId: mother.id,
        changesSummary: {
          fullName: trimmedFullName,
          phone: normalizedPhone,
          username: trimmedUsername,
          districtId: districtIdNumber,
          districtName: district.name,
          village: trimmedVillage,
          consentAccepted: true,
          registrationType: 'SELF_REGISTRATION_WITH_CREDENTIALS',
        },
        ipAddress: ipAddress,
        userAgent: userAgent,
      });
    } catch (error) {
      console.error('Failed to write audit log:', error);
      // Don't fail the request if audit logging fails
    }

    // ========================================================================
    // 13. RETURN SUCCESS RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        message: 'Registration successful',
        data: {
          motherId: mother.id,
          userId: user.id,
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
