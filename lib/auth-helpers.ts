import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, UnauthorizedError } from '@/lib/auth';

/**
 * PROTECTED ROUTE HELPER
 * 
 * Use this utility to handle authentication in protected API routes
 * 
 * Example usage in a protected endpoint:
 * 
 * export async function POST(request: NextRequest) {
 *   const auth = await authenticateRequest(request);
 *   if (!auth.success) {
 *     return auth.response;  // Returns 401 error response
 *   }
 *   
 *   const { motherId, role } = auth.payload;
 *   // ... rest of your logic
 * }
 */

interface AuthPayload {
  motherId?: number;
  userId?: number;
  phone: string;
  role: string;
  iat?: number;
  exp?: number;
}

interface AuthResult {
  success: boolean;
  response?: NextResponse;
  payload?: AuthPayload;
  error?: string;
}

/**
 * Extract and verify JWT token from Authorization header
 * 
 * Returns:
 * - success: true + payload if token is valid
 * - success: false + response (401) if token is invalid/missing
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization');

  // Check if Authorization header exists
  if (!authHeader) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'Unauthorized - no token provided',
        },
        { status: 401 }
      ),
    };
  }

  // Check if it starts with "Bearer "
  if (!authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'Unauthorized - invalid authorization header format',
        },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  // Verify token signature and decode payload
  try {
    const payload = verifyToken(token) as AuthPayload;
    return {
      success: true,
      payload,
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return {
        success: false,
        response: NextResponse.json(
          {
            success: false,
            error: 'Unauthorized - invalid or expired token',
          },
          { status: 401 }
        ),
      };
    }

    // Unexpected error
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'Unauthorized - token verification failed',
        },
        { status: 401 }
      ),
    };
  }
}

/**
 * Verify user has required role
 * 
 * Returns error response if role doesn't match, null if authorized
 */
export function authorizeRole(
  userRole: string,
  requiredRole: string | string[]
): NextResponse | null {
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  if (!roles.includes(userRole)) {
    return NextResponse.json(
      {
        success: false,
        error: `Forbidden - requires role: ${roles.join(' or ')}`,
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * EXAMPLE: How to use in a protected endpoint
 * 
 * File: app/api/protected-example/route.ts
 */

/*
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, authorizeRole } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  try {
    // Step 1: Authenticate user
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return auth.response;
    }

    const { motherId, userId, role } = auth.payload;

    // Step 2: Check authorization (optional - only if role-based)
    if (role === 'MOTHER') {
      const roleError = authorizeRole(role, 'MOTHER');
      if (roleError) return roleError;
    }

    // Step 3: Parse request body
    const body = await request.json();

    // Step 4: Your business logic here
    const result = await db.someModel.create({
      data: {
        motherId: motherId,
        // ... other fields
      },
    });

    // Step 5: Return success
    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in protected endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
*/
