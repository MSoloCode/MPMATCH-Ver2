'use client';

import { useAuth } from '@/hooks/useAuth';
import { RoleGuard } from '@/components/RoleGuard';

const DHODashboardContent = () => {
  const { username, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">District Health Officer Dashboard</h1>
            <p className="text-gray-600 mt-2">Welcome, {username}</p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Coming Soon Content */}
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="inline-block w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">📊</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Dashboard Coming Soon</h2>
          <p className="text-gray-600 mb-6">
            The DHO dashboard with district-wide health monitoring, facility oversight, and population health analytics is being developed.
          </p>
          <p className="text-sm text-gray-500">
            Check back soon for new features and functionality.
          </p>
        </div>

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-2">District Health</h3>
            <p className="text-sm text-gray-600">Monitor district-wide health metrics.</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Facilities</h3>
            <p className="text-sm text-gray-600">Oversee all district health facilities.</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Analytics</h3>
            <p className="text-sm text-gray-600">View population health analytics.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function DHODashboard() {
  return (
    <RoleGuard requiredRole="DHO">
      <DHODashboardContent />
    </RoleGuard>
  );
}
