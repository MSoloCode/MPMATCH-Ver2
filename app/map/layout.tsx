'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/Sidebar';

export default function MapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, role, isLoading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading && !mounted) return;

    if (!isAuthenticated) {
      router.push('/sign-in');
      return;
    }

    // Check if user has clinical role
    const clinicalRoles = ['DOCTOR', 'NURSE', 'MIDWIFE'];
    if (role && !clinicalRoles.includes(role)) {
      router.push('/unauthorised');
      return;
    }
  }, [isAuthenticated, role, isLoading, mounted, router]);

  if (!mounted || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-4">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
