import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signToken } from '@/lib/auth';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';

/**
 * Request body validation interface
 */
interface UnifiedRegistrationBody {
  userType: string;
  fullName: string;
  phone: string;
  districtId: string | number;
  village?: string;
}

/**
 * POST /api/register
 * Unified registration endpoint for mothers, CHWs, and healthcare workers
 *
 * Request body:
 * {
 *   "userType": "mother" | "chw" | "healthcare_worker",
 *   "fullName": "Jane Doe",
 *   "phone": "0701234567" or "+256701234567",
 *   "districtId": 1,
 *   "village": "Bukoto" (optional)
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "message": "Registration successful",
 *   "data": {
 *     "userId": 123 (for CHW/healthcare_worker),
 *     "motherId": 456 (for mother),
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
    let body: UnifiedRegistrationBody;

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

    const { userType, fullName, phone, districtId, village } = body;

    // ========================================================================
    // 2. VALIDATE USER TYPE
    // ========================================================================
    if (!userType || typeof userType !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'userType is required and must be a string',
        },
        { status: 422 }
      );
    }

    const validUserTypes = ['mother', 'chw', 'healthcare_worker'];
    if (!validUserTypes.includes(userType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid userType. Must be one of: mother, chw, healthcare_worker',
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 3. VALIDATE INPUTS
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
    // 4. EXTRACT AUDIT CONTEXT
    // ========================================================================
    const { ipAddress, userAgent } = extractAuditContext(request);

    // ========================================================================
    // 5. VERIFY DISTRICT EXISTS
    // ========================================================================
    const district = await db.district.findUnique({
      where: { id: districtIdNumber },
      select: {
        id: true,
        name: true,
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
    // 6. HANDLE MOTHER REGISTRATION
    // ========================================================================
    if (userType === 'mother') {
      // Check if phone already registered in Mother table
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

      // Get first available facility in the district
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

      // Create Mother record
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
          dob: null,
        },
        select: {
          id: true,
          fullName: true,
          phone: true,
        },
      });

      // Create JWT token for auto-login
      const token = signToken({
        motherId: mother.id,
        phone: mother.phone,
        role: 'MOTHER',
      });

      // Log consent to ConsentRecord for audit trail
      try {
        await db.consentRecord.create({
          data: {
            motherId: mother.id,
            type: 'DATA_COLLECTION',
            ipAddress: ipAddress,
          },
        });
      } catch (error) {
        console.error('Error creating consent record:', error);
        // Don't fail registration if consent logging fails
      }

      // Write audit log
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
    }

    // ========================================================================
    // 7. HANDLE CHW & HEALTHCARE_WORKER REGISTRATION
    // ========================================================================
    if (userType === 'chw' || userType === 'healthcare_worker') {
      // Check if phone already registered in User table
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

      // Map userType to User role
      const roleMap: { [key: string]: string } = {
        chw: 'CHW',
        healthcare_worker: 'HEALTHCARE_WORKER',
      };

      const role = roleMap[userType];

      // Generate a unique username from fullName + timestamp
      const sanitizedName = trimmedFullName.toLowerCase().replace(/\s+/g, '.');
      const username = `${sanitizedName}.${Date.now()}`;

      // Create User record (CHW or Healthcare Worker)
      const user = await db.user.create({
        data: {
          name: trimmedFullName,
          username: username,
          passwordHash: '', // Will be set during password reset flow
          role: role,
          phone: normalizedPhone,
          districtId: districtIdNumber,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
        },
      });

      // Create JWT token for auto-login
      const token = signToken({
        userId: user.id,
        phone: user.phone,
        role: user.role,
      });

      // Write audit log
      try {
        await writeAuditLog({
          actorId: null,
          actorRole: 'PUBLIC',
          action: 'CREATE',
          resource: 'user',
          resourceId: user.id,
          changesSummary: {
            name: trimmedFullName,
            phone: normalizedPhone,
            districtId: districtIdNumber,
            districtName: district.name,
            role: role,
            registrationType: 'SELF_REGISTRATION',
          },
          ipAddress: ipAddress,
          userAgent: userAgent,
        });
      } catch (error) {
        console.error('Failed to write audit log:', error);
        // Don't fail the request if audit logging fails
      }

      return NextResponse.json(
        {
          success: true,
          message: 'Registration successful',
          data: {
            userId: user.id,
            token: token,
            phone: user.phone,
            fullName: user.name,
          },
        },
        { status: 200 }
      );
    }

    // Fallback - should never reach here due to validation above
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid user type',
      },
      { status: 422 }
    );
  } catch (error) {
    console.error('Unexpected error in unified registration handler:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
