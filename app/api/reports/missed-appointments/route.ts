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
  formatDate,
} from "@/lib/report-queries";

/**
 * GET /api/reports/missed-appointments
 * Missed appointments report - lists appointments with MISSED or LIKELY_MISSED status
 *
 * Query parameters:
 * - from: ISO date string (YYYY-MM-DD), defaults to 30 days ago
 * - to: ISO date string (YYYY-MM-DD), defaults to today
 * - format: json or csv (default: json)
 *
 * Allowed roles: HOSPITAL_ADMIN, DOCTOR, NURSE, CHW, DHO, ORG_ADMIN, SYSTEM_ADMIN
 *
 * Response (JSON):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "appointmentId": 42,
 *       "motherName": "Jane Doe",
 *       "motherPhone": "+256701234567",
 *       "scheduledDate": "2026-04-15",
 *       "appointmentStatus": "MISSED",
 *       "assignedCHW": "John CHW",
 *       "notes": "Mother not found at home"
 *     }
 *   ],
 *   "pagination": { "total": 25, "returned": 25 }
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
      "NURSE",
      "CHW",
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

    // 7. Query missed appointments
    const missedAppointments = await db.appointment.findMany({
      where: {
        appointmentDateTime: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
        status: {
          in: ["MISSED", "LIKELY_MISSED"],
        },
        mother: scopeFilter,
      },
      include: {
        mother: true,
        assignedCHW: {
          select: {
            name: true,
            phone: true,
          },
        },
        pregnancy: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { appointmentDateTime: "desc" },
    });

    // 8. Format report data
    const reportData = missedAppointments.map((appointment) => ({
      appointmentId: appointment.id,
      motherName: appointment.mother.fullName,
      motherPhone: appointment.mother.phone || "N/A",
      scheduledDate: formatDate(appointment.appointmentDateTime),
      appointmentStatus: appointment.status,
      assignedCHW: appointment.assignedCHW?.name || "Not assigned",
      assignedCHWPhone: appointment.assignedCHW?.phone || "N/A",
      notes: appointment.notes || "No notes",
    }));

    // 9. Return appropriate format
    if (format === "csv") {
      const csvData = reportData.map((row) => ({
        "Appointment ID": row.appointmentId,
        "Mother Name": row.motherName,
        "Mother Phone": row.motherPhone,
        "Scheduled Date": row.scheduledDate,
        "Status": row.appointmentStatus,
        "Assigned CHW": row.assignedCHW,
        "CHW Phone": row.assignedCHWPhone,
        "Notes": row.notes,
      }));
      return buildCSVResponse(
        csvData,
        `missed-appointments-${new Date().toISOString().split("T")[0]}.csv`,
        [
          "Appointment ID",
          "Mother Name",
          "Mother Phone",
          "Scheduled Date",
          "Status",
          "Assigned CHW",
          "CHW Phone",
          "Notes",
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
    console.error("Error in missed appointments report:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
