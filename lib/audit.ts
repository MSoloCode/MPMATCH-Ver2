import { NextRequest, NextResponse } from "next/server";
import { verifyToken, UnauthorizedError } from "./auth";
import { db } from "./db";

// ============================================================================
// TYPES
// ============================================================================

export interface WriteAuditLogParams {
  actorId: number | null;
  actorRole: string;
  action: "CREATE" | "READ" | "UPDATE" | "DELETE" | "READ_SENSITIVE";
  resource: string;
  resourceId: number | null;
  changesSummary?: string | Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditMiddlewareOptions {
  action: "CREATE" | "UPDATE" | "DELETE";
  resourceName: string; // e.g., 'pregnancy', 'mother'
  getResourceId?: (responseBody: any) => number; // Extract ID from response
}

/**
 * User context extracted from JWT token.
 * Either userId or motherId will be populated depending on role.
 */
export interface AuditUser {
  userId?: number;
  motherId?: number;
  username?: string;
  phone?: string;
  role: string;
}

// ============================================================================
// AUDIT LOG WRITER
// ============================================================================

/**
 * Writes an audit log entry to the database.
 * @param params - Audit log parameters
 * @returns Promise<AuditLog> - The created audit log record
 * @throws Error if database write fails
 */
export async function writeAuditLog(
  params: WriteAuditLogParams
): Promise<any> {
  const {
    actorId,
    actorRole,
    action,
    resource,
    resourceId,
    changesSummary,
    ipAddress,
    userAgent,
  } = params;

  try {
    const auditLog = await db.auditLog.create({
      data: {
        actorId,
        actorRole,
        action,
        resource,
        resourceId,
        changesSummary:
          typeof changesSummary === "string"
            ? changesSummary
            : changesSummary
              ? JSON.stringify(changesSummary)
              : null,
        ipAddress,
        userAgent,
      },
    });

    return auditLog;
  } catch (error) {
    console.error("Failed to write audit log:", error);
    throw error;
  }
}

// ============================================================================
// AUDIT MIDDLEWARE
// ============================================================================

/**
 * Extracts Bearer token from request Authorization header.
 * @param request - Next.js Request object
 * @returns Token string or null if not found
 */
function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Extracts audit context (ipAddress, userAgent) from request headers.
 * @param request - Next.js Request object
 * @returns Object with ipAddress and userAgent
 */
function getAuditContext(request: Request): {
  ipAddress: string;
  userAgent: string;
} {
  const ipAddress =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  return { ipAddress, userAgent };
}

/**
 * Extracts user from JWT token in Authorization header.
 * @param request - Next.js Request object
 * @returns AuditUser with role and either userId or motherId
 * @throws UnauthorizedError if token is missing or invalid
 */
function extractUserFromRequest(request: Request): AuditUser {
  const token = extractBearerToken(request);
  if (!token) {
    throw new UnauthorizedError("Missing or invalid Authorization header");
  }

  try {
    const payload = verifyToken(token);
    return {
      userId: payload.userId,
      motherId: payload.motherId,
      username: payload.username,
      phone: payload.phone,
      role: payload.role,
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    throw new UnauthorizedError("Failed to verify token");
  }
}

/**
 * Higher-order function that wraps API route handlers to automatically log mutations.
 * Automatically extracts JWT, verifies user, and logs CREATE/UPDATE/DELETE actions on success.
 *
 * Usage:
 *   const handler = async (req) => {
 *     // Your handler logic
 *     return NextResponse.json({ success: true, id: 123 });
 *   };
 *
 *   export const POST = auditMiddleware({
 *     action: 'CREATE',
 *     resourceName: 'pregnancy'
 *   })(handler);
 *
 * Important:
 *   - Handler must return response with status 2xx for audit to be logged
 *   - Handler must return object with 'id' or 'data.id' property (or use getResourceId callback)
 *   - If JWT is invalid or missing, UnauthorizedError is thrown (audit NOT logged)
 *   - On error in handler, audit is NOT logged (only on successful 2xx responses)
 *
 * @param options - Audit middleware configuration
 * @returns Middleware wrapper function for Next.js route handlers
 */
export function auditMiddleware(options: AuditMiddlewareOptions) {
  return (handler: (req: NextRequest) => Promise<NextResponse>) => {
    return async (req: NextRequest): Promise<NextResponse> => {
      const { action, resourceName, getResourceId } = options;

      // Step 1: Extract and verify user from JWT
      let user: AuditUser;
      let ipAddress: string;
      let userAgent: string;

      try {
        user = extractUserFromRequest(req);
        const context = getAuditContext(req);
        ipAddress = context.ipAddress;
        userAgent = context.userAgent;
      } catch (error) {
        // Token is invalid/missing - throw immediately, don't log audit
        if (error instanceof UnauthorizedError) {
          return NextResponse.json(
            { success: false, error: error.message },
            { status: 401 }
          );
        }
        throw error;
      }

      // Step 2: Capture request body for change tracking (UPDATE actions)
      let requestBody: Record<string, any> = {};
      let clonedReq = req.clone();

      try {
        const bodyText = await clonedReq.text();
        if (bodyText) {
          requestBody = JSON.parse(bodyText);
        }
        // Create new request with body so handler can read it
        req = new NextRequest(req, { body: bodyText });
      } catch (error) {
        // Body parsing failed, continue without it
        console.warn("Failed to parse request body for audit logging:", error);
      }

      try {
        // Step 3: Execute the original handler
        const response = await handler(req);

        // Step 4: Log audit if successful (2xx status)
        if (response.status >= 200 && response.status < 300) {
          try {
            let resourceId: number | null = null;
            let responseBody: any = {};

            // Extract response body for audit logging
            try {
              const clonedResponse = response.clone();
              responseBody = await clonedResponse.json();

              if (getResourceId) {
                // Use custom extractor if provided
                resourceId = getResourceId(responseBody);
              } else {
                // Try default extraction patterns
                resourceId = responseBody.id || responseBody.data?.id;
              }
            } catch (error) {
              console.warn("Failed to extract response body:", error);
            }

            // Only write audit log if we successfully extracted a resource ID
            if (resourceId) {
              const actorId = user.userId || user.motherId || null;

              await writeAuditLog({
                actorId,
                actorRole: user.role,
                action,
                resource: resourceName,
                resourceId,
                changesSummary:
                  action === "UPDATE" ? requestBody : undefined,
                ipAddress,
                userAgent,
              });
            }
          } catch (error) {
            // Failed to extract or log - log the error but don't break the original response
            console.error(
              "Failed to write audit log after successful response:",
              error
            );
          }
        }

        return response;
      } catch (error) {
        // Handler threw an error - don't log audit on failure
        console.error("Handler error, skipping audit log:", error);
        throw error;
      }
    };
  };
}

/**
 * Helper to manually log a sensitive read (e.g., viewing full mother record, downloading documents).
 * Use this within GET or other read-only handlers to explicitly log READ_SENSITIVE actions.
 *
 * Usage:
 *   export async function GET(request: NextRequest, { params }) {
 *     const user = extractUser(request);
 *     const mother = await db.mother.findUnique({ where: { id: motherId } });
 *
 *     // Log this sensitive read explicitly
 *     await logSensitiveRead({
 *       request,
 *       user,
 *       resource: 'mother',
 *       resourceId: mother.id
 *     });
 *
 *     return NextResponse.json({ data: mother });
 *   }
 *
 * @param params - Configuration for sensitive read logging
 */
export async function logSensitiveRead(params: {
  request: Request;
  user: AuditUser;
  resource: string;
  resourceId: number;
  details?: Record<string, any>;
}): Promise<void> {
  const { request, user, resource, resourceId, details } = params;
  const { ipAddress, userAgent } = getAuditContext(request);
  const actorId = user.userId || user.motherId || null;

  try {
    await writeAuditLog({
      actorId,
      actorRole: user.role,
      action: "READ_SENSITIVE",
      resource,
      resourceId,
      changesSummary: details,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error("Failed to log sensitive read:", error);
    // Don't throw - audit logging should never break the main flow
  }
}


/**
 * Manually log any action within a route handler.
 * Use this for logging READ operations that don't fit the mutation pattern,
 * or for custom audit events not covered by auditMiddleware.
 *
 * Usage:
 *   export async function GET(request: NextRequest, { params }) {
 *     const user = extractUser(request);
 *     const pregnancy = await db.pregnancy.findUnique({ where: { id: id } });
 *
 *     // Manually log the action
 *     await logAuditAction({
 *       user,
 *       request,
 *       action: 'READ_SENSITIVE',
 *       resource: 'pregnancy',
 *       resourceId: pregnancy.id,
 *       details: { visitCount: pregnancy.visits?.length }
 *     });
 *
 *     return NextResponse.json({ data: pregnancy });
 *   }
 *
 * @param params - Configuration for manual audit logging
 */
export async function logAuditAction(params: {
  user: AuditUser;
  request: Request;
  action: "CREATE" | "READ" | "UPDATE" | "DELETE" | "READ_SENSITIVE";
  resource: string;
  resourceId: number;
  details?: Record<string, any>;
}): Promise<void> {
  const { user, request, action, resource, resourceId, details } = params;
  const { ipAddress, userAgent } = getAuditContext(request);
  const actorId = user.userId || user.motherId || null;

  try {
    await writeAuditLog({
      actorId,
      actorRole: user.role,
      action,
      resource,
      resourceId,
      changesSummary: details,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error("Failed to log audit action:", error);
    // Don't throw - audit logging should never break the main flow
  }
}

// Re-export getAuditContext for use in handlers that need it directly
export function extractAuditContext(request: Request): {
  ipAddress: string;
  userAgent: string;
} {
  return getAuditContext(request);
}

// ============================================================================
// INTEGRATION EXAMPLES & PATTERNS
// ============================================================================

/**
 * EXAMPLE 1: Wrapping a POST handler with auditMiddleware
 *
 *   // app/api/pregnancies/route.ts
 *   import { auditMiddleware } from '@/lib/audit';
 *   import { extractUser } from '@/lib/rbac';
 *
 *   const createPregnancy = async (request: NextRequest) => {
 *     const user = extractUser(request); // Extract user from JWT
 *     const data = await request.json();
 *
 *     const pregnancy = await db.pregnancy.create({
 *       data: {
 *         ...data,
 *         motherName: user.username,
 *       },
 *     });
 *
 *     return NextResponse.json({
 *       success: true,
 *       id: pregnancy.id,
 *       data: pregnancy
 *     }, { status: 201 });
 *   };
 *
 *   // Wrap with auditMiddleware - automatically logs CREATE action
 *   export const POST = auditMiddleware({
 *     action: 'CREATE',
 *     resourceName: 'pregnancy'
 *   })(createPregnancy);
 */

/**
 * EXAMPLE 2: Manual READ_SENSITIVE logging in a GET handler
 *
 *   export async function GET(request: NextRequest, { params }) {
 *     const user = extractUser(request);
 *     const { id } = await params;
 *     const motherId = parseInt(id, 10);
 *
 *     const mother = await db.mother.findUnique({
 *       where: { id: motherId },
 *       include: { pregnancies: true, medicalHistory: true }
 *     });
 *
 *     // Log this sensitive read explicitly (viewing full record with history)
 *     await logSensitiveRead({
 *       request,
 *       user,
 *       resource: 'mother',
 *       resourceId: motherId,
 *       details: { includedMedicalHistory: true, pregnancyCount: mother.pregnancies.length }
 *     });
 *
 *     return NextResponse.json({ success: true, data: mother });
 *   }
 */

/**
 * EXAMPLE 3: Wrapping a PATCH handler with custom resourceId extractor
 *
 *   const updateAppointment = async (request: NextRequest, { params }) => {
 *     const user = extractUser(request);
 *     const { id } = await params;
 *     const appointmentId = parseInt(id, 10);
 *     const updates = await request.json();
 *
 *     const appointment = await db.appointment.update({
 *       where: { id: appointmentId },
 *       data: updates
 *     });
 *
 *     return NextResponse.json({
 *       success: true,
 *       appointment
 *     });
 *   };
 *
 *   export const PATCH = auditMiddleware({
 *     action: 'UPDATE',
 *     resourceName: 'appointment',
 *     getResourceId: (response) => response.appointment.id // Custom extractor
 *   })(updateAppointment);
 */

/**
 * EXAMPLE 4: DELETE handler with auditMiddleware
 *
 *   const deleteReferral = async (request: NextRequest, { params }) => {
 *     const user = extractUser(request);
 *     const { id } = await params;
 *     const referralId = parseInt(id, 10);
 *
 *     await db.referral.delete({
 *       where: { id: referralId }
 *     });
 *
 *     return NextResponse.json({
 *       success: true,
 *       id: referralId
 *     });
 *   };
 *
 *   export const DELETE = auditMiddleware({
 *     action: 'DELETE',
 *     resourceName: 'referral'
 *   })(deleteReferral);
 */
