import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, UnauthorizedError } from '@/lib/auth';

/**
 * GET /api/chws/me
 * Retrieve authenticated CHW's profile
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Request headers:
 * {
 *   "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs..."
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": {
 *     "userId": 1,
 *     "fullName": "John Doe",
 *     "phone": "+256701234567",
 *     "role": "CHW",
 *     "district": "Kampala",
 *     "facility": "Mulago Hospital",
 *     "isActive": true
 *   }
 * }
 *
 * Response on missing token (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized - no token provided"
 * }
 *
 * Response on invalid token (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized - invalid token"
 * }
 *
 * Response on server error (500):
 * {
 *   "success": false,
 *   "error": "Internal server error"
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // ========================================================================
    // 1. EXTRACT AND VALIDATE AUTHORIZATION HEADER
    // ========================================================================
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized - no token provided',
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // ========================================================================
    // 2. VERIFY JWT TOKEN
    // ========================================================================
    let decodedToken: any;

    try {
      decodedToken = verifyToken(token);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Unauthorized - invalid token',
          },
          { status: 401 }
        );
      }
      throw error;
    }

    // ========================================================================
    // 3. VERIFY CHW/USER EXISTS IN DATABASE
    // ========================================================================
    const userId = decodedToken.userId;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized - token missing userId',
        },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        district: {
          select: {
            name: true,
          },
        },
        hospital: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 4. RETURN AUTHENTICATED USER DATA
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: {
          userId: user.id,
          fullName: user.name,
          phone: user.phone,
          role: user.role,
          district: user.district?.name || null,
          facility: user.hospital?.name || null,
          isActive: user.isActive,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in GET /api/chws/me:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
