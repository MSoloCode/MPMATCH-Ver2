'use client';

import { RoleGuard } from '@/components/RoleGuard';
import SymptomsForm from '@/components/SymptomsForm';

export default function NurseSymptomsPage() {
  return (
    <RoleGuard requiredRole="NURSE">
      <SymptomsForm />
    </RoleGuard>
  );
}
