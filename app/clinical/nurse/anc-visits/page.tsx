'use client';

import { RoleGuard } from '@/components/RoleGuard';

export default function NurseAncVisitsPage() {
  return (
    <RoleGuard requiredRole="NURSE">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">ANC Visits</h1>
          <p className="text-gray-600 mt-1">Antenatal Care visit records</p>
        </div>

        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600">ANC Visits list coming soon</p>
        </div>
      </div>
    </RoleGuard>
  );
}
