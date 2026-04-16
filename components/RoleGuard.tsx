'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isRoleAuthorized } from '@/lib/role-routes';

interface RoleGuardProps {
  requiredRole: string | string[];
  children: React.ReactNode;
}

/**
 * RoleGuard HOC
 * Protects dashboard routes by verifying the user's JWT token and role authorization.
 *
 * Usage:
 * export default function MyDashboard() {
 *   return (
 *     <RoleGuard requiredRole="CHW">
 *       <div>CHW Dashboard Content</div>
 *     </RoleGuard>
 *   );
 * }
 *
 * How it works:
 * 1. On component mount, calls /api/auth/verify to validate token from httpOnly cookie
 * 2. If token missing or expired → redirects to /sign-in
 * 3. If token valid but role mismatch → redirects to /unauthorised
 * 4. If token valid and role matches → renders children
 * 5. While verifying, shows loading spinner
 */
export function RoleGuard({ requiredRole, children }: RoleGuardProps): React.ReactNode {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifyAndAuthorize = async () => {
      try {
        // Verify token and get user payload from httpOnly cookie
        const response = await fetch('/api/auth/verify', {
          method: 'GET',
          credentials: 'include', // Important: include httpOnly cookies
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          // Token missing or invalid
          router.push('/sign-in');
          setIsLoading(false);
          return;
        }

        // Token is valid, check role authorization
        const userRole = data.payload.role;
        const requiredRoles = Array.isArray(requiredRole)
          ? requiredRole
          : [requiredRole];

        const authorized = requiredRoles.some((role) =>
          isRoleAuthorized(userRole, `/dashboard/${role.toLowerCase()}`) ||
          requiredRoles.includes(userRole)
        );

        if (!authorized) {
          // Token valid but role doesn't match
          router.push('/unauthorised');
          setIsLoading(false);
          return;
        }

        // All checks passed
        setIsAuthorized(true);
        setIsLoading(false);
      } catch (error) {
        console.error('Error verifying authorization:', error);
        router.push('/sign-in');
        setIsLoading(false);
      }
    };

    verifyAndAuthorize();
  }, [requiredRole, router]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Authorization failed (will be redirected by useEffect)
  if (!isAuthorized) {
    return null;
  }

  // Authorized - render children
  return children;
}

/**
 * HOC version of RoleGuard for wrapping page components
 * Usage:
 * const MyDashboard = withRoleGuard(() => <div>Dashboard</div>, 'CHW');
 * export default MyDashboard;
 */
export function withRoleGuard<T extends Record<string, any>>(
  Component: React.ComponentType<T>,
  requiredRole: string | string[]
): React.ComponentType<T> {
  return function GuardedComponent(props: T) {
    return (
      <RoleGuard requiredRole={requiredRole}>
        <Component {...props} />
      </RoleGuard>
    );
  };
}
