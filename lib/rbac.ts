import { NextRequest, NextResponse } from "next/server";
import { verifyToken, ForbiddenError, UnauthorizedError } from "./auth";
import { db } from "./db";

// Re-export error classes for use in API routes
export { ForbiddenError, UnauthorizedError } from "./auth";

// ============================================================================
// TYPES
// ============================================================================

export interface AuthenticatedRequest extends NextRequest {
  user?: Record<string, any>;
}

// ============================================================================
// RBAC HELPERS
// ============================================================================

/**
 * Checks if a given role has permission to perform an action on a resource.
 * Queries the database for the role-permission mapping.
 * @param role - The user's role
 * @param resource - The resource to access (e.g., 'pregnancy', 'mother')
 * @param action - The action to perform (e.g., 'create', 'read', 'update', 'delete')
 * @returns Promise<boolean> - True if role has permission, false otherwise
 */
export async function canAccess(
  role: string,
  resource: string,
  action: string
): Promise<boolean> {
  try {
    const permission = await db.permission.findUnique({
      where: {
        resource_action: { resource, action },
      },
    });

    if (!permission) {
      return false;
    }

    const rolePermission = await db.rolePermission.findUnique({
      where: {
        role_permissionId: { role, permissionId: permission.id },
      },
    });

    return !!rolePermission;
  } catch (error) {
    console.error("Error checking access:", error);
    return false;
  }
}

/**
 * Comprehensive role-based permission map using granular resource:action format.
 * This constant defines what each role is allowed to do throughout the system.
 *
 * Format: resource:action
 * - resource: The data entity (e.g., 'mother', 'pregnancy', 'alert')
 * - action: The operation (create, read, update, delete, or combinations)
 * - read_own: Special action for COMMUNITY_USER to access only their own records
 * - create_own: Special action for COMMUNITY_USER to create resources tied to themselves
 *
 * IMPORTANT: These permissions define what API actions are allowed. Tenant scoping
 * (hospitalId, districtId filtering) is applied separately via getTenantScopingFilter().
 *
 * Example:
 *   SYSTEM_ADMIN can access all resources without tenant scoping
 *   HOSPITAL_ADMIN can CRUD clinical data but only for their own hospital (scoped by hospitalId)
 *   DOCTOR can read/update pregnancies but only in their hospital
 */
