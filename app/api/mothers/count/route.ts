import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-helpers';

/**
 * GET /api/mothers/count
 * Count mothers by district and village (for authenticated community users)
 *
 * Query parameters:
 * - districtId: number (required)
 * - village: string (optional)
 *
 * Authentication: Required (Bearer token in Authorization header)
 * Role: COMMUNITY_USER
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": {
 *     "districtCount": 45,
 *     "villageCount": 12
 *   }
 * }
 *
 * Response on unauthorized (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized"
 * }
 *
 * Response on missing districtId (400):
 * {
 *   "success": false,
 *   "error": "districtId is required"
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
    // 1. AUTHENTICATE REQUEST
    // ========================================================================
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return auth.response;
    }

    const { role } = auth.payload!;

    // ========================================================================
    // 2. VERIFY ROLE (should be COMMUNITY_USER)
    // ========================================================================
    if (role !== 'COMMUNITY_USER') {
      return NextResponse.json(
        {
          success: false,
          error: 'Access denied. Community users only.',
        },
        { status: 403 }
      );
    }

    // ========================================================================
    // 3. GET QUERY PARAMETERS
    // ========================================================================
    const searchParams = request.nextUrl.searchParams;
    const districtIdParam = searchParams.get('districtId');
    const village = searchParams.get('village');

    if (!districtIdParam) {
      return NextResponse.json(
        {
          success: false,
          error: 'districtId is required',
        },
        { status: 400 }
      );
    }

    const districtId = Number(districtIdParam);
    if (!Number.isInteger(districtId) || districtId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'districtId must be a positive integer',
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // 4. COUNT MOTHERS IN DISTRICT
    // ========================================================================
    const districtCount = await db.mother.count({
      where: {
        districtId,
        deletedAt: null, // Exclude soft-deleted records
      },
    });

    // ========================================================================
    // 5. COUNT MOTHERS IN VILLAGE (if provided)
    // ========================================================================
    let villageCount = 0;
    if (village && village.trim()) {
      villageCount = await db.mother.count({
        where: {
          districtId,
          village: village.trim(),
          deletedAt: null,
        },
      });
    }

    // ========================================================================
    // 6. RETURN COUNTS
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: {
          districtCount,
          villageCount,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/mothers/count error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
