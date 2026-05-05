import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signToken, comparePassword } from '@/lib/auth';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';
import { setTokenCookie } from '@/lib/cookies';

/**
 * Request body validation interface
 */
interface SignInBody {
  username: string;
  password: string;
}

/**
 * POST /api/sign-in
 * Authenticate a user (CHW, Healthcare Worker, Admin, or Mother) via username/password
 * 
 * Support for all user roles:
 * - CHW, DOCTOR, NURSE, MIDWIFE, SYSTEM_ADMIN, HOSPITAL_ADMIN, ORG_ADMIN, etc.
 * - COMMUNITY_USER (mothers who set up username/password for sign-in)
 *
 * Request body:
 * {
 *   "username": "john_doe",
 *   "password": "securePassword123"
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "message": "Sign in successful",
 *   "data": {
 *     "token": "eyJhbGciOiJIUzI1NiIs...",
 *     "user": {
 *       "userId": 123,
 *       "username": "john_doe",
 *       "email": "john@example.com",
 *       "phone": "+256701234567",
 *       "role": "CHW",
 *       "name": "John Doe"
 *     }
 *   }
 * }
 *
 * Response on validation failure (422):
 * {
 *   "success": false,
 *   "error": "Username and password are required"
 * }
 *
 * Response on invalid credentials (401):
 * {
 *   "success": false,
 *   "error": "Invalid username or password"
 * }
 *
 * Response on inactive user (401):
 * {
 *   "success": false,
 *   "error": "This account is inactive. Contact your Hospital Admin."
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
    let body: SignInBody;

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

    const { username, password } = body;

    // Validate required fields
    if (!username || !password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Username and password are required',
        },
        { status: 422 }
      );
    }

    // Trim and validate length
    const trimmedUsername = username.trim();
    if (trimmedUsername.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Username cannot be empty',
        },
        { status: 422 }
      );
    }

    if (password.length === 0) {
      return NextResponse.json(
        {
          success: false,
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
          phone: true,
          role: true,
          isActive: true,
          motherId: true, // Include motherId for COMMUNITY_USER
        },
      });
    } catch (error) {
      console.error('Database error during user lookup:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
        },
        { status: 500 }
      );
    }

    // User not found
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid username or password',
        },
        { status: 401 }
      );
    }

    // ========================================================================
    // 3. VERIFY PASSWORD
    // ========================================================================
    let isPasswordValid: boolean;
    try {
      isPasswordValid = await comparePassword(password, user.passwordHash);
    } catch (error) {
      console.error('Error comparing password:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
        },
        { status: 500 }
      );
    }

    if (!isPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid username or password',
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
          success: false,
          error: 'This account is inactive. Contact your Hospital Admin.',
        },
        { status: 401 }
      );
    }

    // ========================================================================
    // 5. SIGN JWT TOKEN
    // ========================================================================
    let token: string;
    try {
      const tokenPayload: any = {
        userId: user.id,
        username: user.username,
        phone: user.phone,
        role: user.role,
      };
      
      // Include motherId for COMMUNITY_USER roles
      if (user.role === 'COMMUNITY_USER' && user.motherId) {
        tokenPayload.motherId = user.motherId;
      }
      
      token = signToken(tokenPayload);
    } catch (error) {
      console.error('Error signing token:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
        },
        { status: 500 }
      );
    }

    // ========================================================================
    // 6. WRITE AUDIT LOG (non-blocking)
    // ========================================================================
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'READ',
      resource: 'USER',
      resourceId: user.id,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((error) => {
      console.error('Failed to write audit log:', error);
      // Don't fail the request over audit logging
    });

    // ========================================================================
    // 7. RETURN SUCCESS RESPONSE WITH COOKIE
    // ========================================================================
    const responseData: any = {
      success: true,
      message: 'Sign in successful',
      data: {
        token,
        user: {
          userId: user.id,
          username: user.username,
          phone: user.phone || null,
          role: user.role,
          name: user.name,
        },
      },
    };
    
    // Include motherId for COMMUNITY_USER
    if (user.role === 'COMMUNITY_USER' && user.motherId) {
      responseData.data.user.motherId = user.motherId;
    }
    
    const response = NextResponse.json(responseData, { status: 200 });

    // Set httpOnly cookie with JWT token
    return setTokenCookie(response, token);
  } catch (error) {
    console.error('Unexpected error in sign-in endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