export const ROLE_PERMISSIONS: Record<string, { permissions: string[] }> = {
  // ========================================================================
  // SYSTEM_ADMIN: All countries, all hospitals, all data — unrestricted
  // ========================================================================
  SYSTEM_ADMIN: {
    permissions: [
      "*:*", // Full wildcard access to all resources and actions
    ],
  },

  // ========================================================================
  // HOSPITAL_ADMIN: Own hospital only — manage users, facilities, view all clinical data
  // ========================================================================
  HOSPITAL_ADMIN: {
    permissions: [
      // User management within hospital
      "user:create",
      "user:read",
      "user:update",
      "user:delete",
      // Clinical data management
      "pregnancy:create",
      "pregnancy:read",
      "pregnancy:update",
      "pregnancy:delete",
      "mother:create",
      "mother:read",
      "mother:update",
      "mother:delete",
      "ancvisit:create",
      "ancvisit:read",
      "ancvisit:update",
      "ancvisit:delete",
      "appointment:create",
      "appointment:read",
      "appointment:update",
      "appointment:delete",
      "alert:create",
      "alert:read",
      "alert:update",
      "alert:delete",
      // Audit and facility management
      "audit:read",
      "facility:read",
      "facility:update",
    ],
  },

  // ========================================================================
  // ORG_ADMIN: Assigned districts only (e.g. ADARA, Mildmay) — read-only reports
  // ========================================================================
  ORG_ADMIN: {
    permissions: [
      // Read-only access to clinical reports
      "pregnancy:read",
      "mother:read",
      "ancvisit:read",
      "appointment:read",
      "alert:read",
      "clinicalarchive:read",
      "referral:read",
      // Read facility and district info for reporting
      "facility:read",
      "district:read",
    ],
  },

  // ========================================================================
  // DHO: All facilities in their district — read-only reports
  // ========================================================================
  DHO: {
    permissions: [
      // Read-only access across all facilities in district
      "pregnancy:read",
      "mother:read",
      "ancvisit:read",
      "appointment:read",
      "referral:read",
      "alert:read",
      // Facility and infrastructure management info
      "facility:read",
      "district:read",
    ],
  },

  // ========================================================================
  // DOCTOR: Own hospital — full clinical data, admit patients
  // ========================================================================
  DOCTOR: {
    permissions: [
      // Full clinical data management
      "pregnancy:create",
      "pregnancy:read",
      "pregnancy:update",
      "mother:read",
      "ancvisit:create",
      "ancvisit:read",
      "ancvisit:update",
      // Appointment and referral management
      "appointment:read",
      "appointment:update",
      "referral:create",
      "referral:read",
      "referral:update",
      // Alert handling for emergencies
      "alert:create",
      "alert:read",
      "alert:update",
      // Clinical archives and supplementary data
      "clinicalarchive:create",
      "clinicalarchive:read",
      "vitals:create",
      "vitals:read",
      "symptoms:create",
      "symptoms:read",
      // View audit logs related to own hospital
      "audit:read",
    ],
  },

  // ========================================================================
  // MIDWIFE: Own hospital — full ANC clinical data
  // ========================================================================
  MIDWIFE: {
    permissions: [
      // ANC-focused clinical data
      "pregnancy:read",
      "mother:read",
      "ancvisit:create",
      "ancvisit:read",
      "ancvisit:update",
      // Vitals and symptoms
      "vitals:create",
      "vitals:read",
      "symptoms:create",
      "symptoms:read",
      // Appointment and alert interactions
      "appointment:read",
      "alert:create",
      "alert:read",
      // Clinical outcomes and referrals
      "clinicalarchive:read",
      "referral:read",
      // View audit logs
      "audit:read",
    ],
  },

  // ========================================================================
  // NURSE: Own hospital — ANC data, admissions, vitals
  // ========================================================================
  NURSE: {
    permissions: [
      // ANC data access
      "pregnancy:read",
      "mother:read",
      "ancvisit:read",
      // Vitals and symptoms recording
      "vitals:create",
      "vitals:read",
      "symptoms:read",
      // Appointment and alert viewing
      "appointment:read",
      "alert:read",
      // Clinical data viewing
      "clinicalarchive:read",
      "referral:read",
      // View audit logs
      "audit:read",
    ],
  },

  // ========================================================================
  // CHW: Own locality — community mothers, alerts, home visit records
  // ========================================================================
  CHW: {
    permissions: [
      // Community mother data
      "mother:read",
      "mother:update",
      // Pregnancy and ANC tracking
      "pregnancy:read",
      "ancvisit:read",
      // Appointment coordination
      "appointment:read",
      "appointment:update",
      // Alert creation and management
      "alert:create",
      "alert:read",
      // Symptoms and vitals for home visits
      "symptoms:create",
      "symptoms:read",
      "vitals:read",
    ],
  },

  // ========================================================================
  // AMBULANCE_MANAGER: Own jurisdiction — view and respond to alerts
  // ========================================================================
  AMBULANCE_MANAGER: {
    permissions: [
      // Alert management across ambulance jurisdiction
      "alert:read",
      "alert:update",
      // Referral viewing for transport decisions
      "referral:read",
      "facility:read",
    ],
  },

  // ========================================================================
  // COMMUNITY_USER: Own profile only — alerts, appointments, AI chat, own records
  // ========================================================================
  COMMUNITY_USER: {
    permissions: [
      // Access to own profile and data only (scoped by motherId)
      "mother:read_own",
      "mother:update_own",
      "pregnancy:read_own",
      "ancvisit:read_own",
      // Appointment interactions for own pregnancy
      "appointment:read_own",
      "appointment:create_own",
      "appointment:update_own",
      // Alert interactions
      "alert:read_own",
      "alert:create_own",
      // AI chat and health information
      "aichat:create_own",
      "aichat:read_own",
      // Clinical data viewing
      "clinicalarchive:read_own",
    ],
  },
};

// ============================================================================
// TENANT SCOPING HELPERS
// ============================================================================

