import { NextResponse } from "next/server";
import { db } from "./db";
import { ScopedUserPayload } from "./rbac";

/**
 * Report Query Utilities
 * Shared functions for building report queries with filtering, scoping, and CSV exports
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ReportDateRange {
  from: Date;
  to: Date;
}

export interface ReportDataRow {
  [key: string]: any;
}

// ============================================================================
// QUERY BUILDERS
// ============================================================================

/**
 * Parse and validate date range from query parameters
 * @param fromParam - ISO date string or null
 * @param toParam - ISO date string or null
 * @param defaultDays - Number of days to look back if dates not provided (default: 30)
 * @returns { from, to } as Date objects
 * @throws Error if dates are invalid or from > to
 */
export function parseDateRange(
  fromParam: string | null,
  toParam: string | null,
  defaultDays: number = 30
): ReportDateRange {
  let from: Date;
  let to: Date;

  if (fromParam && toParam) {
    from = new Date(fromParam);
    to = new Date(toParam);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new Error("Invalid date format. Use ISO 8601 format (YYYY-MM-DD)");
    }

    if (from > to) {
      throw new Error("from date cannot be after to date");
    }
  } else {
    // Default: last N days
    to = new Date();
    to.setHours(23, 59, 59, 999);

    from = new Date(to);
    from.setDate(from.getDate() - defaultDays);
    from.setHours(0, 0, 0, 0);
  }

  return { from, to };
}

/**
 * Build a scoped WHERE clause for Mother data
 * Combines tenant scoping with custom filters
 */
export function buildMotherFilter(
  scopeFilter: Record<string, any>,
  customFilters?: {
    districtId?: number;
    facilityId?: number;
    chwId?: number;
  }
) {
  const where: any = { ...scopeFilter };

  if (customFilters?.districtId) {
    where.districtId = customFilters.districtId;
  }
  if (customFilters?.facilityId) {
    where.facilityId = customFilters.facilityId;
  }
  if (customFilters?.chwId) {
    where.chwId = customFilters.chwId;
  }

  return where;
}

/**
 * Build a scoped WHERE clause for Pregnancy data
 * Combines tenant scoping (via mother) with custom filters
 */
export function buildPregnancyFilter(
  scopeFilter: Record<string, any>,
  customFilters?: {
    isHighRisk?: boolean;
    status?: string;
  }
) {
  const where: any = {
    mother: {
      ...scopeFilter,
    },
  };

  if (customFilters?.isHighRisk !== undefined) {
    where.isHighRisk = customFilters.isHighRisk;
  }
  if (customFilters?.status) {
    where.status = customFilters.status;
  }

  return where;
}

/**
 * Build a scoped WHERE clause for Alert data
 * Combines tenant scoping (via pregnancy/mother) with custom filters
 */
export function buildAlertFilter(
  scopeFilter: Record<string, any>,
  customFilters?: {
    type?: string;
    status?: string;
    dateRange?: ReportDateRange;
  }
) {
  const where: any = {
    pregnancy: {
      mother: {
        ...scopeFilter,
      },
    },
  };

  if (customFilters?.type) {
    where.type = customFilters.type;
  }
  if (customFilters?.status) {
    where.status = customFilters.status;
  }
  if (customFilters?.dateRange) {
    where.createdAt = {
      gte: customFilters.dateRange.from,
      lte: customFilters.dateRange.to,
    };
  }

  return where;
}

/**
 * Build a scoped WHERE clause for AncVisit data
 * Combines tenant scoping (via mother) with custom filters
 */
export function buildAncVisitFilter(
  scopeFilter: Record<string, any>,
  customFilters?: {
    dateRange?: ReportDateRange;
    facilityId?: number;
  }
) {
  const where: any = {
    mother: {
      ...scopeFilter,
    },
  };

  if (customFilters?.dateRange) {
    where.visitDateTime = {
      gte: customFilters.dateRange.from,
      lte: customFilters.dateRange.to,
    };
  }
  if (customFilters?.facilityId) {
    where.mother.facilityId = customFilters.facilityId;
  }

  return where;
}

/**
 * Build a scoped WHERE clause for Appointment data
 * Combines tenant scoping (via mother) with custom filters
 */
export function buildAppointmentFilter(
  scopeFilter: Record<string, any>,
  customFilters?: {
    dateRange?: ReportDateRange;
    status?: string[];
  }
) {
  const where: any = {
    mother: {
      ...scopeFilter,
    },
  };

  if (customFilters?.dateRange) {
    where.appointmentDateTime = {
      gte: customFilters.dateRange.from,
      lte: customFilters.dateRange.to,
    };
  }
  if (customFilters?.status && customFilters.status.length > 0) {
    where.status = {
      in: customFilters.status,
    };
  }

  return where;
}

// ============================================================================
// CSV GENERATION
// ============================================================================

/**
 * Convert report data array to CSV string
 * Handles proper escaping and formatting of all data types
 */
export function convertDataToCSV(
  data: ReportDataRow[],
  columns?: string[]
): string {
  if (!data || data.length === 0) {
    return "";
  }

  // Determine columns from first row if not provided
  const headers = columns || Object.keys(data[0]);

  // Create header row
  const headerRow = headers.map((h) => escapeCSVField(h)).join(",");

  // Create data rows
  const dataRows = data.map((row) =>
    headers
      .map((header) => {
        const value = row[header];
        return escapeCSVField(formatCSVValue(value));
      })
      .join(",")
  );

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Escape CSV field values (handle quotes, commas, newlines)
 */
function escapeCSVField(field: any): string {
  if (field === null || field === undefined) {
    return "";
  }

  const str = String(field);

  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Format value for CSV output
 */
function formatCSVValue(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return value.join("; ");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    // Format numbers with 2 decimal places if they have decimals
    if (Number.isInteger(value)) {
      return String(value);
    }
    return Number(value).toFixed(2);
  }
  return String(value);
}

/**
 * Build NextResponse for CSV export
 * Sets proper headers for browser download
 */
export function buildCSVResponse(
  data: ReportDataRow[],
  filename: string,
  columns?: string[]
): NextResponse {
  const csv = convertDataToCSV(data, columns);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

/**
 * Build NextResponse for JSON export with pagination
 */
export function buildJSONResponse(
  data: ReportDataRow[],
  total: number,
  message?: string
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      pagination: {
        total,
        returned: data.length,
      },
      ...(message && { message }),
    },
    { status: 200 }
  );
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format hours to readable string
 */
export function formatHours(hours: number): string {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes} min`;
  }
  if (hours < 24) {
    return `${hours.toFixed(1)} hrs`;
  }
  const days = (hours / 24).toFixed(1);
  return `${days} days`;
}

/**
 * Parse JSON string safely
 */
export function parseJSON<T>(jsonStr: string | null, fallback: T): T {
  if (!jsonStr) return fallback;
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return fallback;
  }
}

/**
 * Calculate attendance percentage
 */
export function calculateAttendancePercentage(
  visitCount: number,
  totalCount: number
): number {
  if (totalCount === 0) return 0;
  return Math.round((visitCount / totalCount) * 10000) / 100;
}

/**
 * Format date for display
 */
export function formatDate(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().split("T")[0];
}

/**
 * Calculate response time in hours between two dates
 */
export function calculateResponseHours(from: Date, to: Date): number {
  const diffMs = to.getTime() - from.getTime();
  return diffMs / (1000 * 60 * 60);
}
