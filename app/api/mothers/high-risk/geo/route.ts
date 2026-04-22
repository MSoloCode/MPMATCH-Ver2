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
 * GET /api/mothers/high-risk/geo
 * Retrieve high-risk pregnant mothers with geolocation for map display
 * PROTECTED - Requires valid JWT token in Authorization header
 *
 * Allowed roles:
 * - DOCTOR, MIDWIFE, NURSE: Hospital scope
 * - HOSPITAL_ADMIN: Hospital scope
 * - SYSTEM_ADMIN: Unrestricted access
 *
 * Returns only mothers with:
 * - At least one ACTIVE pregnancy where isHighRisk=true
 * - Valid coordinates from their registered facility (lat and lng not null)\n *
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
 *       "motherId": 42,
 *       "name": "Jane Doe",
 *       "phone": "+256701234567",
 *       "lastVisitDate": "2026-04-10T14:30:00Z",
 *       "riskFactors": ["hypertension", "age>35"],
 *       "lat": 0.3356,
 *       "lng": 32.5825
 *     }
 *   ],
 *   "pagination": {
 *     "total": 12,
 *     "returned": 12,
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
      user = extractUser(request) as ScopedUserPayload;
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
      assertValidTenantScope(user as any);
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
    const scopeFilter = getTenantScopingFilter(user as any);

    // ========================================================================
    // 5. FETCH HIGH-RISK MOTHERS WITH GEO COORDINATES
    // ========================================================================
    // Query: Get mothers who have at least one ACTIVE high-risk pregnancy
    // with a facility that has valid coordinates
    const [highRiskMotherRecords, total] = await Promise.all([
      db.mother.findMany({
        where: {
          ...scopeFilter,
          facility: {
            lat: {
              not: null,
            },
            lng: {
              not: null,
            },
          },
          pregnancies: {
            some: {
              status: 'ACTIVE',
              isHighRisk: true,
            },
          },
        },
        select: {
          id: true,
          fullName: true,
          phone: true,
          facility: {
            select: {
              lat: true,
              lng: true,
            },
          },
          pregnancies: {
            where: {
              status: 'ACTIVE',
              isHighRisk: true,
            },
            select: {
              riskFactors: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
          ancVisits: {
            select: {
              visitDateTime: true,
            },
            orderBy: {
              visitDateTime: 'desc',
            },
            take: 1,
          },
        },
        orderBy: {
          fullName: 'asc',
        },
        skip,
        take,
      }),
      db.mother.count({
        where: {
          ...scopeFilter,
          facility: {
            lat: {
              not: null,
            },
            lng: {
              not: null,
            },
          },
          pregnancies: {
            some: {
              status: 'ACTIVE',
              isHighRisk: true,
            },
          },
        },
      }),
    ]);

    // ========================================================================
    // 6. FORMAT RESPONSE
    // ========================================================================
    const formattedMothers = highRiskMotherRecords.map((m) => {
      // Parse riskFactors from JSON string
      let riskFactors: string[] = [];
      if (m.pregnancies.length > 0 && m.pregnancies[0].riskFactors) {
        try {
          riskFactors = JSON.parse(m.pregnancies[0].riskFactors);
          if (!Array.isArray(riskFactors)) {
            riskFactors = [];
          }
        } catch {
          riskFactors = [];
        }
      }

      return {
        motherId: m.id,
        name: m.fullName,
        phone: m.phone,
        lastVisitDate: m.ancVisits.length > 0 ? m.ancVisits[0].visitDateTime : null,
        riskFactors,
        lat: m.facility?.lat,
        lng: m.facility?.lng,
      };
    });

    // ========================================================================
    // 7. WRITE AUDIT LOG
    // ========================================================================
    const auditContext = extractAuditContext(request);
    await writeAuditLog({
      actorId: user.id || user.userId || null,
      actorRole: user.role,
      action: 'READ_SENSITIVE',
      resource: 'mother',
      resourceId: null,
      changesSummary: `Retrieved ${formattedMothers.length} high-risk mothers with geo coordinates`,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    });

    // ========================================================================
    // 8. RETURN RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: formattedMothers,
        pagination: {
          total,
          returned: formattedMothers.length,
          skip,
          take,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    // Unexpected error
    console.error('High-risk mothers geo endpoint error:', error);

    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve high-risk mothers',
        details: errorMsg,
      },
      { status: 500 }
    );
  }
}
