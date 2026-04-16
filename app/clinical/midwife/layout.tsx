'use client';

import AuthenticatedLayout from '@/components/AuthenticatedLayout';

export default function MidwifeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthenticatedLayout requiredRole="MIDWIFE">
      {children}
    </AuthenticatedLayout>
  );
}
