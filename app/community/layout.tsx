'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import UnregisteredPrompt from '@/components/UnregisteredPrompt';

/**
 * Community Layout
 * Protects all /community/* routes with authentication check
 * Shows UnregisteredPrompt for unauthenticated users
 */
export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show loading state while checking auth
  if (isLoading || !mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show the unregistered prompt
  if (!isAuthenticated) {
    return <UnregisteredPrompt />;
  }

  // If authenticated, render the protected content
  return children;
}
