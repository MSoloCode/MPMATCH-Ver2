import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  extractUser,
  getTenantScopingFilter,
  assertValidTenantScope,
  UnauthorizedError,
  ForbiddenError,
  ScopedUserPayload,
} from "@/lib/rbac";
import {
  parseDateRange,
  buildCSVResponse,
  buildJSONResponse,
} from "@/lib/report-queries";

/**
 * GET /api/reports/facility-utilisation
 * Facility utilisation report - ANC visit counts and metrics per facility
 *
 * Query parameters:
 * - from: ISO date string (YYYY-MM-DD), defaults to 30 days ago
 * - to: ISO date string (YYYY-MM-DD), defaults to today
 * - facilityId: Optional facility ID to filter to specific facility
 * - format: json or csv (default: json)
 *
 * Allowed roles: HOSPITAL_ADMIN, DHO, ORG_ADMIN, SYSTEM_ADMIN
 *
 * Response (JSON):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "facilityId": 1,
 *       "facilityName": "Kampala Central Hospital",
 *       "totalVisits": 450,
 *       "uniqueMothers": 200,
 *       "dateRangeDays": 30,
 *       "avgVisitsPerDay": 15.0,
 *       "visitsPerMother": 2.25
 *     }
 *   ],
 *   "pagination": { "total": 5, "returned": 5 }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Extract and verify user
    const user = extractUser(request);
    assertValidTenantScope(user as ScopedUserPayload);

    // 2. Check authorization
    const allowedRoles = [
      "HOSPITAL_ADMIN",
      "DHO",
      "ORG_ADMIN",
      "SYSTEM_ADMIN",
    ];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // 3. Parse query parameters
    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const facilityId = searchParams.get("facilityId");
    const format = searchParams.get("format") || "json";

    // 4. Validate format
    if (!["json", "csv"].includes(format)) {
      return NextResponse.json(
        { success: false, error: "Invalid format. Use json or csv" },
        { status: 422 }
      );
    }

    // 5. Parse and validate dates
    let dateRange;
    try {
      dateRange = parseDateRange(from, to, 30);
    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 422 }
      );
    }

    // Calculate number of days in range
    const daysDiff = Math.ceil(
      (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysInRange = Math.max(1, daysDiff);

    // 6. Build scope filter
    const scopeFilter = getTenantScopingFilter(user as ScopedUserPayload);

    // 7. Validate facilityId if provided
    let fIdFilter: any = undefined;
    if (facilityId) {
      const fId = parseInt(facilityId, 10);
      if (isNaN(fId)) {
        return NextResponse.json(
          { success: false, error: "Invalid facility ID" },
          { status: 422 }
        );
      }
      fIdFilter = { id: fId };
    }

    // 8. Query facilities and their visit data
    const facilities = await db.facility.findMany({
      where: fIdFilter,
      select: {
        id: true,
        name: true,
      },
    });

    // 9. For each facility, count visits and unique mothers
    interface FacilityUtilisationData {
      facilityId: number;
      facilityName: string;
      totalVisits: number;
      uniqueMothers: number;
      dateRangeDays: number;
      avgVisitsPerDay: number;
      visitsPerMother: number;
    }

    const utilisationData: FacilityUtilisationData[] = [];

    for (const facility of facilities) {
      // Count visits in facility within date range
      const totalVisits = await db.ancVisit.count({
        where: {
          visitDateTime: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
          mother: {
            facilityId: facility.id,
            ...scopeFilter,
          },
        },
      });

      // Count unique mothers who had visits at facility in date range
      const uniqueMothers = await db.mother.count({
        where: {
          facilityId: facility.id,
          ...scopeFilter,
          ancVisits: {
            some: {
              visitDateTime: {
                gte: dateRange.from,
                lte: dateRange.to,
              },
            },
          },
        },
      });

      const avgVisitsPerDay = Math.round((totalVisits / daysInRange) * 100) / 100;
      const visitsPerMother =
        uniqueMothers > 0
          ? Math.round((totalVisits / uniqueMothers) * 100) / 100
          : 0;

      utilisationData.push({
        facilityId: facility.id,
        facilityName: facility.name,
        totalVisits,
        uniqueMothers,
        dateRangeDays: daysInRange,
        avgVisitsPerDay,
        visitsPerMother,
      });
    }

    // Sort by facility name
    utilisationData.sort((a, b) =>
      a.facilityName.localeCompare(b.facilityName)
    );

    // 10. Return appropriate format
    if (format === "csv") {
      const csvData = utilisationData.map((row) => ({
        "Facility ID": row.facilityId,
        "Facility Name": row.facilityName,
        "Total Visits": row.totalVisits,
        "Unique Mothers": row.uniqueMothers,
        "Date Range (Days)": row.dateRangeDays,
        "Avg Visits/Day": row.avgVisitsPerDay,
        "Visits/Mother": row.visitsPerMother,
      }));
      return buildCSVResponse(
        csvData,
        `facility-utilisation-${new Date().toISOString().split("T")[0]}.csv`,
        [
          "Facility ID",
          "Facility Name",
          "Total Visits",
          "Unique Mothers",
          "Date Range (Days)",
          "Avg Visits/Day",
          "Visits/Mother",
        ]
      );
    }

    return buildJSONResponse(utilisationData, utilisationData.length);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }
    console.error("Error in facility utilisation report:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
