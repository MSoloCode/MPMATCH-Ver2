import { NextRequest, NextResponse } from "next/server";
import { db } from "./db";

// ============================================================================
// TYPES
// ============================================================================

export interface WriteAuditLogParams {
  actorId: number | null;
  actorRole: string;
  action: "CREATE" | "READ" | "UPDATE" | "DELETE" | "READ_SENSITIVE";
  resource: string;
  resourceId: number;
  changesSummary?: string | Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditMiddlewareOptions {
  action: "CREATE" | "UPDATE" | "DELETE" | "READ_SENSITIVE";
  resourceName: string; // e.g., 'pregnancy', 'mother'
  getResourceId?: (responseBody: any) => number; // Extract ID from response
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
 * Higher-order function that wraps API route handlers to automatically log mutations.
 * Captures request context and logs CREATE/UPDATE/DELETE actions after successful response.
 *
 * Usage:
 *   const handler = async (req, res) => {
 *     // Your handler logic
 *     return NextResponse.json({ id: 123 });
 *   };
 *
 *   export const POST = auditMiddleware({ action: 'CREATE', resourceName: 'pregnancy' })(handler);
 *
 * @param options - Audit middleware configuration
 * @returns Middleware wrapper function
 */
export function auditMiddleware(options: AuditMiddlewareOptions) {
  return (handler: (req: NextRequest) => Promise<NextResponse>) => {
    return async (req: NextRequest): Promise<NextResponse> => {
      const { action, resourceName, getResourceId } = options;

      // Extract audit context from request
      const user = (req as any).user;
      const ipAddress =
        req.headers.get("x-forwarded-for") ||
        req.headers.get("x-real-ip") ||
        "unknown";
      const userAgent = req.headers.get("user-agent") || "unknown";

      // Store request body for change tracking (for UPDATE actions)
      let requestBody: Record<string, any> = {};
      try {
        const bodyText = await req.text();
        if (bodyText) {
          requestBody = JSON.parse(bodyText);
        }
        // Clone the request with the body so handler can read it again
        req = new NextRequest(req, { body: bodyText });
      } catch (error) {
        // Body parsing failed, continue without it
        console.error("Failed to parse request body for audit logging:", error);
      }

      try {
        // Execute the original handler
        const response = await handler(req);

        // Check if response is successful (2xx status)
        if (response.status >= 200 && response.status < 300) {
          // Try to extract resource ID from response
          let resourceId: number | null = null;

          try {
            const responseBody = await response.clone().json();

            if (getResourceId) {
              // Use custom extractor if provided
              resourceId = getResourceId(responseBody);
            } else {
              // Try default extraction patterns
              resourceId = responseBody.id || responseBody.data?.id;
            }

            // Only log if we have a resource ID
            if (resourceId && user) {
              await writeAuditLog({
                actorId: user.id as number,
                actorRole: user.role as string,
                action,
                resource: resourceName,
                resourceId,
                changesSummary:
                  action === "UPDATE" ? requestBody : responseBody,
                ipAddress,
                userAgent,
              });
            }
          } catch (error) {
            // Failed to extract or log - log the error but don't break the original response
            console.error(
              "Failed to log audit entry after successful response:",
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
 * Extracts audit context (ipAddress, userAgent) from request headers.
 * Useful for manual audit logging within handler logic.
 * @param request - Next.js Request object
 * @returns Object with ipAddress and userAgent
 */
export function extractAuditContext(request: Request): {
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
 * Helper to manually log an action within a handler.
 * @param user - User object from JWT
 * @param action - Action type
 * @param resource - Resource name
 * @param resourceId - ID of the resource
 * @param changes - Optional change summary
 * @param request - Request object for context extraction
 */
export async function logAction(
  user: Record<string, any>,
  action: "CREATE" | "UPDATE" | "DELETE" | "READ_SENSITIVE",
  resource: string,
  resourceId: number,
  changes?: Record<string, any>,
  request?: Request
): Promise<void> {
  let ipAddress: string | undefined;
  let userAgent: string | undefined;

  if (request) {
    const context = extractAuditContext(request);
    ipAddress = context.ipAddress;
    userAgent = context.userAgent;
  }

  try {
    await writeAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action,
      resource,
      resourceId,
      changesSummary: changes,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error("Failed to log action:", error);
    // Don't throw - audit logging should never break the main flow
  }
}
