'use client';

import { RoleGuard } from '@/components/RoleGuard';

export default function DoctorReportsPage() {
  return (
    <RoleGuard requiredRole="DOCTOR">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">Generate and view clinical reports</p>
        </div>

        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600">Reports coming soon</p>
        </div>
      </div>
    </RoleGuard>
  );
}
