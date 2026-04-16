import jwt, { JwtPayload, SignOptions, VerifyOptions } from "jsonwebtoken";
import bcryptjs from "bcryptjs";

// ============================================================================
// ERROR CLASSES
// ============================================================================

export class UnauthorizedError extends Error {
  constructor(message: string = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

// ============================================================================
// JWT TOKEN HELPERS
// ============================================================================

/**
 * Signs a JWT token with the provided payload.
 * Token expires in 24 hours.
 * @param payload - The data to encode in the token
 * @returns Signed JWT token
 * @throws Error if JWT_SECRET is not defined
 */
export function signToken(payload: Record<string, any>): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not defined");
  }

  const options: SignOptions = {
    expiresIn: "24h",
    algorithm: "HS256",
  };

  return jwt.sign(payload, secret, options);
}

/**
 * Signs a JWT token with role-based expiry.
 * Clinical roles (DOCTOR, NURSE, MIDWIFE) get 8 hour expiry.
 * All other roles get 24 hour expiry.
 * @param payload - The data to encode in the token
 * @param role - The user's role to determine token expiry
 * @returns Signed JWT token
 * @throws Error if JWT_SECRET is not defined
 */
export function signTokenWithExpiry(
  payload: Record<string, any>,
  role: string
): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not defined");
  }

  // Determine expiry based on role
  const clinicalRoles = ["DOCTOR", "NURSE", "MIDWIFE"];
  const expiresIn = clinicalRoles.includes(role) ? "8h" : "24h";

  const options: SignOptions = {
    expiresIn,
    algorithm: "HS256",
  };

  return jwt.sign(payload, secret, options);
}

/**
 * Verifies a JWT token and returns the decoded payload.
 * @param token - The JWT token to verify
 * @returns Decoded token payload
 * @throws UnauthorizedError if token is invalid or expired
 */
export function verifyToken(token: string): JwtPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not defined");
  }

  try {
    const options: VerifyOptions = {
      algorithms: ["HS256"],
    };
    const decoded = jwt.verify(token, secret, options);
    return decoded as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("Token has expired");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError("Invalid token");
    }
    throw new UnauthorizedError("Failed to verify token");
  }
}

// ============================================================================
// PASSWORD HASHING HELPERS
// ============================================================================

const SALT_ROUNDS = 12;

/**
 * Hashes a plain text password using bcrypt.
 * @param plainPassword - The plain text password to hash
 * @returns Promise<string> - The bcrypt hash
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcryptjs.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compares a plain text password with a bcrypt hash.
 * @param plainPassword - The plain text password
 * @param hash - The bcrypt hash to compare against
 * @returns Promise<boolean> - True if passwords match, false otherwise
 */
export async function comparePassword(
  plainPassword: string,
  hash: string
): Promise<boolean> {
  return bcryptjs.compare(plainPassword, hash);
}
