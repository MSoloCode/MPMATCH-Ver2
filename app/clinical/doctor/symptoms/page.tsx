'use client';

import { RoleGuard } from '@/components/RoleGuard';
import SymptomsForm from '@/components/SymptomsForm';

export default function DoctorSymptomsPage() {
  return (
    <RoleGuard requiredRole="DOCTOR">
      <SymptomsForm />
    </RoleGuard>
  );
}
