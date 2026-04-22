/**
 * Report Utilities
 * Helper functions for report data export, filtering, and formatting
 */

/**
 * Convert report data to CSV format and trigger download
 */
export function exportReportAsCSV(
  reportType: string,
  filters: { from: string; to: string; facilityId?: string },
  data: any[],
  filename?: string
): void {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  // Flatten data for CSV
  const csvData = convertToCSV(data);

  // Create filename
  const defaultFilename =
    filename || `${reportType}_filtered_${new Date().toISOString().split('T')[0]}.csv`;

  // Create blob and download
  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', defaultFilename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Convert array of objects to CSV string
 */
function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) return '';

  // Get headers from first object
  const headers = Object.keys(data[0]);

  // Create header row
  const headerRow = headers.map((h) => `"${h}"`).join(',');

  // Create data rows
  const dataRows = data.map((row) =>
    headers
      .map((header) => {
        const value = row[header];
        // Escape quotes and wrap in quotes
        if (typeof value === 'string') {
          return `"${value.replace(/"/g, '""')}"`;
        } else if (value === null || value === undefined) {
          return '';
        } else if (typeof value === 'object') {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        } else {
          return `"${value}"`;
        }
      })
      .join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Format date range for display (e.g., "Jan 01 - Jan 31")
 */
export function formatDateRange(fromStr: string, toStr: string): string {
  try {
    const from = new Date(fromStr);
    const to = new Date(toStr);

    const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit' });

    return `${formatter.format(from)} - ${formatter.format(to)}`;
  } catch (error) {
    return `${fromStr} - ${toStr}`;
  }
}

/**
 * Calculate attendance percentage
 */
export function calculateAttendancePercentage(visitCount: number, motherCount: number): number {
  if (motherCount === 0) return 0;
  return Math.round((visitCount / motherCount) * 100 * 100) / 100;
}

/**
 * Format hours to readable string (e.g., "2.5 hours")
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
 * Get last N days as array of date strings
 */
export function getLastNDays(n: number): string[] {
  const dates: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

/**
 * Parse risk factors JSON string to array
 */
export function parseRiskFactors(riskFactorsJson: string | null): string[] {
  if (!riskFactorsJson) return [];
  try {
    return JSON.parse(riskFactorsJson);
  } catch {
    return [];
  }
}
