'use client';

import AuthenticatedLayout from '@/components/AuthenticatedLayout';

export default function NurseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthenticatedLayout requiredRole="NURSE">
      {children}
    </AuthenticatedLayout>
  );
}
