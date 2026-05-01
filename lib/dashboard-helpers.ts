/**
 * Dashboard Helper Functions
 * Provides role-specific data filtering and context for dashboard implementations
 *
 * This helps ensure that when a user signs in, their dashboard shows only
 * information relevant to their role and assigned scope.
 */

import { db } from '@/lib/db';

export interface ScopedUserPayload {
  id?: number;
  userId?: number;
  motherId?: number;
  role: string;
  hospitalId?: number;
  districtId?: number;
  countryId?: number;
  phone?: string;
  [key: string]: any;
}

/**
 * Dashboard Context - Contains user's role-specific information for filtering
 */
export interface DashboardContext {
  userId: number | null;
  motherId: number | null;
  role: string;
  hospitalId: number | null;
  districtId: number | null;
  displayName: string;
}

/**
 * Extract dashboard context from user payload
 * Returns minimal, normalized data needed for filtering dashboard queries
 */
export function extractDashboardContext(user: ScopedUserPayload): DashboardContext {
  return {
    userId: user.userId || user.id || null,
    motherId: user.motherId || null,
    role: user.role,
    hospitalId: user.hospitalId || null,
    districtId: user.districtId || null,
    displayName: user.username || user.phone || 'User',
  };
}

/**
 * Get data visibility rules based on user role
 * Determines what type of data the user should see in their dashboard
 */
export function getDataVisibilityRules(role: string): {
  canSeeMothers: 'own' | 'hospital' | 'district' | 'all';
  canSeeAppointments: 'own' | 'hospital' | 'district' | 'all';
  canSeeAlerts: 'own' | 'hospital' | 'district' | 'all';
  canSeeGlobalStats: boolean;
  canSeeStaff: boolean;
  canSeeReports: boolean;
} {
  switch (role) {
    // Community User (Mother) - Can only see their own data
    case 'COMMUNITY_USER':
      return {
        canSeeMothers: 'own',
        canSeeAppointments: 'own',
        canSeeAlerts: 'own',
        canSeeGlobalStats: false,
        canSeeStaff: false,
        canSeeReports: false,
      };

    // CHW - Can see mothers in their district/facility
    case 'CHW':
      return {
        canSeeMothers: 'district',
        canSeeAppointments: 'district',
        canSeeAlerts: 'district',
        canSeeGlobalStats: false,
        canSeeStaff: false,
        canSeeReports: false,
      };

    // AMBULANCE_MANAGER - Can see mothers/alerts in their district
    case 'AMBULANCE_MANAGER':
      return {
        canSeeMothers: 'district',
        canSeeAppointments: 'district',
        canSeeAlerts: 'district',
        canSeeGlobalStats: false,
        canSeeStaff: false,
        canSeeReports: false,
      };

    // Clinical staff (DOCTOR, NURSE, MIDWIFE) - Can see hospital scope
    case 'DOCTOR':
    case 'NURSE':
    case 'MIDWIFE':
      return {
        canSeeMothers: 'hospital',
        canSeeAppointments: 'hospital',
        canSeeAlerts: 'hospital',
        canSeeGlobalStats: false,
        canSeeStaff: true,
        canSeeReports: true,
      };

    // DHO (District Health Officer) - Can see all district data + statistics
    case 'DHO':
      return {
        canSeeMothers: 'district',
        canSeeAppointments: 'district',
        canSeeAlerts: 'district',
        canSeeGlobalStats: true,
        canSeeStaff: true,
        canSeeReports: true,
      };

    // ORG_ADMIN - Can see organization scope
    case 'ORG_ADMIN':
      return {
        canSeeMothers: 'district',
        canSeeAppointments: 'district',
        canSeeAlerts: 'district',
        canSeeGlobalStats: true,
        canSeeStaff: true,
        canSeeReports: true,
      };

    // HOSPITAL_ADMIN - Can see all hospital data + statistics
    case 'HOSPITAL_ADMIN':
      return {
        canSeeMothers: 'hospital',
        canSeeAppointments: 'hospital',
        canSeeAlerts: 'hospital',
        canSeeGlobalStats: true,
        canSeeStaff: true,
        canSeeReports: true,
      };

    // SYSTEM_ADMIN - Can see everything
    case 'SYSTEM_ADMIN':
      return {
        canSeeMothers: 'all',
        canSeeAppointments: 'all',
        canSeeAlerts: 'all',
        canSeeGlobalStats: true,
        canSeeStaff: true,
        canSeeReports: true,
      };

    default:
      return {
        canSeeMothers: 'own',
        canSeeAppointments: 'own',
        canSeeAlerts: 'own',
        canSeeGlobalStats: false,
        canSeeStaff: false,
        canSeeReports: false,
      };
  }
}

