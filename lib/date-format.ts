/**
 * Date formatting utilities for consistent date/time display across the application
 */

/**
 * Format a date as M/D/YYYY, H:MM:SS AM/PM
 * Returns "---" if the date is null, undefined, or invalid
 * @param date - The date to format (Date object, ISO string, or null/undefined)
 * @returns Formatted date string or "---"
 */
export function formatVisitDateTime(date: Date | string | null | undefined): string {
  if (!date) {
    return '---';
  }

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    // Validate the date
    if (isNaN(dateObj.getTime())) {
      return '---';
    }

    // Format: M/D/YYYY
    const month = dateObj.getMonth() + 1; // getMonth() returns 0-11
    const day = dateObj.getDate();
    const year = dateObj.getFullYear();

    // Format: H:MM:SS AM/PM
    let hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const seconds = dateObj.getSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';

    // Convert to 12-hour format
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12

    // Pad minutes and seconds to 2 digits
    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(seconds).padStart(2, '0');

    return `${month}/${day}/${year}, ${hours}:${paddedMinutes}:${paddedSeconds} ${ampm}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '---';
  }
}

/**
 * Format a date as M/D/YYYY only (no time)
 * Returns "---" if the date is null, undefined, or invalid
 * @param date - The date to format
 * @returns Formatted date string or "---"
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) {
    return '---';
  }

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return '---';
    }

    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const year = dateObj.getFullYear();

    return `${month}/${day}/${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '---';
  }
}
