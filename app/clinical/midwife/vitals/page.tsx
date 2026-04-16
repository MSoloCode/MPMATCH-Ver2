'use client';

import { RoleGuard } from '@/components/RoleGuard';

export default function MidwifeVitalsPage() {
  return (
    <RoleGuard requiredRole="MIDWIFE">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vitals</h1>
          <p className="text-gray-600 mt-1">View vital signs and measurements</p>
        </div>

        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600">Vitals records coming soon</p>
        </div>
      </div>
    </RoleGuard>
  );
}
