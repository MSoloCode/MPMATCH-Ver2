'use client';

import { useAuth } from '@/hooks/useAuth';
import DashboardLayout, { DashboardData } from '@/components/DashboardLayout';
import { Bell, Users, AlertCircle, Calendar } from 'lucide-react';

interface CHWDashboardProps {
  dashboardData: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

const CHWDashboardContent = ({
  dashboardData,
  isLoading,
  error,
  refreshData,
}: CHWDashboardProps) => {
  const { logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto bg-red-50 border border-red-200 rounded-lg p-6">
          <h1 className="text-xl font-bold text-red-900 mb-2">Dashboard Error</h1>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={refreshData}
            className="inline-block px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) return null;

  const { stats, user, recentAlerts, visibility, upcomingAppointments, highRiskMothers } = dashboardData;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">CHW Dashboard</h1>
            <p className="text-gray-600 mt-2">Welcome, {user.displayName}</p>
            {user.facilityInfo && (
              <p className="text-sm text-gray-500 mt-1">📍 {user.facilityInfo.name}</p>
            )}
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Users className="w-6 h-6 text-blue-600" />}
            title="Total Mothers"
            count={stats.totalMothers}
            bgColor="bg-blue-50"
          />
          <StatCard
            icon={<Calendar className="w-6 h-6 text-green-600" />}
            title="Active Pregnancies"
            count={stats.activePregnancies}
            bgColor="bg-green-50"
          />
          <StatCard
            icon={<AlertCircle className="w-6 h-6 text-red-600" />}
            title="High Risk"
            count={stats.highRiskPregnancies}
            bgColor="bg-red-50"
          />
          <StatCard
            icon={<Bell className="w-6 h-6 text-yellow-600" />}
            title="Open Alerts"
            count={stats.openAlerts}
            bgColor="bg-yellow-50"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Alerts */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Recent Alerts
              </h2>
            </div>
            <div className="divide-y">
              {recentAlerts.length > 0 ? (
                recentAlerts.map((alert) => (
                  <div key={alert.id} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-900">{alert.motherName}</p>
                        <p className="text-sm text-gray-600">{alert.type}</p>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(alert.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="p-4 text-gray-500 text-sm">No recent alerts</p>
              )}
            </div>
          </div>

          {/* High-Risk Mothers */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                High-Risk Cases
              </h2>
            </div>
            <div className="divide-y">
              {highRiskMothers.length > 0 ? (
                highRiskMothers.map((pregnancy) => (
                  <div key={pregnancy.pregnancyId} className="p-4 hover:bg-gray-50">
                    <p className="font-semibold text-gray-900 text-sm">
                      {pregnancy.motherName}
                    </p>
                    {pregnancy.riskFactors.length > 0 && (
                      <p className="text-xs text-red-600 mt-1">
                        {pregnancy.riskFactors.join(', ')}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="p-4 text-gray-500 text-sm">No high-risk cases</p>
              )}
            </div>
          </div>
        </div>

        {/* Upcoming Appointments */}
        {visibility.canSeeAppointments && upcomingAppointments.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Upcoming Appointments (Next 7 Days)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Mother</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Date & Time</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {upcomingAppointments.map((apt) => (
                    <tr key={apt.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-900">{apt.motherName}</td>
                      <td className="px-6 py-3 text-gray-600">
                        {new Date(apt.appointmentDateTime).toLocaleString()}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          apt.status === 'CONFIRMED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {apt.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Stat Card Component
function StatCard({
  icon,
  title,
  count,
  bgColor,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  bgColor: string;
}) {
  return (
    <div className={`${bgColor} rounded-lg p-6 border border-gray-200`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 font-semibold">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{count}</p>
        </div>
        <div className="flex-shrink-0">{icon}</div>
      </div>
    </div>
  );
}

export default function CHWDashboard() {
  return (
    <DashboardLayout requiredRole="CHW">
      <CHWDashboardContent />
    </DashboardLayout>
  );
}
