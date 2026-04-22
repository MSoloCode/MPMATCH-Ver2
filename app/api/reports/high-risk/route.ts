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
  buildCSVResponse,
  buildJSONResponse,
  parseJSON,
  formatDate,
} from "@/lib/report-queries";

/**
 * GET /api/reports/high-risk
 * High-risk pregnancies report
 *
 * Query parameters:
 * - status: active|closed|pending (default: active)
 * - format: json or csv (default: json)
 *
 * Status meanings:
 * - active: Pregnancy status is ONGOING (not DELIVERED or TERMINATED)
 * - closed: Pregnancy status is DELIVERED or TERMINATED
 * - pending: Pregnancies with unresolved high-risk alerts (Alert.status = OPEN)
 *
 * Allowed roles: HOSPITAL_ADMIN, DOCTOR, MIDWIFE, NURSE, DHO, ORG_ADMIN, SYSTEM_ADMIN
 *
 * Response (JSON):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "pregnancyId": 5,
 *       "motherName": "Jane Doe",
 *       "motherPhone": "+256701234567",
 *       "riskFactors": "Hypertension, Diabetes",
 *       "pregnancyStatus": "ONGOING",
 *       "lastVisitDate": "2026-04-18",
 *       "eddDate": "2026-05-20"
 *     }
 *   ],
 *   "pagination": { "total": 15, "returned": 15 }
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
    const status = searchParams.get("status") || "active";
    const format = searchParams.get("format") || "json";

    // 4. Validate status
    const validStatuses = ["active", "closed", "pending"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid status. Use: active, closed, or pending",
        },
        { status: 422 }
      );
    }

    // 5. Validate format
    if (!["json", "csv"].includes(format)) {
      return NextResponse.json(
        { success: false, error: "Invalid format. Use json or csv" },
        { status: 422 }
      );
    }

    // 6. Build scope filter
    const scopeFilter = getTenantScopingFilter(user as ScopedUserPayload);

    // 7. Query pregnancies based on status
    let pregnancies;

    if (status === "pending") {
      // Pregnancies with unresolved high-risk alerts
      pregnancies = await db.pregnancy.findMany({
        where: {
          isHighRisk: true,
          mother: scopeFilter,
          alerts: {
            some: {
              status: "OPEN",
            },
          },
        },
        include: {
          mother: true,
          ancVisits: {
            orderBy: { visitDateTime: "desc" },
            take: 1,
          },
          alerts: {
            where: { status: "OPEN" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } else if (status === "active") {
      // High-risk pregnancies that are still ongoing
      pregnancies = await db.pregnancy.findMany({
        where: {
          isHighRisk: true,
          status: "ONGOING",
          mother: scopeFilter,
        },
        include: {
          mother: true,
          ancVisits: {
            orderBy: { visitDateTime: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      // Closed pregnancies (delivered or terminated)
      pregnancies = await db.pregnancy.findMany({
        where: {
          isHighRisk: true,
          status: {
            in: ["DELIVERED", "TERMINATED"],
          },
          mother: scopeFilter,
        },
        include: {
          mother: true,
          ancVisits: {
            orderBy: { visitDateTime: "desc" },
            take: 1,
          },
        },
        orderBy: { deliveryDate: "desc" },
      });
    }

    // 8. Format report data
    const reportData = pregnancies.map((pregnancy) => ({
      pregnancyId: pregnancy.id,
      motherName: pregnancy.mother.fullName,
      motherPhone: pregnancy.mother.phone || "N/A",
      riskFactors: pregnancy.riskFactors
        ? parseJSON<string[]>(pregnancy.riskFactors, []).join(", ") || "N/A"
        : "N/A",
      pregnancyStatus: pregnancy.status,
      lastVisitDate: pregnancy.ancVisits[0]
        ? formatDate(pregnancy.ancVisits[0].visitDateTime)
        : "No visits",
      eddDate: formatDate(pregnancy.edd),
      deliveryDate:
        pregnancy.status !== "ONGOING"
          ? formatDate(pregnancy.deliveryDate)
          : "Pending",
    }));

    // 9. Return appropriate format
    if (format === "csv") {
      const csvData = reportData.map((row) => ({
        "Pregnancy ID": row.pregnancyId,
        "Mother Name": row.motherName,
        "Mother Phone": row.motherPhone,
        "Risk Factors": row.riskFactors,
        "Status": row.pregnancyStatus,
        "Last Visit": row.lastVisitDate,
        "EDD Date": row.eddDate,
        "Delivery Date": row.deliveryDate,
      }));
      return buildCSVResponse(
        csvData,
        `high-risk-${status}-${new Date().toISOString().split("T")[0]}.csv`,
        [
          "Pregnancy ID",
          "Mother Name",
          "Mother Phone",
          "Risk Factors",
          "Status",
          "Last Visit",
          "EDD Date",
          "Delivery Date",
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
    console.error("Error in high-risk report:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
