import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signTokenWithExpiry, comparePassword } from '@/lib/auth';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';
import { setTokenCookie } from '@/lib/cookies';

/**
 * Request body validation interface
 */
interface LoginBody {
  username: string;
  password: string;
}

/**
 * POST /api/auth/login
 * Authenticate a user via username/password and return JWT token.
 * 
 * Supports all user roles:
 * - CHW, DOCTOR, NURSE, MIDWIFE, SYSTEM_ADMIN, HOSPITAL_ADMIN, ORG_ADMIN, DHO, AMBULANCE_MANAGER
 * - COMMUNITY_USER (mothers who set up username/password authentication)
 *
 * JWT Expiry:
 * - Clinical roles (DOCTOR, NURSE, MIDWIFE): 8 hours
 * - All other roles: 24 hours
 *
 * Request body:
 * {
 *   "username": "john_doe",
 *   "password": "securePassword123"
 * }
 *
 * Response on success (200):
 * {
 *   "token": "eyJhbGciOiJIUzI1NiIs...",
 *   "user": {
 *     "id": 123,
 *     "name": "John Doe",
 *     "role": "DOCTOR",
 *     "hospitalName": "Mulago Hospital" or null
 *   }
 * }
 *
 * Response on validation failure (422):
 * {
 *   "error": "Username and password are required"
 * }
 *
 * Response on invalid credentials (401):
 * {
 *   "error": "Invalid credentials"
 * }
 *
 * Response on inactive account (403):
 * {
 *   "error": "Account deactivated"
 * }
 *
 * Response on server error (500):
 * {
 *   "error": "Internal server error"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // ========================================================================
    // 1. PARSE & VALIDATE REQUEST BODY
    // ========================================================================
    let body: LoginBody;

    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Invalid JSON in request body',
        },
        { status: 400 }
      );
    }

    const { username, password } = body;

    // Validate required fields
    if (!username || !password) {
      return NextResponse.json(
        {
          error: 'Username and password are required',
        },
        { status: 422 }
      );
    }

    // Trim and validate username length
    const trimmedUsername = username.trim();
    if (trimmedUsername.length === 0) {
      return NextResponse.json(
        {
          error: 'Username cannot be empty',
        },
        { status: 422 }
      );
    }

    // Validate password length
    if (password.length === 0) {
      return NextResponse.json(
        {
          error: 'Password cannot be empty',
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // 2. LOOKUP USER BY USERNAME
    // ========================================================================
    let user;
    try {
      user = await db.user.findUnique({
        where: { username: trimmedUsername },
        select: {
          id: true,
          username: true,
          name: true,
          passwordHash: true,
          role: true,
          isActive: true,
          hospitalId: true,
          countryId: true,
          orgId: true,
          districtId: true,
        },
      });
    } catch (error) {
      console.error('Database error during user lookup:', error);
      return NextResponse.json(
        {
          error: 'Internal server error',
        },
        { status: 500 }
      );
    }

    // User not found - return generic "Invalid credentials" for security
    if (!user) {
      return NextResponse.json(
        {
          error: 'Invalid credentials',
        },
        { status: 401 }
      );
    }

    // ========================================================================
    // 3. VERIFY PASSWORD WITH BCRYPT
    // ========================================================================
    let isPasswordValid: boolean;
    try {
      isPasswordValid = await comparePassword(password, user.passwordHash);
    } catch (error) {
      console.error('Error comparing password:', error);
      return NextResponse.json(
        {
          error: 'Internal server error',
        },
        { status: 500 }
      );
    }

    if (!isPasswordValid) {
      return NextResponse.json(
        {
          error: 'Invalid credentials',
        },
        { status: 401 }
      );
    }

    // ========================================================================
    // 4. CHECK IF USER IS ACTIVE
    // ========================================================================
    if (!user.isActive) {
      return NextResponse.json(
        {
          error: 'Account deactivated',
        },
        { status: 403 }
      );
    }

    // ========================================================================
    // 5. SIGN JWT TOKEN WITH ROLE-BASED EXPIRY
    // ========================================================================
    let token: string;
    try {
      token = signTokenWithExpiry(
        {
          userId: user.id,
          username: user.username,
          role: user.role,
          hospitalId: user.hospitalId,
          countryId: user.countryId,
          orgId: user.orgId,
          districtId: user.districtId,
        },
        user.role
      );
    } catch (error) {
      console.error('Error signing token:', error);
      return NextResponse.json(
        {
          error: 'Internal server error',
        },
        { status: 500 }
      );
    }

    // ========================================================================
    // 6. FETCH HOSPITAL NAME IF APPLICABLE
    // ========================================================================
    let hospitalName: string | null = null;
    if (user.hospitalId) {
      try {
        const hospital = await db.hospital.findUnique({
          where: { id: user.hospitalId },
          select: { name: true },
        });
        hospitalName = hospital?.name || null;
      } catch (error) {
        console.error('Error fetching hospital name:', error);
        // Don't fail the request over hospital lookup
        // hospitalName remains null
      }
    }

    // ========================================================================
    // 7. WRITE AUDIT LOG (non-blocking)
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'CREATE',
      resource: 'Session',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((error) => {
      console.error('Failed to write audit log:', error);
      // Don't fail the request over audit logging
    });

    // ========================================================================
    // 8. SET HTTPONLY COOKIE AND RETURN RESPONSE
    // ========================================================================
    const response = NextResponse.json(
      {
        token,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          hospitalName,
        },
      },
      { status: 200 }
    );

    // Set httpOnly cookie with JWT token
    return setTokenCookie(response, token);
  } catch (error) {
    console.error('Unexpected error in login endpoint:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
