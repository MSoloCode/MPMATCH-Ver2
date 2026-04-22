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
  calculateResponseHours,
  formatHours,
} from "@/lib/report-queries";

/**
 * GET /api/reports/alert-response-times
 * Alert response times report - measures time from alert creation to closure
 *
 * Query parameters:
 * - from: ISO date string (YYYY-MM-DD), defaults to 30 days ago
 * - to: ISO date string (YYYY-MM-DD), defaults to today
 * - format: json or csv (default: json)
 *
 * Allowed roles: HOSPITAL_ADMIN, DHO, DOCTOR, NURSE, ORG_ADMIN, SYSTEM_ADMIN
 *
 * Response (JSON):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "alertType": "HIGH_RISK_BP",
 *       "count": 45,
 *       "avgResponseHours": 2.5,
 *       "minResponseHours": 0.1,
 *       "maxResponseHours": 24.0,
 *       "avgResponseFormatted": "2.5 hrs",
 *       "minResponseFormatted": "6 min",
 *       "maxResponseFormatted": "1.0 days"
 *     }
 *   ],
 *   "pagination": { "total": 4, "returned": 4 }
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
      "DOCTOR",
      "NURSE",
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

    // 7. Query alerts that have been closed (have closedAt date)
    const closedAlerts = await db.alert.findMany({
      where: {
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
        closedAt: {
          not: null, // Only closed alerts
        },
        pregnancy: {
          mother: scopeFilter,
        },
      },
      select: {
        id: true,
        type: true,
        createdAt: true,
        closedAt: true,
      },
    });

    // 8. Calculate response times by alert type
    interface AlertTypeStats {
      alertType: string;
      count: number;
      responseTimes: number[];
      totalHours: number;
    }

    const alertStatsMap = new Map<string, AlertTypeStats>();

    closedAlerts.forEach((alert) => {
      const alertType = alert.type || "UNKNOWN";
      const responseHours = calculateResponseHours(
        alert.createdAt,
        alert.closedAt!
      );

      if (!alertStatsMap.has(alertType)) {
        alertStatsMap.set(alertType, {
          alertType,
          count: 0,
          responseTimes: [],
          totalHours: 0,
        });
      }

      const stats = alertStatsMap.get(alertType)!;
      stats.count += 1;
      stats.responseTimes.push(responseHours);
      stats.totalHours += responseHours;
    });

    // 9. Format report data
    const reportData = Array.from(alertStatsMap.values())
      .map((stats) => {
        const avgHours = stats.totalHours / stats.count;
        const minHours = Math.min(...stats.responseTimes);
        const maxHours = Math.max(...stats.responseTimes);

        return {
          alertType: stats.alertType,
          count: stats.count,
          avgResponseHours: Math.round(avgHours * 100) / 100,
          minResponseHours: Math.round(minHours * 100) / 100,
          maxResponseHours: Math.round(maxHours * 100) / 100,
          avgResponseFormatted: formatHours(avgHours),
          minResponseFormatted: formatHours(minHours),
          maxResponseFormatted: formatHours(maxHours),
        };
      })
      .sort((a, b) => a.alertType.localeCompare(b.alertType));

    // 10. Return appropriate format
    if (format === "csv") {
      const csvData = reportData.map((row) => ({
        "Alert Type": row.alertType,
        "Count": row.count,
        "Avg Response (hours)": row.avgResponseHours,
        "Min Response (hours)": row.minResponseHours,
        "Max Response (hours)": row.maxResponseHours,
        "Avg Response": row.avgResponseFormatted,
        "Min Response": row.minResponseFormatted,
        "Max Response": row.maxResponseFormatted,
      }));
      return buildCSVResponse(
        csvData,
        `alert-response-times-${new Date().toISOString().split("T")[0]}.csv`,
        [
          "Alert Type",
          "Count",
          "Avg Response (hours)",
          "Min Response (hours)",
          "Max Response (hours)",
          "Avg Response",
          "Min Response",
          "Max Response",
        ]
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
    console.error("Error in alert response times report:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
