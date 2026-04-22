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
  buildMotherFilter,
  buildAncVisitFilter,
  convertDataToCSV,
  buildCSVResponse,
  buildJSONResponse,
  calculateAttendancePercentage,
  formatDate,
} from "@/lib/report-queries";

/**
 * GET /api/reports/anc-attendance
 * ANC attendance report - count mothers with visits per facility
 *
 * Query parameters:
 * - from: ISO date string (YYYY-MM-DD), defaults to 30 days ago
 * - to: ISO date string (YYYY-MM-DD), defaults to today
 * - district: Optional district ID to filter by
 * - facilityId: Optional facility ID to filter by
 * - format: json or csv (default: json)
 *
 * Allowed roles: HOSPITAL_ADMIN, DOCTOR, MIDWIFE, NURSE, DHO, ORG_ADMIN, SYSTEM_ADMIN
 *
 * Response (JSON):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "facilityId": 1,
 *       "facilityName": "Kampala Central Hospital",
 *       "totalMothers": 150,
 *       "mothersWithVisits": 120,
 *       "attendancePercentage": 80.00
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
      "DOCTOR",
      "MIDWIFE",
      "NURSE",
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
    const district = searchParams.get("district");
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

    // 6. Build scope and custom filters
    const scopeFilter = getTenantScopingFilter(user as ScopedUserPayload);
    const customFilters: any = {};

    if (district) {
      const districtId = parseInt(district, 10);
      if (isNaN(districtId)) {
        return NextResponse.json(
          { success: false, error: "Invalid district ID" },
          { status: 422 }
        );
      }
      customFilters.districtId = districtId;
    }

    if (facilityId) {
      const fId = parseInt(facilityId, 10);
      if (isNaN(fId)) {
        return NextResponse.json(
          { success: false, error: "Invalid facility ID" },
          { status: 422 }
        );
      }
      customFilters.facilityId = fId;
    }

    // 7. Query mothers and visits
    const motherFilter = buildMotherFilter(scopeFilter, customFilters);
    const ancVisitFilter = buildAncVisitFilter(scopeFilter, {
      dateRange,
      facilityId: customFilters.facilityId,
    });

    // Get all mothers in scope
    const mothers = await db.mother.findMany({
      where: motherFilter,
      include: { facility: true },
    });

    // Get all visits in date range
    const visits = await db.ancVisit.findMany({
      where: ancVisitFilter,
    });

    // 8. Aggregate data by facility
    const facilitiesMap = new Map<
      number,
      { name: string; totalMothers: number; visitsCount: number }
    >();

    mothers.forEach((mother) => {
      const fId = mother.facilityId || 0;
      if (!facilitiesMap.has(fId)) {
        facilitiesMap.set(fId, {
          name: mother.facility?.name || "Unknown",
          totalMothers: 0,
          visitsCount: 0,
        });
      }
      const facility = facilitiesMap.get(fId)!;
      facility.totalMothers += 1;
    });

    visits.forEach((visit) => {
      const fId = visit.motherId; // We need to get facility through mother
      // This is simplified - we'll reconstruct from mother data
    });

    // Better approach: group by facility with aggregation
    const mothersWithVisitCounts = await db.mother.findMany({
      where: motherFilter,
      include: {
        facility: true,
        ancVisits: {
          where: {
            visitDateTime: {
              gte: dateRange.from,
              lte: dateRange.to,
            },
          },
          select: { id: true },
        },
      },
    });

    // Create aggregated report
    const reportMap = new Map<
      number,
      {
        facilityId: number;
        facilityName: string;
        totalMothers: number;
        mothersWithVisits: Set<number>;
      }
    >();

    mothersWithVisitCounts.forEach((mother) => {
      const fId = mother.facilityId || 0;
      const fName = mother.facility?.name || "Unknown Facility";

      if (!reportMap.has(fId)) {
        reportMap.set(fId, {
          facilityId: fId,
          facilityName: fName,
          totalMothers: 0,
          mothersWithVisits: new Set(),
        });
      }

      const facility = reportMap.get(fId)!;
      facility.totalMothers += 1;

      if (mother.ancVisits.length > 0) {
        facility.mothersWithVisits.add(mother.id);
      }
    });

    // Convert to array and calculate percentages
    const reportData = Array.from(reportMap.values()).map((facility) => ({
      facilityId: facility.facilityId,
      facilityName: facility.facilityName,
      totalMothers: facility.totalMothers,
      mothersWithVisits: facility.mothersWithVisits.size,
      attendancePercentage: calculateAttendancePercentage(
        facility.mothersWithVisits.size,
        facility.totalMothers
      ),
    }));

    // Sort by facility name
    reportData.sort((a, b) => a.facilityName.localeCompare(b.facilityName));

    // 9. Return appropriate format
    if (format === "csv") {
      const csvData = reportData.map((row) => ({
        "Facility ID": row.facilityId,
        "Facility Name": row.facilityName,
        "Total Mothers": row.totalMothers,
        "Mothers with Visits": row.mothersWithVisits,
        "Attendance %": row.attendancePercentage,
      }));
      return buildCSVResponse(
        csvData,
        `anc-attendance-${new Date().toISOString().split("T")[0]}.csv`,
        ["Facility ID", "Facility Name", "Total Mothers", "Mothers with Visits", "Attendance %"]
      );
    }

    return buildJSONResponse(reportData, reportData.length);
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
    console.error("Error in ANC attendance report:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
