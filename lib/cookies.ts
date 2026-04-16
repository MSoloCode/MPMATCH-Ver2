import { NextRequest, NextResponse } from 'next/server';

const TOKEN_COOKIE_NAME = 'mpmatch_token';
const TOKEN_MAX_AGE = 24 * 60 * 60; // 24 hours in seconds

/**
 * Set JWT token in an httpOnly cookie
 * @param response - NextResponse to add cookie to
 * @param token - JWT token to store
 * @returns Modified NextResponse with cookie set
 */
export function setTokenCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set({
    name: TOKEN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_MAX_AGE,
    path: '/',
  });

  return response;
}

/**
 * Extract JWT token from request cookies
 * @param request - NextRequest containing cookies
 * @returns Token string or null if not found
 */
export function getTokenFromCookie(request: NextRequest): string | null {
  try {
    const token = request.cookies.get(TOKEN_COOKIE_NAME)?.value;
    return token || null;
  } catch (error) {
    console.error('Error reading token cookie:', error);
    return null;
  }
}

/**
 * Clear token cookie from response
 * @param response - NextResponse to clear cookie from
 * @returns Modified NextResponse with cookie cleared
 */
export function clearTokenCookie(response: NextResponse): NextResponse {
  response.cookies.delete(TOKEN_COOKIE_NAME);
  return response;
}

/**
 * Get token from either the request cookies or Authorization header (for API calls)
 * Prioritizes cookie, falls back to Authorization header
 * @param request - NextRequest
 * @returns Token string or null
 */
export function getToken(request: NextRequest): string | null {
  // Try to get from cookie first (for page-based requests)
  const cookieToken = getTokenFromCookie(request);
  if (cookieToken) {
    return cookieToken;
  }

  // Fall back to Authorization header (for API requests)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}