/**
 * Interface for JWT payload with tenant scoping fields
 * All authenticated users should have these fields to enable proper data isolation
 */
export interface ScopedUserPayload {
  id?: number;
  userId?: number;
  motherId?: number;
  role: string;
  hospitalId?: number;
  districtId?: number;
  countryId?: number;
  [key: string]: any;
}

/**
 * Returns tenant scoping filters based on user's role and context.
 *
 * This function ensures that all Prisma queries respect tenant boundaries:
 * - SYSTEM_ADMIN: No filtering (unrestricted access to all data)
 * - HOSPITAL_ADMIN/DOCTOR/MIDWIFE/NURSE: Filter by hospitalId
 * - ORG_ADMIN/DHO/CHW: Filter by districtId
 * - AMBULANCE_MANAGER: Filter by districtId
 * - COMMUNITY_USER: Special case—filter by motherId (handled separately)
 *
 * CRITICAL: All Prisma queries in protected handlers MUST apply these filters
 * unless explicitly marked as SYSTEM_ADMIN.
 *
 * @param user - Decoded JWT payload with scoping fields
 * @returns Prisma WHERE clause object for tenant filtering
 *
 * @example
 * // In a protected API handler (DOCTOR role)
 * const user = extractUser(request);
 * const scopeFilter = getTenantScopingFilter(user);
 *
 * // Fetch all mothers visible to this doctor (filtered by hospitalId)
 * const mothers = await db.mother.findMany({
 *   where: {
 *     ...scopeFilter, // Applies { hospitalId: user.hospitalId }
 *   },
 * });
 *
 * @example
 * // For HOSPITAL_ADMIN viewing their entire hospital
 * const user = extractUser(request);
 * const scopeFilter = getTenantScopingFilter(user);
 *
 * const users = await db.user.findMany({
 *   where: {
 *     ...scopeFilter, // Applies { hospitalId: user.hospitalId }
 *   },
 * });
 *
 * @example
 * // For DHO viewing all facilities in their district
 * const user = extractUser(request);
 * const scopeFilter = getTenantScopingFilter(user);
 *
 * const facilities = await db.facility.findMany({
 *   where: {
 *     ...scopeFilter, // Applies { districtId: user.districtId }
 *   },
 * });
 *
 * @example
 * // For SYSTEM_ADMIN with no restrictions
 * const user = extractUser(request);
 * const scopeFilter = getTenantScopingFilter(user);
 *
 * const allUsers = await db.user.findMany({
 *   where: {
 *     ...scopeFilter, // Applies {} - no filtering
 *   },
 * });
 *
 * @example
 * // For COMMUNITY_USER - motherId must be handled separately
 * // because the scoping field (motherId) is not a table field on all resources
 * const user = extractUser(request);
 * const scopeFilter = getTenantScopingFilter(user);
 *
 * if (user.role === 'COMMUNITY_USER') {
 *   // COMMUNITY_USER scoping is handled per-resource based on motherId
 *   const myPregnancy = await db.pregnancy.findFirst({
 *     where: {
 *       motherId: user.motherId, // Access own pregnancy only
 *     },
 *   });
 * }
 */
export function getTenantScopingFilter(user: ScopedUserPayload): Record<string, any> {
  const role = user.role;

  // SYSTEM_ADMIN: Unrestricted access—no tenant filtering applied
  if (role === "SYSTEM_ADMIN") {
    return {};
  }

  // HOSPITAL_ADMIN, DOCTOR, MIDWIFE, NURSE: Scope by hospitalId
  // These roles work within a single hospital and can access all data in that hospital
  if (["HOSPITAL_ADMIN", "DOCTOR", "MIDWIFE", "NURSE"].includes(role)) {
    if (!user.hospitalId) {
      console.warn(
        `User with role ${role} is missing hospitalId in token payload. Returning restricted filter.`
      );
      // Return a filter that matches no records as a safety fallback
      return { id: { equals: -1 } };
    }
    return { hospitalId: user.hospitalId };
  }

  // ORG_ADMIN, DHO, CHW, AMBULANCE_MANAGER: Scope by districtId
  // These roles work at district level
  if (
    ["ORG_ADMIN", "DHO", "CHW", "AMBULANCE_MANAGER"].includes(role)
  ) {
    if (!user.districtId) {
      console.warn(
        `User with role ${role} is missing districtId in token payload. Returning restricted filter.`
      );
      // Return a filter that matches no records as a safety fallback
      return { id: { equals: -1 } };
    }
    return { districtId: user.districtId };
  }

  // COMMUNITY_USER: Special handling
  // Community users access their own records via motherId
  // This is NOT a WHERE clause filter—it's handled per-resource-query
  // See JSDoc example for pattern
  if (role === "COMMUNITY_USER") {
    // Return empty here; handlers must explicitly check motherId
    // This is a signal that special handling is needed
    return {};
  }

  // Unknown role: Deny access as safety default
  console.error(`Unknown role ${role} - denying access`);
  return { id: { equals: -1 } };
}

