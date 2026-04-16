import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  extractUser,
  assertValidTenantScope,
  UnauthorizedError,
  ForbiddenError,
  ScopedUserPayload,
} from '@/lib/rbac';

/**
 * GET /api/chws
 * Fetch CHWs with optional filtering by role and district
 * PROTECTED - Requires valid JWT token
 *
 * Query parameters:
 * - role: "CHW" (optional, default: "CHW")
 * - district: positive integer districtId (optional)
 *
 * Examples:
 * GET /api/chws?role=CHW&district=1
 * GET /api/chws?district=1
 * GET /api/chws
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 10,
 *       "name": "James Mutua",
 *       "districtId": 1,
 *       "district": { "id": 1, "name": "Kampala" }
 *     },
 *     {
 *       "id": 11,
 *       "name": "Sarah Namukwaya",
 *       "districtId": 1,
 *       "district": { "id": 1, "name": "Kampala" }
 *     }
 *   ]
 * }
 *
 * Response on unauthorized (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized"
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // ========================================================================
    // 1. AUTHENTICATION
    // ========================================================================
    const user = extractUser(request);
    if (!user) {
      throw new UnauthorizedError('No token provided');
    }

    assertValidTenantScope(user as ScopedUserPayload);

    // ========================================================================
    // 2. PARSE QUERY PARAMETERS
    // ========================================================================
    const searchParams = request.nextUrl.searchParams;
    const role = searchParams.get('role') || 'CHW';
    const districtParam = searchParams.get('district');

    // Validate districtId if provided
    let districtId: number | undefined;
    if (districtParam) {
      districtId = Number(districtParam);
      if (!Number.isInteger(districtId) || districtId <= 0) {
        return NextResponse.json(
          { success: false, error: 'District ID must be a positive integer' },
          { status: 422 }
        );
      }
    }

    // ========================================================================
    // 3. BUILD QUERY FILTER
    // ========================================================================
    const where: any = {
      role: role,
      isActive: true,
    };

    if (districtId) {
      where.districtId = districtId;
    }

    // ========================================================================
    // 4. FETCH CHWs
    // ========================================================================
    const chws = await db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        districtId: true,
        district: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: chws,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching CHWs:', error);

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
