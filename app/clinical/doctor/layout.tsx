'use client';

import AuthenticatedLayout from '@/components/AuthenticatedLayout';

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthenticatedLayout requiredRole="DOCTOR">
      {children}
    </AuthenticatedLayout>
  );
}
