'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/Button';

export default function CHWDashboard() {
  const router = useRouter();
  const { isAuthenticated, isLoading, role, username, logout } = useAuth();

  // ========================================================================
  // AUTHENTICATION & ROLE CHECK
  // ========================================================================
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push('/sign-in');
      return;
    }

    // Verify role matches this dashboard
    if (role && role !== 'CHW') {
      // Redirect to appropriate dashboard for their role
      const roleMap: Record<string, string> = {
        DOCTOR: '/doctor-dashboard',
        NURSE: '/nurse-dashboard',
        MIDWIFE: '/midwife-dashboard',
        SYSTEM_ADMIN: '/admin-dashboard',
        HOSPITAL_ADMIN: '/admin-dashboard',
        ORG_ADMIN: '/admin-dashboard',
        COMMUNITY_USER: '/community-dashboard',
      };
      const dashboard = roleMap[role] || '/sign-in';
      router.push(dashboard);
    }
  }, [isAuthenticated, isLoading, role, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || role !== 'CHW') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">CHW Dashboard</h1>
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
            <span className="text-2xl">🚀</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Dashboard Coming Soon</h2>
          <p className="text-gray-600 mb-6">
            The full CHW dashboard with analytics, patient management, and reporting tools is being developed.
          </p>
          <p className="text-sm text-gray-500">
            Check back soon for new features and functionality.
          </p>
        </div>

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Patients</h3>
            <p className="text-sm text-gray-600">Manage your registered patients and their records.</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Alerts</h3>
            <p className="text-sm text-gray-600">View and respond to emergency alerts and escalations.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
