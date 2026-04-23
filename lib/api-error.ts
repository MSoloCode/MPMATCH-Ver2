import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

// ============================================================================
// ERROR CLASSES
// ============================================================================

/**
 * Custom API error class for standardized error handling across API routes.
 * Extends Error with HTTP status code and optional error details.
 *
 * @example
 * throw new ApiError(404, "User not found");
 * throw new ApiError(400, "Invalid request", { field: "email" });
 */
export class ApiError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(
    statusCode: number,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;

    // Maintain proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Field-level validation error messages extracted from Zod errors.
 * Key: field name, Value: error message
 */
export interface ZodFieldErrors {
  [key: string]: string;
}

/**
 * Standard API error response format.
 * Used for both ApiError and unhandled errors.
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

/**
 * Type for route handler functions compatible with withErrorHandler wrapper.
 */
export type ApiRouteHandler = (
  request: NextRequest
) => Promise<NextResponse>;

// ============================================================================
// ERROR EXTRACTION HELPERS
// ============================================================================

/**
 * Extracts field-level error messages from a Zod validation error.
 * Converts ZodError format to a flat object with field names as keys.
 *
 * @param error - The ZodError to extract from
 * @returns Object with field names as keys and error messages as values
 *
 * @example
 * // ZodError: [
 * //   { path: ['email'], message: 'Invalid email' },
 * //   { path: ['age'], message: 'Must be >= 18' }
 * // ]
 * // Returns: { email: 'Invalid email', age: 'Must be >= 18' }
 */
export function extractZodErrors(error: ZodError): ZodFieldErrors {
  const fields: ZodFieldErrors = {};

  for (const issue of error.issues) {
    // Build field path from nested fields (e.g., 'user.email' -> 'user.email')
    const fieldPath = issue.path.join(".");
    const fieldName = fieldPath || "root";

    // Use the error message from Zod, or fall back to code
    fields[fieldName] = issue.message;
  }

  return fields;
}

// ============================================================================
// ERROR HANDLER WRAPPER
// ============================================================================

/**
 * Wraps a Next.js API route handler with global error handling.
 * Catches ApiError, ZodError, and unhandled exceptions, returning standardized JSON responses.
 *
 * BEHAVIOR:
 * - ApiError: Returns JSON with the specified status code, message, and optional details
 * - ZodError: Returns 422 with field-level validation error messages
 * - Unhandled errors: Returns 500, logs error to console.error, and returns safe error message
 *
 * RESPONSE FORMAT:
 * {
 *   success: false,
 *   error: "Error message",
 *   details?: {...}
 * }
 *
 * @param handler - Next.js route handler function
 * @returns Wrapped handler with error handling
 *
 * @example
 * // Basic usage
 * export const POST = withErrorHandler(async (req) => {
 *   throw new ApiError(400, "Invalid request");
 * });
 *
 * @example
 * // With Zod validation
 * import { z } from 'zod';
 *
 * const schema = z.object({
 *   email: z.string().email("Invalid email"),
 *   age: z.number().min(18, "Must be 18 or older"),
 * });
 *
 * export const POST = withErrorHandler(async (req) => {
 *   const body = await req.json();
 *   const data = schema.parse(body); // May throw ZodError
 *   // Process valid data...
 *   return NextResponse.json({ success: true, data });
 * });
 *
 * @example
 * // With permission errors
 * export const DELETE = withErrorHandler(async (req) => {
 *   const user = extractUser(req);
 *   if (!user.isAdmin) {
 *     throw new ApiError(403, "Insufficient permissions");
 *   }
 *   // Process deletion...
 *   return NextResponse.json({ success: true });
 * });
 */
export function withErrorHandler(handler: ApiRouteHandler): ApiRouteHandler {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      return await handler(request);
    } catch (error) {
      // ======================================================================
      // ApiError Handler
      // ======================================================================
      if (error instanceof ApiError) {
        const response: ApiErrorResponse = {
          success: false,
          error: error.message,
        };

        // Include details if provided
        if (error.details !== undefined) {
          response.details = error.details;
        }

        return NextResponse.json(response, {
          status: error.statusCode,
        });
      }

      // ======================================================================
      // ZodError Handler
      // ======================================================================
      if (error instanceof ZodError) {
        const fields = extractZodErrors(error);

        const response: ApiErrorResponse = {
          success: false,
          error: "Validation failed",
          details: { fields },
        };

        return NextResponse.json(response, {
          status: 422, // Unprocessable Entity
        });
      }

      // ======================================================================
      // Unhandled Error Handler
      // ======================================================================
      // Log the error for debugging
      console.error("Unhandled API error:", error);

      const response: ApiErrorResponse = {
        success: false,
        error: "Internal server error",
      };

      return NextResponse.json(response, {
        status: 500,
      });
    }
  };
}

// ============================================================================
// CONVENIENCE SUBCLASSES (for backward compatibility during migration)
// ============================================================================

/**
 * Unauthorized (401) error class for backward compatibility.
 * Extends ApiError with a fixed 401 status code.
 *
 * @example
 * throw new UnauthorizedError("Invalid credentials");
 */
export class UnauthorizedError extends ApiError {
  constructor(message: string = "Unauthorized") {
    super(401, message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Forbidden (403) error class for backward compatibility.
 * Extends ApiError with a fixed 403 status code.
 *
 * @example
 * throw new ForbiddenError("Insufficient permissions");
 */
export class ForbiddenError extends ApiError {
  constructor(message: string = "Forbidden") {
    super(403, message);
    this.name = "ForbiddenError";
  }
}
