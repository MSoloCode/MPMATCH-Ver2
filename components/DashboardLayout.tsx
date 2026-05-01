/**
 * DashboardLayout Component
 * Wraps role-based dashboard pages with unified data fetching and error handling
 *
 * Usage in dashboard pages:
 * export default function MyDashboard() {
 *   return (
 *     <DashboardLayout requiredRole="DOCTOR">
 *       <YourDashboardContent />
 *     </DashboardLayout>
 *   );
 * }
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export interface DashboardData {
  user: {
    userId: number | null;
    motherId: number | null;
    role: string;
    displayName: string;
    facilityInfo: { name: string; id: number } | null;
  };
  stats: {
    totalMothers: number;
    activePregnancies: number;
    highRiskPregnancies: number;
    openAlerts: number;
    upcomingAppointments: number;
  };
  recentAlerts: Array<{
    id: number;
    type: string;
    status: string;
    motherName: string;
    createdAt: Date;
  }>;
  upcomingAppointments: Array<{
    id: number;
    appointmentDateTime: Date;
    status: string;
    motherName: string;
  }>;
  highRiskMothers: Array<{
    pregnancyId: number;
    motherName: string;
    riskFactors: string[];
    antenatalStatus: string;
  }>;
  visibility: {
    canSeeMothers: 'own' | 'hospital' | 'district' | 'all';
    canSeeAppointments: 'own' | 'hospital' | 'district' | 'all';
    canSeeAlerts: 'own' | 'hospital' | 'district' | 'all';
    canSeeGlobalStats: boolean;
    canSeeStaff: boolean;
    canSeeReports: boolean;
  };
}

interface DashboardLayoutProps {
  children: React.ReactElement<any>;
  requiredRole?: string | string[];
  onDataLoaded?: (data: DashboardData) => void;
}

/**
 * DashboardLayout - Provides unified dashboard data loading and role verification
 *
 * Features:
 * - Authenticates user via useAuth hook
 * - Verifies role matches requiredRole
 * - Fetches role-specific dashboard data from /api/dashboard/overview
 * - Handles loading and error states
 * - Passes data and context to child component via cloneElement
 * - Auto-refreshes data every 60 seconds
 *
 * The child component receives these props:
 * - dashboardData: DashboardData (or null if loading)
 * - isLoading: boolean
 * - error: string | null
 * - refreshData: () => Promise<void>
 */
export default function DashboardLayout({
  children,
  requiredRole,
  onDataLoaded,
}: DashboardLayoutProps) {
  const router = useRouter();
  const { isAuthenticated, role, token, isLoading: authLoading } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ========================================================================
  // 1. VERIFY AUTHENTICATION AND ROLE
  // ========================================================================
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !role) {
      router.push('/sign-in');
      return;
    }

    // Check if role matches required role
    if (requiredRole) {
      const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      if (!requiredRoles.includes(role)) {
        router.push('/unauthorised');
        return;
      }
    }
  }, [isAuthenticated, role, authLoading, requiredRole, router]);

  // ========================================================================
  // 2. FETCH DASHBOARD DATA
  // ========================================================================
  const fetchDashboardData = React.useCallback(async () => {
    if (!isAuthenticated || !token) return;

    try {
      setError(null);
      const response = await fetch('/api/dashboard/overview', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/sign-in');
          return;
        }
        throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        setDashboardData(result.data);
        onDataLoaded?.(result.data);
      } else {
        setError(result.error || 'Failed to load dashboard data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Dashboard data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token, router, onDataLoaded]);

  // Fetch on mount
  useEffect(() => {
    if (isAuthenticated && token && !authLoading) {
      fetchDashboardData();
    }
  }, [isAuthenticated, token, authLoading, fetchDashboardData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const interval = setInterval(() => {
      fetchDashboardData();
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated, token, fetchDashboardData]);

  // ========================================================================
  // 3. RENDER STATES
  // ========================================================================

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Authorization failed (will be redirected by useEffect)
  if (!isAuthenticated || !role) {
    return null;
  }

  // Error state
  if (error && !dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto bg-red-50 border border-red-200 rounded-lg p-6">
          <h1 className="text-xl font-bold text-red-900 mb-2">Dashboard Error</h1>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => fetchDashboardData()}
            className="inline-block px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Render children with dashboard data
  return React.cloneElement(children, {
    dashboardData,
    isLoading: loading,
    error,
    refreshData: fetchDashboardData,
  });
}
