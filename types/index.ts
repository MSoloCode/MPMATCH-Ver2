/**
 * Shared TypeScript types and enums for the application
 */

export type ID = string | number;

export interface User {
  id: ID;
  email: string;
  name?: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export enum AlertType {
  SMS = 'sms',
  EMAIL = 'email',
  PUSH = 'push',
}

export enum AlertStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  DELIVERED = 'delivered',
}

export interface Alert {
  id: ID;
  userId: ID;
  type: AlertType;
  status: AlertStatus;
  message: string;
  recipient: string;
  createdAt: Date;
  sentAt?: Date;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: Date;
}

export interface AuditLog {
  id: ID;
  userId: ID;
  action: string;
  resource: string;
  resourceId: ID;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// ============================================================================
// CONNECTIVITY & EMERGENCY ALERT TYPES
// ============================================================================

export interface EmergencyNumbers {
  emergencyLine?: string;
  ambulance?: string;
  onCall?: string;
  backup?: string;
}

export interface FacilityListItem {
  id: number;
  name: string;
  districtId: number;
  countryId: number;
}

export interface EmergencyAlertRequest {
  phoneNumber: string;
  facilityId?: number;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

export interface EmergencyAlertResponse {
  success: boolean;
  message: string;
  alertId?: number;
  error?: string;
}
