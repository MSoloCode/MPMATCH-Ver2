/**
 * Utility functions for formatting appointment data
 */

import { AppointmentStatus } from '@/types';
import { format, parseISO } from 'date-fns';

/**
 * Get human-readable status display label
 */
export function getStatusDisplay(status: AppointmentStatus): string {
  const statusMap: Record<AppointmentStatus, string> = {
    SCHEDULED: 'Scheduled',
    CONFIRMED: 'Confirmed',
    ATTENDED: 'Attended',
    MISSED: 'Missed',
    LIKELY_MISSED: 'Likely Missed',
    CANCELLED: 'Cancelled',
  };
  return statusMap[status] || status;
}

/**
 * Get Tailwind CSS classes for status badge background and text colors
 */
export function getStatusColor(status: AppointmentStatus): {
  bg: string;
  text: string;
  border: string;
} {
  const colorMap: Record<
    AppointmentStatus,
    { bg: string; text: string; border: string }
  > = {
    SCHEDULED: {
      bg: 'bg-blue-50',
      text: 'text-blue-900',
      border: 'border-blue-200',
    },
    CONFIRMED: {
      bg: 'bg-green-50',
      text: 'text-green-900',
      border: 'border-green-200',
    },
    ATTENDED: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-900',
      border: 'border-emerald-200',
    },
    MISSED: {
      bg: 'bg-red-50',
      text: 'text-red-900',
      border: 'border-red-200',
    },
    LIKELY_MISSED: {
      bg: 'bg-orange-50',
      text: 'text-orange-900',
      border: 'border-orange-200',
    },
    CANCELLED: {
      bg: 'bg-gray-50',
      text: 'text-gray-900',
      border: 'border-gray-200',
    },
  };
  return colorMap[status] || colorMap.SCHEDULED;
}

/**
 * Get outcome display for past appointments table
 * Maps appointment status to attendance outcome
 */
export function getOutcomeDisplay(status: AppointmentStatus): string {
  if (status === 'ATTENDED' || status === 'CONFIRMED') {
    return 'Yes';
  }
  if (status === 'MISSED' || status === 'CANCELLED') {
    return 'No';
  }
  return 'Unknown';
}

/**
 * Format appointment date and time for display
 * Example: "Apr 20, 2026 10:00 AM"
 */
export function formatAppointmentDateTime(dateTime: string | Date): string {
  try {
    const date = typeof dateTime === 'string' ? parseISO(dateTime) : dateTime;
    return format(date, 'MMM d, yyyy h:mm a');
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format appointment date only (no time)
 * Example: "Apr 20, 2026"
 */
export function formatAppointmentDate(dateTime: string | Date): string {
  try {
    const date = typeof dateTime === 'string' ? parseISO(dateTime) : dateTime;
    return format(date, 'MMM d, yyyy');
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format appointment time only
 * Example: "10:00 AM"
 */
export function formatAppointmentTime(dateTime: string | Date): string {
  try {
    const date = typeof dateTime === 'string' ? parseISO(dateTime) : dateTime;
    return format(date, 'h:mm a');
  } catch {
    return 'Invalid time';
  }
}

/**
 * Check if appointment is likely missed
 * Returns true if status is LIKELY_MISSED
 */
export function isLikelyMissed(status: AppointmentStatus): boolean {
  return status === 'LIKELY_MISSED';
}

/**
 * Check if appointment can be rescheduled
 * Can only reschedule SCHEDULED or CONFIRMED appointments
 */
export function canReschedule(status: AppointmentStatus): boolean {
  return status === 'SCHEDULED' || status === 'CONFIRMED';
}

/**
 * Check if appointment can be marked attended
 * Only SCHEDULED or CONFIRMED can transition to ATTENDED
 */
export function canMarkAttended(status: AppointmentStatus): boolean {
  return status === 'SCHEDULED' || status === 'CONFIRMED';
}

/**
 * Check if appointment can be marked missed
 * Only SCHEDULED or CONFIRMED can transition to MISSED
 */
export function canMarkMissed(status: AppointmentStatus): boolean {
  return status === 'SCHEDULED' || status === 'CONFIRMED';
}

/**
 * Get human-readable appointment purpose display
 */
export function getPurposeDisplay(purpose: string): string {
  const purposeMap: Record<string, string> = {
    ROUTINE: 'Routine Checkup',
    SCANNING: 'Scanning',
    REVIEW: 'Review',
    OTHER: 'Other',
  };
  return purposeMap[purpose] || purpose;
}

/**
 * Format created date for display in tables
 * Example: "Apr 20, 2026"
 */
export function formatCreatedDate(dateTime: string | Date): string {
  try {
    const date = typeof dateTime === 'string' ? parseISO(dateTime) : dateTime;
    return format(date, 'MMM d, yyyy');
  } catch {
    return 'Unknown';
  }
}
