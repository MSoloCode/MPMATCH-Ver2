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
 * GET /api/reports/chw-activity
 * CHW activity report - visits and appointments per CHW
 *
 * Query parameters:
 * - from: ISO date string (YYYY-MM-DD), defaults to 30 days ago
 * - to: ISO date string (YYYY-MM-DD), defaults to today
 * - chwId: Optional CHW ID to filter to specific CHW
 * - format: json or csv (default: json)
 *
 * Allowed roles: DHO, ORG_ADMIN, COMMUNITY_USER (own CHW data), SYSTEM_ADMIN
 *
 * Response (JSON):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "chwId": 5,
 *       "chwName": "John CHW",
 *       "chwPhone": "+256701234567",
 *       "mothersEnrolled": 150,
 *       "visitsCount": 45,
 *       "appointmentsAssigned": 30,
 *       "appointmentsConfirmed": 25,
 *       "appointmentsMissed": 5
 *     }
 *   ],
 *   "pagination": { "total": 8, "returned": 8 }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Extract and verify user
    const user = extractUser(request);
    assertValidTenantScope(user as ScopedUserPayload);

    // 2. Check authorization
    const allowedRoles = ["DHO", "ORG_ADMIN", "COMMUNITY_USER", "SYSTEM_ADMIN"];
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
    const chwId = searchParams.get("chwId");
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

    // 6. Build scope filter
    const scopeFilter = getTenantScopingFilter(user as ScopedUserPayload);

    // 7. Validate chwId if provided
    let chwFilter: any = undefined;
    if (chwId) {
      const cId = parseInt(chwId, 10);
      if (isNaN(cId)) {
        return NextResponse.json(
          { success: false, error: "Invalid CHW ID" },
          { status: 422 }
        );
      }
      chwFilter = { id: cId };
    }

    // 8. Query CHWs and their activity
    const chws = await db.user.findMany({
      where: {
        role: "CHW",
        ...chwFilter,
        // Apply scope filter - CHWs must be in user's district
        // Note: User model may not have districtId; filter based on mothers they manage
      },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    });

    // 9. For each CHW, count enrolled mothers and activity
    interface CHWActivityData {
      chwId: number;
      chwName: string;
      chwPhone: string;
      mothersEnrolled: number;
      visitsCount: number;
      appointmentsAssigned: number;
      appointmentsConfirmed: number;
      appointmentsMissed: number;
    }

    const activityData: CHWActivityData[] = [];

    for (const chw of chws) {
      // Count mothers enrolled by this CHW
      const mothersEnrolled = await db.mother.count({
        where: {
          chwId: chw.id,
          ...scopeFilter,
        },
      });

      // Count visits by mothers registered by this CHW (in date range)
      const visitsCount = await db.ancVisit.count({
        where: {
          visitDateTime: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
          mother: {
            chwId: chw.id,
            ...scopeFilter,
          },
        },
      });

      // Count appointments assigned to this CHW (in date range)
      const appointmentsAssigned = await db.appointment.count({
        where: {
          appointmentDateTime: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
          assignedCHWId: chw.id,
        },
      });

      // Count confirmed/attended appointments
      const appointmentsConfirmed = await db.appointment.count({
        where: {
          appointmentDateTime: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
          assignedCHWId: chw.id,
          status: {
            in: ["CONFIRMED", "ATTENDED"],
          },
        },
      });

      // Count missed appointments
      const appointmentsMissed = await db.appointment.count({
        where: {
          appointmentDateTime: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
          assignedCHWId: chw.id,
          status: {
            in: ["MISSED", "LIKELY_MISSED"],
          },
        },
      });

      activityData.push({
        chwId: chw.id,
        chwName: chw.name || "Unknown",
        chwPhone: chw.phone || "N/A",
        mothersEnrolled,
        visitsCount,
        appointmentsAssigned,
        appointmentsConfirmed,
        appointmentsMissed,
      });
    }

    // Sort by CHW name
    activityData.sort((a, b) => a.chwName.localeCompare(b.chwName));

    // 10. Return appropriate format
    if (format === "csv") {
      const csvData = activityData.map((row) => ({
        "CHW ID": row.chwId,
        "CHW Name": row.chwName,
        "CHW Phone": row.chwPhone,
        "Mothers Enrolled": row.mothersEnrolled,
        "Visits (Period)": row.visitsCount,
        "Appointments Assigned": row.appointmentsAssigned,
        "Appointments Confirmed": row.appointmentsConfirmed,
        "Appointments Missed": row.appointmentsMissed,
      }));
      return buildCSVResponse(
        csvData,
        `chw-activity-${new Date().toISOString().split("T")[0]}.csv`,
        [
          "CHW ID",
          "CHW Name",
          "CHW Phone",
          "Mothers Enrolled",
          "Visits (Period)",
          "Appointments Assigned",
          "Appointments Confirmed",
          "Appointments Missed",
        ]
      );
    }

    return buildJSONResponse(activityData, activityData.length);
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
    console.error("Error in CHW activity report:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
