'use client';

import { RoleGuard } from '@/components/RoleGuard';
import SymptomsForm from '@/components/SymptomsForm';

export default function MidwifeSymptomsPage() {
  return (
    <RoleGuard requiredRole="MIDWIFE">
      <SymptomsForm />
    </RoleGuard>
  );
}
