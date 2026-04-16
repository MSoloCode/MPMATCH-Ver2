'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { RoleGuard } from '@/components/RoleGuard';
import { AlertsTrendChart } from '@/components/AlertsTrendChart';
import { AppointmentsTrendChart } from '@/components/AppointmentsTrendChart';
import { QuickActionsCard } from '@/components/QuickActionsCard';
import { FacilitiesByDistrictCard } from '@/components/FacilitiesByDistrictCard';
import { RecentAlertsCard } from '@/components/RecentAlertsCard';

interface DashboardStats {
  countries: number;
  facilities: number;
  alertsOpen: number;
  emergencyOpen: number;
  mothers: number;
  pregnanciesActive: number;
  pregnanciesHighRisk: number;
  appointmentsUpcoming: number;
  usersStaff: number;
  timestamp: string;
}

interface AlertTrendDay {
  date: string;
  count: number;
}

interface AppointmentTrendDay {
  date: string;
  total: number;
  SCHEDULED: number;
  CONFIRMED: number;
  MISSED: number;
  CANCELLED: number;
  ATTENDED: number;
}

interface FacilityByDistrict {
  districtId: number;
  districtName: string;
  facilityCount: number;
  alertCount: number;
}

interface RecentAlert {
  id: number;
  type: string;
  status: string;
  createdAt: string;
  mother?: {
    id: number;
    fullName: string;
  };
  pregnancy?: {
    id: number;
    isHighRisk: boolean;
  };
}

interface DashboardWidgets {
  alertsTrendData: AlertTrendDay[];
  appointmentsTrendData: AppointmentTrendDay[];
  topFacilitiesByDistrict: FacilityByDistrict[];
  recentAlerts: RecentAlert[];
  timestamp: string;
}

