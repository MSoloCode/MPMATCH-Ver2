import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware for Route Protection
 * 
 * Protected Routes:
 * Page routes (client-side auth check via useAuth hook):
 * - /community/dashboard
 * - /community/dashboard/*
 * - /chw-dashboard
 * - /chw-dashboard/*
 * - /doctor-dashboard
 * - /doctor-dashboard/*
 * - /nurse-dashboard
 * - /nurse-dashboard/*
 * - /midwife-dashboard
 * - /midwife-dashboard/*
 * - /admin-dashboard
 * - /admin-dashboard/*
 *
 * API routes (server-side auth check via Authorization header):
 * - /api/:path*
 *
 * Authentication check:
 * - For page routes: Middleware cannot access client-side localStorage in Next.js
 *   Client-side route protection is handled by useAuth hook in layout/page components
 * - For API routes: Checks Authorization header for Bearer token
 */

export function middleware(request: NextRequest) {
  // Get the pathname
  const { pathname } = request.nextUrl;

  // Routes that require authentication (page routes)
  const protectedPageRoutes = [
    '/community/dashboard',
    '/chw-dashboard',
    '/doctor-dashboard',
    '/nurse-dashboard',
    '/midwife-dashboard',
    '/admin-dashboard',
  ];
  
  const isProtectedPageRoute = protectedPageRoutes.some((route) => pathname.startsWith(route));

  // For page routes, client-side protection via useAuth hook will handle redirects
  // No server-side action needed here
  
  // For API routes, check Authorization header
  if (pathname.startsWith('/api/')) {
    // API routes that don't require authentication (public endpoints)
    const publicApiRoutes = [
      '/api/sign-in',
      '/api/register',
      '/api/hello',
      '/api/emergency-alert',
      '/api/services/search',
      '/api/districts',
      '/api/facilities',
      '/api/mothers/register',
      '/api/chws/register',
    ];

    const isPublicApiRoute = publicApiRoutes.some((route) => pathname.startsWith(route));

    if (!isPublicApiRoute) {
      // This is a protected API route, check for Authorization header
      const authHeader = request.headers.get('Authorization');
      
      if (!authHeader) {
        return NextResponse.json(
          {
            success: false,
            error: 'Unauthorized - token required',
          },
          { status: 401 }
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // New dashboard routes
    '/admin/:path*',
    '/hospital/:path*',
    '/org/:path*',
    '/dho/:path*',
    '/clinical/:path*',
    '/chw/:path*',
    '/ambulance/:path*',
    // Existing dashboard routes (kept for backward compatibility)
    '/community/:path*',
    '/community-dashboard/:path*',
    '/chw-dashboard/:path*',
    '/doctor-dashboard/:path*',
    '/nurse-dashboard/:path*',
    '/midwife-dashboard/:path*',
    '/admin-dashboard/:path*',
    // API routes
    '/api/:path*',
  ],
};