/**
 * Build Prisma where clause for mothers based on user's role and scope
 * Used in dashboard queries to filter mother records
 */
export function getMothersFilter(context: DashboardContext): Record<string, any> {
  switch (context.role) {
    // COMMUNITY_USER: Only their own mother record
    case 'COMMUNITY_USER':
      return {
        id: context.motherId || { equals: -1 }, // -1 ensures no results if motherId is null
      };

    // CHW: Mothers in assigned district
    case 'CHW':
    case 'AMBULANCE_MANAGER':
      if (!context.districtId) {
        return { id: { equals: -1 } }; // No access
      }
      return {
        facility: {
          district: {
            id: context.districtId,
          },
        },
      };

    // Clinical staff: Mothers in assigned hospital
    case 'DOCTOR':
    case 'NURSE':
    case 'MIDWIFE':
      if (!context.hospitalId) {
        return { id: { equals: -1 } }; // No access
      }
      return {
        facility: {
          hospitals: {
            some: {
              id: context.hospitalId,
            },
          },
        },
      };

    // DHO/ORG_ADMIN: Mothers in assigned district
    case 'DHO':
    case 'ORG_ADMIN':
      if (!context.districtId) {
        return { id: { equals: -1 } }; // No access
      }
      return {
        facility: {
          district: {
            id: context.districtId,
          },
        },
      };

    // HOSPITAL_ADMIN: Mothers in assigned hospital
    case 'HOSPITAL_ADMIN':
      if (!context.hospitalId) {
        return { id: { equals: -1 } }; // No access
      }
      return {
        facility: {
          hospitals: {
            some: {
              id: context.hospitalId,
            },
          },
        },
      };

    // SYSTEM_ADMIN: No filter (sees all)
    case 'SYSTEM_ADMIN':
      return {};

    default:
      return { id: { equals: -1 } }; // Default deny
  }
}

/**
 * Build Prisma where clause for appointments based on user's role
 */
export function getAppointmentsFilter(context: DashboardContext): Record<string, any> {
  switch (context.role) {
    case 'COMMUNITY_USER':
      return { motherId: context.motherId || { equals: -1 } };

    case 'CHW':
    case 'AMBULANCE_MANAGER':
      if (!context.districtId) return { id: { equals: -1 } };
      return {
        mother: {
          facility: {
            district: { id: context.districtId },
          },
        },
      };

    case 'DOCTOR':
    case 'NURSE':
    case 'MIDWIFE':
      if (!context.hospitalId) return { id: { equals: -1 } };
      return {
        mother: {
          facility: {
            hospitals: {
              some: { id: context.hospitalId },
            },
          },
        },
      };

    case 'DHO':
    case 'ORG_ADMIN':
      if (!context.districtId) return { id: { equals: -1 } };
      return {
        mother: {
          facility: {
            district: { id: context.districtId },
          },
        },
      };

    case 'HOSPITAL_ADMIN':
      if (!context.hospitalId) return { id: { equals: -1 } };
      return {
        mother: {
          facility: {
            hospitals: {
              some: { id: context.hospitalId },
            },
          },
        },
      };

    case 'SYSTEM_ADMIN':
      return {};

    default:
      return { id: { equals: -1 } };
  }
}