/**
 * Alternative helper: Extracts the primary scoping field for a role
 * @param user - Decoded JWT payload
 * @returns The scoping field name ('hospitalId', 'districtId', 'motherId') or null if unrestricted
 *
 * Useful for constructing complex WHERE clauses or logging.
 * @example
 * const scopingField = getTenantScopingField(user);
 * if (scopingField === 'hospitalId') {
 *   console.log(`User is scoped to hospital: ${user.hospitalId}`);
 * }
 */
export function getTenantScopingField(user: ScopedUserPayload): string | null {
  const role = user.role;

  if (role === "SYSTEM_ADMIN") {
    return null; // Unrestricted
  }

  if (["HOSPITAL_ADMIN", "DOCTOR", "MIDWIFE", "NURSE"].includes(role)) {
    return "hospitalId";
  }

  if (
    ["ORG_ADMIN", "DHO", "CHW", "AMBULANCE_MANAGER"].includes(role)
  ) {
    return "districtId";
  }

  if (role === "COMMUNITY_USER") {
    return "motherId";
  }

  return null;
}

/**
 * Enforces tenant scoping for authenticated requests.
 * Call this in API handlers to ensure user can only access their tenant's data.
 *
 * @param user - Decoded JWT payload
 * @throws ForbiddenError if user has invalid scoping context
 *
 * @example
 * // In a protected route handler
 * try {
 *   const user = extractUser(request);
 *   assertValidTenantScope(user);
 *   // Proceed with database queries using getTenantScopingFilter(user)
 * } catch (error) {
 *   if (error instanceof ForbiddenError) {
 *     return NextResponse.json({ success: false, error: error.message }, { status: 403 });
 *   }
 *   throw error;
 * }
 */
export function assertValidTenantScope(user: ScopedUserPayload): void {
  const role = user.role;

  // SYSTEM_ADMIN and COMMUNITY_USER have special handling; always valid
  if (role === "SYSTEM_ADMIN" || role === "COMMUNITY_USER") {
    return;
  }

  // All other roles MUST have a scoping field
  if (
    ["HOSPITAL_ADMIN", "DOCTOR", "MIDWIFE", "NURSE"].includes(role) &&
    !user.hospitalId
  ) {
    throw new ForbiddenError(
      `User with role ${role} is missing required hospitalId in token`
    );
  }

  if (
    ["ORG_ADMIN", "DHO", "CHW", "AMBULANCE_MANAGER"].includes(role) &&
    !user.districtId
  ) {
    throw new ForbiddenError(
      `User with role ${role} is missing required districtId in token`
    );
  }
}

// ============================================================================
// MIDDLEWARE FACTORY
// ============================================================================

/**
 * Middleware factory that checks if the authenticated user has one of the specified roles.
 * Extracts Bearer token from Authorization header, verifies it, and attaches user to request.
 * Returns 401 for missing/invalid token, 403 for insufficient role.
 *
 * Usage:
 *   export const middleware = requireRole('DOCTOR', 'NURSE');
 *   export const config = {
 *     matcher: '/api/pregnancies/:path*',
 *   };
 *
 * @param allowedRoles - Role(s) that are allowed to access the resource
 * @returns Middleware function for Next.js
 */
