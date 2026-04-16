import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  extractUser,
  getTenantScopingFilter,
  assertValidTenantScope,
  UnauthorizedError,
  ForbiddenError,
  ScopedUserPayload,
} from '@/lib/rbac';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';

/**
 * GET /api/facilities/geo
 * Retrieve facilities with geolocation coordinates for map display
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles:
 * - DOCTOR, MIDWIFE, NURSE: Hospital scope
 * - HOSPITAL_ADMIN: Hospital scope
 * - DHO, ORG_ADMIN: District scope
 * - SYSTEM_ADMIN: Unrestricted access
 *
 * Query parameters:
 * - skip: Pagination offset (default: 0)
 * - take: Number of records to return (default: 20, max: 100)
 *
 * Request headers:
 * {
 *   "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs..."
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 1,
 *       "name": "Mulago Hospital",
 *       "district": "Kampala",
 *       "type": "HOSPITAL",
 *       "lat": 0.3356,
 *       "lng": 32.5825,
 *       "emergencyPhone": "+256701234567"
 *     }
 *   ],
 *   "pagination": {
 *     "total": 45,
 *     "returned": 20,
 *     "skip": 0,
 *     "take": 20
 *   }
 * }
 *
 * Response on unauthorized (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized - no token provided"
 * }
 *
 * Response on forbidden (403):
 * {
 *   "success": false,
 *   "error": "Insufficient permissions"
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
    // 1. EXTRACT AND VALIDATE AUTHORIZATION
    // ========================================================================
    let user: ScopedUserPayload;
    try {
      user = extractUser(request);
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
      throw error;
    }

    // ========================================================================
    // 2. VALIDATE TENANT SCOPE
    // ========================================================================
    try {
      assertValidTenantScope(user);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 403 }
        );
      }
      throw error;
    }

    // ========================================================================
    // 3. PARSE QUERY PARAMETERS
    // ========================================================================
    const searchParams = request.nextUrl.searchParams;
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0', 10));
    const take = Math.min(100, Math.max(1, parseInt(searchParams.get('take') || '20', 10)));

    // ========================================================================
    // 4. GET TENANT SCOPING FILTER
    // ========================================================================
    const scopeFilter = getTenantScopingFilter(user);

    // ========================================================================
    // 5. FETCH FACILITIES WITH GEO COORDINATES
    // ========================================================================
    const [facilities, total] = await Promise.all([
      db.facility.findMany({
        where: {
          ...scopeFilter,
          lat: {
            not: null,
          },
          lng: {
            not: null,
          },
        },
        select: {
          id: true,
          name: true,
          type: true,
          lat: true,
          lng: true,
          emergencyPhone: true,
          district: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
        skip,
        take,
      }),
      db.facility.count({
        where: {
          ...scopeFilter,
          lat: {
            not: null,
          },
          lng: {
            not: null,
          },
        },
      }),
    ]);

    // ========================================================================
    // 6. FORMAT RESPONSE
    // ========================================================================
    const formattedFacilities = facilities.map((f) => ({
      id: f.id,
      name: f.name,
      district: f.district?.name || 'Unknown',
      type: f.type,
      lat: f.lat,
      lng: f.lng,
      emergencyPhone: f.emergencyPhone,
    }));

    // ========================================================================
    // 7. WRITE AUDIT LOG
    // ========================================================================
    await writeAuditLog({
      userId: user.id,
      action: 'READ_SENSITIVE',
      resource: 'facility',
      resourceId: null,
      details: `Retrieved ${formattedFacilities.length} geo-located facilities`,
      ipAddress: extractAuditContext(request).ipAddress,
      userAgent: extractAuditContext(request).userAgent,
    });

    // ========================================================================
    // 8. RETURN RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: formattedFacilities,
        pagination: {
          total,
          returned: formattedFacilities.length,
          skip,
          take,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    // Unexpected error
    console.error('Facilities geo endpoint error:', error);

    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve facilities',
        details: errorMsg,
      },
      { status: 500 }
    );
  }
}
