/**
 * Role-based dashboard route mapping
 * Maps user roles to their dashboard paths after login
 */

export type UserRole =
  | 'SYSTEM_ADMIN'
  | 'HOSPITAL_ADMIN'
  | 'ORG_ADMIN'
  | 'DHO'
  | 'DOCTOR'
  | 'MIDWIFE'
  | 'NURSE'
  | 'CHW'
  | 'AMBULANCE_MANAGER'
  | 'COMMUNITY_USER';

/**
 * Maps each role to its primary dashboard route
 */
export const ROLE_TO_DASHBOARD: Record<UserRole, string> = {
  SYSTEM_ADMIN: '/admin/dashboard',
  HOSPITAL_ADMIN: '/hospital/dashboard',
  ORG_ADMIN: '/org/dashboard',
  DHO: '/dho/dashboard',
  DOCTOR: '/clinical/doctor',
  MIDWIFE: '/clinical/midwife',
  NURSE: '/clinical/nurse',
  CHW: '/chw/dashboard',
  AMBULANCE_MANAGER: '/ambulance/dashboard',
  COMMUNITY_USER: '/community/dashboard',
};

/**
 * Maps dashboard routes to allowed roles
 * A route can be accessed by multiple roles if needed
 */
export const DASHBOARD_ROLES: Record<string, UserRole[]> = {
  '/admin/dashboard': ['SYSTEM_ADMIN'],
  '/hospital/dashboard': ['HOSPITAL_ADMIN'],
  '/org/dashboard': ['ORG_ADMIN'],
  '/dho/dashboard': ['DHO'],
  '/clinical/doctor': ['DOCTOR'],
  '/clinical/midwife': ['MIDWIFE'],
  '/clinical/nurse': ['NURSE'],
  '/chw/dashboard': ['CHW'],
  '/ambulance/dashboard': ['AMBULANCE_MANAGER'],
  '/community/dashboard': ['COMMUNITY_USER'],
};

/**
 * Get the primary dashboard for a user role
 * @param role - User's role
 * @returns Dashboard path or null if role is invalid
 */
export function getDashboardForRole(role: string): string | null {
  const userRole = role as UserRole;
  return ROLE_TO_DASHBOARD[userRole] || null;
}

/**
 * Check if a role is allowed to access a dashboard route
 * @param role - User's role
 * @param dashboardPath - Dashboard path to check
 * @returns true if role is authorized for that dashboard
 */
export function isRoleAuthorized(role: string, dashboardPath: string): boolean {
  const allowedRoles = DASHBOARD_ROLES[dashboardPath];
  if (!allowedRoles) {
    return false;
  }
  return allowedRoles.includes(role as UserRole);
}

/**
 * Get all dashboard paths that a role can access
 * @param role - User's role
 * @returns Array of accessible dashboard paths
 */
export function getAccessibleDashboards(role: string): string[] {
  const userRole = role as UserRole;
  return Object.entries(DASHBOARD_ROLES)
    .filter(([_, roles]) => roles.includes(userRole))
    .map(([path, _]) => path);
}
