import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, UnauthorizedError } from '@/lib/auth';
import { getTokenFromCookie } from '@/lib/cookies';

/**
 * GET /api/auth/verify
 * Verify JWT token from httpOnly cookie and return decoded payload
 * 
 * Used by:
 * - RoleGuard HOC to verify user authentication and role
 * - Client-side components to check auth status without exposing token
 * 
 * Response on success (200):
 * {
 *   "success": true,
 *   "payload": {
 *     "userId": 123,
 *     "username": "john_doe",
 *     "phone": "+256701234567",
 *     "email": "john@example.com",
 *     "role": "CHW",
 *     "iat": 1234567890,
 *     "exp": 1234654290
 *   }
 * }
 *
 * Response on missing/invalid token (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized - no token provided"
 * }
 *
 * Response on expired token (401):
 * {
 *   "success": false,
 *   "error": "Token has expired"
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Extract token from httpOnly cookie
    const token = getTokenFromCookie(request);

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized - no token provided',
        },
        { status: 401 }
      );
    }

    // Verify and decode token
    const payload = verifyToken(token);

    return NextResponse.json({
      success: true,
      payload,
    });
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

    console.error('Unexpected error in /api/auth/verify:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