/**
 * Build Prisma where clause for alerts based on user's role
 */
export function getAlertsFilter(context: DashboardContext): Record<string, any> {
  switch (context.role) {
    case 'COMMUNITY_USER':
      return { motherId: context.motherId || { equals: -1 } };

    case 'CHW':
    case 'AMBULANCE_MANAGER':
      if (!context.districtId) return { id: { equals: -1 } };
      return {
        mother: {
          facility: {
            district: { id: context.districtId },
          },
        },
      };

    case 'DOCTOR':
    case 'NURSE':
    case 'MIDWIFE':
      if (!context.hospitalId) return { id: { equals: -1 } };
      return {
        mother: {
          facility: {
            hospitals: {
              some: { id: context.hospitalId },
            },
          },
        },
      };

    case 'DHO':
    case 'ORG_ADMIN':
      if (!context.districtId) return { id: { equals: -1 } };
      return {
        mother: {
          facility: {
            district: { id: context.districtId },
          },
        },
      };

    case 'HOSPITAL_ADMIN':
      if (!context.hospitalId) return { id: { equals: -1 } };
      return {
        mother: {
          facility: {
            hospitals: {
              some: { id: context.hospitalId },
            },
          },
        },
      };

    case 'SYSTEM_ADMIN':
      return {};

    default:
      return { id: { equals: -1 } };
  }
}

/**
 * Check if user can access sensitive data like clinical details
 * COMMUNITY_USER should only see their own data, not other mothers' details
 */
export function canAccessSensitiveData(
  role: string,
  resourceOwnerId: number | null,
  userContext: DashboardContext
): boolean {
  switch (role) {
    // COMMUNITY_USER can only see their own mother record's data
    case 'COMMUNITY_USER':
      return resourceOwnerId === userContext.motherId;

    // All other roles have permission (RBAC will be checked at API level)
    default:
      return true;
  }
}

/**
 * Get role-specific dashboard title/welcome message
 */
export function getDashboardTitle(role: string): string {
  switch (role) {
    case 'COMMUNITY_USER':
      return 'My Pregnancy Dashboard';
    case 'CHW':
      return 'Community Health Worker Dashboard';
    case 'AMBULANCE_MANAGER':
      return 'Ambulance Manager Dashboard';
    case 'DOCTOR':
      return 'Doctor Dashboard';
    case 'NURSE':
      return 'Nurse Dashboard';
    case 'MIDWIFE':
      return 'Midwife Dashboard';
    case 'DHO':
      return 'District Health Officer Dashboard';
    case 'ORG_ADMIN':
      return 'Organization Administrator Dashboard';
    case 'HOSPITAL_ADMIN':
      return 'Hospital Administrator Dashboard';
    case 'SYSTEM_ADMIN':
      return 'System Administrator Dashboard';
    default:
      return 'Dashboard';
  }
}

/**
 * Get role-specific description of what the user can do
 */
export function getRoleDescription(role: string): string {
  switch (role) {
    case 'COMMUNITY_USER':
      return 'View your pregnancy information, appointments, and health records.';
    case 'CHW':
      return 'Manage community mothers in your district and track health outcomes.';
    case 'AMBULANCE_MANAGER':
      return 'Coordinate ambulance services and respond to emergency alerts.';
    case 'DOCTOR':
      return 'Manage patient pregnancies, clinical records, and treatment plans.';
    case 'NURSE':
      return 'Monitor patient vitals and support clinical care.';
    case 'MIDWIFE':
      return 'Provide antenatal care and manage maternal health.';
    case 'DHO':
      return 'Oversee district health services and view district-wide analytics.';
    case 'ORG_ADMIN':
      return 'Manage organization resources and view organization-wide reports.';
    case 'HOSPITAL_ADMIN':
      return 'Administer hospital operations and manage hospital staff.';
    case 'SYSTEM_ADMIN':
      return 'System-wide administration and management.';
    default:
      return '';
  }
}
