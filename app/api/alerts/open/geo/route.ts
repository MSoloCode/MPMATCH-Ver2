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
 * GET /api/alerts/open/geo
 * Retrieve open alerts with geolocation coordinates for map display
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles:
 * - DOCTOR, MIDWIFE, NURSE: Hospital scope
 * - AMBULANCE_MANAGER: District scope
 * - HOSPITAL_ADMIN: Hospital scope
 * - SYSTEM_ADMIN: Unrestricted access
 *
 * Returns only OPEN alerts with:
 * - Valid coordinates stored in metadata (lat and lng fields present)
 * - Coordinates sourced from mother's location at time of alert creation
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
 *       "alertId": 5,
 *       "type": "HIGH_RISK_BP",
 *       "status": "OPEN",
 *       "initiatedAt": "2026-04-10T14:30:00Z",
 *       "lat": 0.3356,
 *       "lng": 32.5825
 *     }
 *   ],
 *   "pagination": {
 *     "total": 8,
 *     "returned": 8,
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
    let user: Record<string, any>;
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
      assertValidTenantScope(user as ScopedUserPayload);
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
    const scopeFilter = getTenantScopingFilter(user as ScopedUserPayload);

    // ========================================================================
    // 5. FETCH OPEN ALERTS WITH GEO COORDINATES
    // ========================================================================
    const [allAlerts, total] = await Promise.all([
      db.alert.findMany({
        where: {
          ...scopeFilter,
          status: 'OPEN',
        },
        select: {
          id: true,
          type: true,
          status: true,
          createdAt: true,
          metadata: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take,
      }),
      db.alert.count({
        where: {
          ...scopeFilter,
          status: 'OPEN',
        },
      }),
    ]);

    // ========================================================================
    // 6. FORMAT RESPONSE - FILTER FOR VALID COORDINATES IN METADATA
    // ========================================================================
    const formattedAlerts = allAlerts
      .map((a) => {
        // Parse metadata JSON
        let metadata: any = {};
        if (a.metadata) {
          try {
            metadata = JSON.parse(a.metadata);
          } catch {
            // If metadata is invalid JSON, skip this alert
            return null;
          }
        }

        // Check if both lat and lng are present and valid numbers
        const lat = metadata.lat;
        const lng = metadata.lng;

        if (lat === null || lat === undefined || lng === null || lng === undefined) {
          return null;
        }

        if (typeof lat !== 'number' || typeof lng !== 'number') {
          return null;
        }

        return {
          alertId: a.id,
          type: a.type,
          status: a.status,
          initiatedAt: a.createdAt,
          lat,
          lng,
        };
      })
      .filter((alert) => alert !== null);

    // ========================================================================
    // 7. WRITE AUDIT LOG
    // ========================================================================
    await writeAuditLog({
      actorId: user.id || null,
      actorRole: user.role,
      action: 'READ_SENSITIVE',
      resource: 'alert',
      resourceId: 0,
      changesSummary: `Retrieved ${formattedAlerts.length} open alerts with geo coordinates`,
      ipAddress: extractAuditContext(request).ipAddress,
      userAgent: extractAuditContext(request).userAgent,
    });

    // ========================================================================
    // 8. RETURN RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: formattedAlerts,
        pagination: {
          total,
          returned: formattedAlerts.length,
          skip,
          take,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    // Unexpected error
    console.error('Open alerts geo endpoint error:', error);

    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve open alerts',
        details: errorMsg,
      },
      { status: 500 }
    );
  }
}