export function requireRole(...allowedRoles: string[]) {
  return async (
    request: AuthenticatedRequest,
    response: NextResponse
  ): Promise<NextResponse> => {
    try {
      // Extract Authorization header
      const authHeader = request.headers.get("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json(
          {
            success: false,
            error: "Unauthorized",
            message: "Missing or invalid Authorization header",
          },
          { status: 401 }
        );
      }

      // Extract and verify token
      const token = authHeader.substring(7); // Remove "Bearer " prefix
      let user;
      try {
        user = verifyToken(token);
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          return NextResponse.json(
            {
              success: false,
              error: "Unauthorized",
              message: error.message,
            },
            { status: 401 }
          );
        }
        throw error;
      }

      // Check if user's role is in allowed roles
      if (!allowedRoles.includes(user.role as string)) {
        return NextResponse.json(
          {
            success: false,
            error: "Forbidden",
            message: "Insufficient permissions for this resource",
          },
          { status: 403 }
        );
      }

      // Attach user to request for downstream handlers
      (request as any).user = user;

      return NextResponse.next();
    } catch (error) {
      console.error("Middleware error:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Internal Server Error",
          message: "An error occurred during authentication",
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Helper to extract Bearer token from Authorization header (for API route handlers)
 * @param request - Next.js Request object
 * @returns Token string or null
 */
export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Helper to extract and verify Bearer token, returning user or throwing error
 * @param request - Next.js Request object
 * @returns User payload from token
 * @throws UnauthorizedError if token is missing or invalid
 * @throws ForbiddenError if user role check fails
 */
export function extractUser(request: Request): Record<string, any> {
  const token = extractBearerToken(request);
  if (!token) {
    throw new UnauthorizedError("Missing or invalid Authorization header");
  }

  try {
    const user = verifyToken(token);
    return user;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    throw new UnauthorizedError("Failed to verify token");
  }
}

// ============================================================================
// IMPLEMENTATION GUIDE & USAGE PATTERNS
// ============================================================================

/**
 * COMPREHENSIVE RBAC IMPLEMENTATION GUIDE
 * ================================================================================================
 * 
 * OVERVIEW
 * --------
 * The RBAC system uses three layers of control:
 * 1. ROLE_PERMISSIONS: What actions a role is allowed to perform (resource:action)
 * 2. getTenantScopingFilter(): Data isolation based on role context (hospitalId, districtId, etc.)
 * 3. assertValidTenantScope(): Validation that user has required scoping fields
 * 
 * ROLE DEFINITIONS & DATA ACCESS SCOPE
 * =====================================
 * 
 * ┌─────────────────────┬──────────────────────┬────────────────────┐
 * │ Role                │ Scoping Field        │ CRUD Permissions   │
 * ├─────────────────────┼──────────────────────┼────────────────────┤
 * │ SYSTEM_ADMIN        │ None (unrestricted)  │ All (CRU*DELETE)   │
 * │ HOSPITAL_ADMIN      │ hospitalId           │ All for hospital   │
 * │ ORG_ADMIN           │ districtId (READ-OK) │ Read only          │
 * │ DHO                 │ districtId (READ-OK) │ Read only          │
 * │ DOCTOR              │ hospitalId           │ Create/Read/Update │
 * │ MIDWIFE             │ hospitalId           │ Create/Read/Update │
 * │ NURSE               │ hospitalId           │ Read primarily     │
 * │ CHW                 │ districtId           │ Read/Update cmty   │
 * │ AMBULANCE_MANAGER   │ districtId (READ-OK) │ Alert management   │
 * │ COMMUNITY_USER      │ motherId (special)   │ Own records only   │
 * └─────────────────────┴──────────────────────┴────────────────────┘
 * 
 * IMPLEMENTATION PATTERNS
 * =======================
 * 
 * PATTERN 1: Simple Tenant Filter in Handler
 * ───────────────────────────────────────────
 * 
 * import { extractUser, getTenantScopingFilter, assertValidTenantScope } from '@/lib/rbac';
 * 
 * export async function GET(request: NextRequest) {
 *   try {
 *     // 1. Extract user from token
 *     const user = extractUser(request);
 *     
 *     // 2. Validate that user has required scoping context
 *     assertValidTenantScope(user);
 *     
 *     // 3. Get tenant scoping filter for this user's role
 *     const scopeFilter = getTenantScopingFilter(user);
 *     
 *     // 4. Apply filter to Prisma query
 *     const pregnancies = await db.pregnancy.findMany({
 *       where: {
 *         ...scopeFilter, // Automatically applies { hospitalId: user.hospitalId } for DOCTOR
 *         status: 'ACTIVE', // Add other filters as needed
 *       },
 *     });
 *     
 *     return NextResponse.json({ success: true, data: pregnancies });
 *   } catch (error) {
 *     // Handle errors...
 *   }
 * }
 * 
 * PATTERN 2: Complex Query with OR Conditions
 * ─────────────────────────────────────────────
 * For queries with OR logic, manually apply scoping instead of spread operator:
 * 
 * const scopeFilter = getTenantScopingFilter(user);
 * const data = await db.pregnancy.findMany({
 *   where: {
 *     AND: [
 *       scopeFilter,  // Tenant scope applied first
 *       {
 *         OR: [
 *           { status: 'ACTIVE' },
 *           { isHighRisk: true },
 *         ],
 *       },
 *     ],
 *   },
 * });
 * 
 * PATTERN 3: COMMUNITY_USER Special Case
 * ──────────────────────────────────────
 * Community users need explicit motherId checks (different from tenant filtering):
 * 
 * const user = extractUser(request);
 * 
 * if (user.role === 'COMMUNITY_USER') {
 *   if (!user.motherId) {
 *     throw new UnauthorizedError('Missing motherId in token');
 *   }
 *   
 *   // Query only this user's own pregnancy
 *   const pregnancy = await db.pregnancy.findFirst({
 *     where: {
 *       motherId: user.motherId,
 *       id: pregnancyId, // From URL params
 *     },
 *   });
 *   
 *   if (!pregnancy) {
 *     return NextResponse.json({ error: 'Not found' }, { status: 404 });
 *   }
 * } else {
 *   // For other roles, apply normal tenant scoping
 *   const scopeFilter = getTenantScopingFilter(user);
 *   // ... query with scopeFilter
 * }
 * 
 * PATTERN 4: Aggregate Queries with Scoping
 * ──────────────────────────────────────────
 * Scoping works with count, aggregate, and groupBy operations:
 * 
 * const scopeFilter = getTenantScopingFilter(user);
 * const activeCount = await db.pregnancy.count({
 *   where: {
 *     ...scopeFilter,
 *     status: 'ACTIVE',
 *   },
 * });
 * 
 * const byStatus = await db.pregnancy.groupBy({
 *   by: ['status'],
 *   where: { ...scopeFilter },
 *   _count: { id: true },
 * });
 * 
 * PATTERN 5: SYSTEM_ADMIN Unrestricted Access
 * ────────────────────────────────────────────
 * SYSTEM_ADMIN returns empty {} from getTenantScopingFilter, enabling unrestricted queries:
 * 
 * const scopeFilter = getTenantScopingFilter(systemAdminUser);
 * // scopeFilter = {}
 * 
 * // This query will return ALL users across ALL hospitals/districts
 * const allUsers = await db.user.findMany({
 *   where: { ...scopeFilter },
 * });
 * 
 * PATTERN 6: Debugging Scoping Issues
 * ────────────────────────────────────
 * Use getTenantScopingField() to understand what scope is being applied:
 * 
 * const user = extractUser(request);
 * const scopingField = getTenantScopingField(user);
 * 
 * if (scopingField === 'hospitalId') {
 *   console.log(`Querying only hospital ${user.hospitalId}`);
 * } else if (scopingField === 'districtId') {
 *   console.log(`Querying only district ${user.districtId}`);
 * } else if (scopingField === null) {
 *   console.log('User has unrestricted access (SYSTEM_ADMIN)');
 * }
 * 
 * HANDLER IMPLEMENTATION CHECKLIST
 * =================================
 * 
 * PHASE 1: Critical Routes (Must Implement First)
 * These routes can cause major data breaches if not scoped:
 * 
 * ☐ GET /api/pregnancies
 *   - Used by: DOCTOR, NURSE, MIDWIFE, DHO, ORG_ADMIN, HOSPITAL_ADMIN
 *   - Scope by: hospitalId (clinic roles) or districtId (DHO/ORG_ADMIN)
 *   - Pattern: const scopeFilter = getTenantScopingFilter(user);
 * 
 * ☐ GET /api/mothers
 *   - Used by: CHW, DOCTOR, NURSE, MIDWIFE, HOSPITAL_ADMIN
 *   - Scope by: hospitalId (clinic) or districtId (CHW)
 *   - Pattern: Apply scopeFilter to findMany()
 * 
 * ☐ GET /api/ancvisits
 *   - Used by: DOCTOR, NURSE, MIDWIFE (read all), DHO (read-only)
 *   - Scope by: hospitalId (clinic) or districtId (DHO)
 *   - Pattern: const scopeFilter = getTenantScopingFilter(user);
 * 
 * ☐ GET /api/alerts
 *   - Used by: All roles (except COMMUNITY_USER uses motherId)
 *   - Scope by: hospitalId (clinic), districtId (CHW, AMBULANCE_MANAGER), or motherId (community)
 *   - Pattern: If COMMUNITY_USER, filter by motherId; else use scopeFilter
 * 
 * ☐ GET /api/appointments
 *   - Used by: All roles
 *   - Scope by: hospitalId (clinic), districtId (CHW), or motherId (community)
 *   - Pattern: Role-specific filtering required
 * 
 * PHASE 2: Secondary Routes (Medium Priority)
 * Can be implemented after Phase 1:
 * 
 * ☐ POST /api/pregnancies
 *   - Permission check: DOCTOR only
 *   - Scope check: Verify hospitalId matches user's hospitalId
 * 
 * ☐ PUT /api/pregnancies/:id
 *   - Permission check: DOCTOR or HOSPITAL_ADMIN
 *   - Scope check: Verify pregnancy belongs to user's hospital
 *   - Pattern: const scopeFilter = getTenantScopingFilter(user);
 * 
 * ☐ DELETE /api/pregnancies/:id
 *   - Permission check: HOSPITAL_ADMIN only
 *   - Scope check: Verify pregnancy belongs to hospital
 * 
 * ☐ POST /api/ancvisits
 *   - Permission check: DOCTOR, MIDWIFE, NURSE
 *   - Scope check: Verify mother belongs to user's hospital
 * 
 * ☐ POST /api/alerts
 *   - Permission check: DOCTOR, MIDWIFE, CHW, COMMUNITY_USER
 *   - Create scope: Force alerting about own resources only
 * 
 * PHASE 3: Lower Priority Routes
 * Implement after Phases 1 & 2:
 * 
 * ☐ GET /api/facilities
 *   - Scope by: hospitalId (admin of facility) or districtId (DHO)
 * 
 * ☐ GET /api/clinicalArchives
 *   - Scope by: hospitalId (clinic) or districtId (DHO)
 * 
 * ☐ GET /api/referrals
 *   - Scope by: hospitalId (clinic receiving), districtId (DHO viewing all)
 * 
 * ☐ GET /api/audit
 *   - Scope by: hospitalId (HOSPITAL_ADMIN), districtId (DHO), or unrestricted (SYSTEM_ADMIN)
 * 
 * TESTING SCOPING IMPLEMENTATION
 * ===============================
 * 
 * Unit Test Template:
 * 
 * describe('Tenant Scoping', () => {
 *   it('DOCTOR should only see pregnancies in their hospital', async () => {
 *     const doctorToken = createMockToken({
 *       userId: 1,
 *       role: 'DOCTOR',
 *       hospitalId: 5,
 *     });
 *     
 *     const response = await fetch('/api/pregnancies', {
 *       headers: { Authorization: `Bearer ${doctorToken}` },
 *     });
 *     
 *     const data = await response.json();
 *     
 *     // All pregnancies should belong to hospital 5
 *     data.forEach(pregnancy => {
 *       const mother = pregnancy.mother;
 *       expect(mother.facility.hospitalId).toBe(5);
 *     });
 *   });
 *   
 *   it('SYSTEM_ADMIN should see all pregnancies across all hospitals', async () => {
 *     const adminToken = createMockToken({
 *       userId: 1,
 *       role: 'SYSTEM_ADMIN',
 *     });
 *     
 *     const response = await fetch('/api/pregnancies', {
 *       headers: { Authorization: `Bearer ${adminToken}` },
 *     });
 *     
 *     const data = await response.json();
 *     // Should have pregnancies from multiple hospitals
 *     const hospitalIds = new Set(data.map(p => p.mother.facility.hospitalId));
 *     expect(hospitalIds.size).toBeGreaterThan(1);
 *   });
 * });
 * 
 * COMMON MISTAKES TO AVOID
 * ========================
 * 
 * ✗ WRONG: Checking role in handler logic instead of using requireRole() middleware
 *   if (user.role !== 'DOCTOR') { return 403; }
 *   → Use requireRole('DOCTOR') middleware instead for consistency
 * 
 * ✗ WRONG: Forgetting to apply scopeFilter to Prisma queries
 *   const pregnancies = await db.pregnancy.findMany();
 *   → ALWAYS add: { where: { ...getTenantScopingFilter(user), ... } }
 * 
 * ✗ WRONG: Assuming COMMUNITY_USER can be scoped like other roles
 *   // This is WRONG:
 *   const filter = getTenantScopingFilter(communityUser);
 *   await db.appointment.findMany({ where: { ...filter } });
 *   → CORRECT: Explicitly check to motherId for COMMUNITY_USER
 * 
 * ✗ WRONG: Not validating scoping fields in token
 *   const user = extractUser(request);
 *   // Could crash if hospitalId is undefined!
 *   → ALWAYS call: assertValidTenantScope(user)
 * 
 * ✗ WRONG: Scoping Pregnancy but not Mother
 *   const pregnancies = await db.pregnancy.findMany({
 *     where: { ...scopeFilter },
 *     include: { mother: true }, // ← mother NOT scoped!
 *   });
 *   → Include mother's relation and ensure mother is also visible to user
 * 
 * JWT PAYLOAD REQUIREMENTS
 * ========================
 * 
 * All auth handlers must include the following fields in JWT tokens:
 * 
 * For HOSPITAL_ADMIN, DOCTOR, MIDWIFE, NURSE:
 * {
 *   userId: number,
 *   role: string,
 *   hospitalId: number,        // ← REQUIRED
 *   districtId?: number,       // Optional
 *   countryId?: number,        // Optional
 * }
 * 
 * For ORG_ADMIN, DHO, CHW, AMBULANCE_MANAGER:
 * {
 *   userId?: number,
 *   role: string,
 *   districtId: number,        // ← REQUIRED
 *   hospitalId?: number,       // Optional
 *   countryId?: number,        // Optional
 * }
 * 
 * For COMMUNITY_USER (mothers):
 * {
 *   motherId: number,          // ← REQUIRED
 *   role: 'COMMUNITY_USER',    // ← MUST be 'COMMUNITY_USER'
 *   districtId?: number,       // Optional
 *   countryId?: number,        // Optional
 * }
 * 
 * For SYSTEM_ADMIN:
 * {
 *   userId: number,
 *   role: 'SYSTEM_ADMIN',
 *   // Scoping fields not required (unrestricted access)
 * }
 * 
 * DEBUGGING & VALIDATION
 * =======================
 * 
 * 1. To verify a token has correct scoping fields:
 *    - Decode token and check for hospitalId, districtId, motherId
 *    - Call getTenantScopingField(user) to see what scoping is applied
 *    - Call assertValidTenantScope(user) to validate; throws error if missing
 * 
 * 2. To verify queries are scoped:
 *    - Add console.log of WHERE clause before query
 *    - Verify scopeFilter is being spread into where clause
 *    - Check that results belong to expected tenant
 * 
 * 3. To test cross-tenant data isolation:
 *    - Create test data in two hospitals
 *    - Query as DOCTOR from hospital A
 *    - Verify results ONLY contain hospital A data
 *    - Try exact same query as DOCTOR from hospital B
 *    - Verify results ONLY contain hospital B data (different results)
 */
