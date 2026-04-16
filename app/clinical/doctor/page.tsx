'use client';

import { useAuth } from '@/hooks/useAuth';

export default function DoctorDashboard() {
  const { username } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Doctor Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome, Dr. {username}</p>
      </div>

      {/* Coming Soon Content */}
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="inline-block w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <span className="text-2xl">🏥</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Dashboard Coming Soon</h2>
        <p className="text-gray-600 mb-6">
          The full Doctor dashboard with clinical records, diagnostics, and patient management is being developed.
        </p>
        <p className="text-sm text-gray-500">
          Check back soon for new features and functionality.
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Patient Records</h3>
          <p className="text-sm text-gray-600">Access and manage comprehensive patient medical records.</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Consultations</h3>
          <p className="text-sm text-gray-600">Schedule and manage patient consultations and referrals.</p>
        </div>
      </div>
    </div>
  );
}

