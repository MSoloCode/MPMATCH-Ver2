/**
 * Edit Profile Page
 * Allows users to edit their personal information
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import PersonalInfoForm from '@/components/PersonalInfoForm';
import { ChevronLeft } from 'lucide-react';

export default function EditProfilePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!mounted || isLoading) return;

    if (!isAuthenticated) {
      router.push('/sign-in');
    }
  }, [isAuthenticated, isLoading, router, mounted]);

  if (!mounted || isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
              <p className="text-sm text-gray-600">Update your personal information</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <PersonalInfoForm
          onSuccess={() => {
            // Profile will be updated, user can see the message
          }}
          redirectOnSuccess={true}
        />
      </div>
    </div>
  );
}