const AdminDashboardContent = () => {
  const { username, logout, role, token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidgets | null>(null);
  const [loading, setLoading] = useState(true);
  const [widgetsLoading, setWidgetsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [widgetsError, setWidgetsError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const roleDisplayMap: Record<string, string> = {
    SYSTEM_ADMIN: 'System Administrator',
    HOSPITAL_ADMIN: 'Hospital Administrator',
    ORG_ADMIN: 'Organization Administrator',
  };

  // Fetch dashboard stats from API
  const fetchStats = async () => {
    try {
      setError(null);
      const response = await fetch('/api/admin/dashboard-stats', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setStats(data.data);
        setLastRefresh(new Date());
      } else {
        setError(data.error || 'Failed to fetch dashboard data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching admin dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch dashboard widget data
  const fetchWidgets = async () => {
    try {
      setWidgetsError(null);
      const response = await fetch('/api/admin/dashboard-aggregate', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch widget data: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setWidgets(data.data);
      } else {
        setWidgetsError(data.error || 'Failed to fetch widget data');
      }
    } catch (err) {
      setWidgetsError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching admin dashboard widgets:', err);
    } finally {
      setWidgetsLoading(false);
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    if (token) {
      fetchStats();
      fetchWidgets();
    }
  }, [token]);

  // Set up auto-refresh every 60 seconds
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      fetchStats();
      fetchWidgets();
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [token]);

  // KPI Tile Component
  const KPITile = ({
    title,
    count,
    subtitle,
    bgColor,
    borderColor,
  }: {
    title: string;
    count: number;
    subtitle: string;
    bgColor: string;
    borderColor: string;
  }) => (
    <div className={`${bgColor} rounded-lg shadow-md border-l-4 ${borderColor} p-6 relative`}>
      {/* Status dot (always green) */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>

      {/* Count */}
      <p className="text-3xl font-bold text-gray-900 mb-2">{count.toLocaleString()}</p>

      {/* Subtitle */}
      <p className="text-xs text-gray-600">{subtitle}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">
              Signed in as <span className="font-semibold">{roleDisplayMap[role || ''] || role}</span>. Data shown is limited by scope and rights.
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <Link href="/map">
              <button className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                Open map
              </button>
            </Link>
            <Link href="/alerts">
              <button className="px-4 py-2 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors">
                View alerts
              </button>
            </Link>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold">Error loading dashboard</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full"></div>
            </div>
            <p className="ml-3 text-gray-600">Loading dashboard data...</p>
          </div>
        )}

        {/* KPI Grid */}
        {!loading && stats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Row 1 */}
              <KPITile
                title="Countries"
                count={stats.countries}
                subtitle="Multi-country operations"
                bgColor="bg-blue-50"
                borderColor="border-blue-400"
              />
              <KPITile
                title="Hospitals / Facilities"
                count={stats.facilities}
                subtitle="Registered facilities"
                bgColor="bg-teal-50"
                borderColor="border-teal-400"
              />
              <KPITile
                title="Open alerts"
                count={stats.alertsOpen}
                subtitle="Active risk and emergency alerts"
                bgColor="bg-red-50"
                borderColor="border-red-400"
              />

              {/* Row 2 */}
              <KPITile
                title="Emergency open"
                count={stats.emergencyOpen}
                subtitle="Needing immediate response"
                bgColor="bg-red-100"
                borderColor="border-red-500"
              />
              <KPITile
                title="Mothers"
                count={stats.mothers}
                subtitle="Registered mothers in scope"
                bgColor="bg-green-50"
                borderColor="border-green-400"
              />
              <KPITile
                title="Active pregnancies"
                count={stats.pregnanciesActive}
                subtitle="Open pregnancy episodes"
                bgColor="bg-white"
                borderColor="border-gray-300"
              />

              {/* Row 3 */}
              <KPITile
                title="High-risk pregnancies"
                count={stats.pregnanciesHighRisk}
                subtitle="Flagged isHighRisk=true"
                bgColor="bg-yellow-50"
                borderColor="border-yellow-400"
              />
              <KPITile
                title="Upcoming appointments"
                count={stats.appointmentsUpcoming}
                subtitle="Scheduled/confirmed in next 7 days"
                bgColor="bg-yellow-100"
                borderColor="border-yellow-300"
              />
              <KPITile
                title="Users"
                count={stats.usersStaff}
                subtitle="Staff accounts (admin view only)"
                bgColor="bg-gray-50"
                borderColor="border-gray-400"
              />
            </div>

            {/* Widgets Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Left Column - Charts (spans 2 columns on desktop) */}
              <div className="lg:col-span-2 space-y-6">
                {/* Alerts Trend Chart */}
                {widgetsError && (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
                    <p className="font-semibold text-sm">Warning loading widget data</p>
                    <p className="text-xs">{widgetsError}</p>
                  </div>
                )}
                <AlertsTrendChart
                  data={widgets?.alertsTrendData || []}
                  isLoading={widgetsLoading}
                />

                {/* Appointments Trend Chart */}
                <AppointmentsTrendChart
                  data={widgets?.appointmentsTrendData || []}
                  isLoading={widgetsLoading}
                />
              </div>

              {/* Right Column - Cards (1 column) */}
              <div className="space-y-6">
                {/* Quick Actions */}
                <QuickActionsCard />

                {/* Facilities by District */}
                <FacilitiesByDistrictCard
                  data={widgets?.topFacilitiesByDistrict || []}
                  isLoading={widgetsLoading}
                />

                {/* Recent Alerts */}
                <RecentAlertsCard
                  data={widgets?.recentAlerts || []}
                  isLoading={widgetsLoading}
                />
              </div>
            </div>
            {lastRefresh && (
              <div className="text-center text-xs text-gray-500">
                Last updated: {lastRefresh.toLocaleTimeString()} • Auto-refreshes every 60 seconds
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  return (
    <RoleGuard requiredRole={['SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'ORG_ADMIN']}>
      <AdminDashboardContent />
    </RoleGuard>
  );
}
