/**
 * User Profile Page
 * Displays user profile information and available actions
 * Shows role-based feature menu
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import UserProfileCard from '@/components/UserProfileCard';
import FeatureMenu from '@/components/FeatureMenu';
import { format } from 'date-fns';
import { ChevronLeft } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, token, isLoading, role, username } = useAuth();
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  // Load profile data
  useEffect(() => {
    if (!mounted || isLoading || !isAuthenticated || !token) return;

    const loadProfile = async () => {
      try {
        setLoading(true);

        const response = await fetch('/api/users/profile', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load profile');
        }

        const result = await response.json();
        if (result.success) {
          setProfileData(result.data);
          setError(null);
        }
      } catch (err) {
        console.error('Error loading profile:', err);
        setError('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [mounted, isLoading, isAuthenticated, token]);

  if (!mounted || isLoading || !isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
          >
            <ChevronLeft className="w-5 h-5" />
            Go Back
          </button>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800">{error || 'Failed to load profile'}</p>
          </div>
        </div>
      </div>
    );
  }

  const user = profileData.user;
  const mother = profileData.mother;
  const formattedJoinDate = user.createdAt ? format(new Date(user.createdAt), 'MMMM dd, yyyy') : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
              <p className="text-sm text-gray-600">View and manage your account information</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Profile Card */}
        <div className="mb-8">
          <UserProfileCard
            name={user.name}
            email={user.email}
            phone={user.phone}
            role={user.role}
            joinDate={formattedJoinDate || undefined}
            location={user.district?.name || mother?.district?.name}
            profilePictureUrl={user.profilePictureUrl || undefined}
            showEditButton={true}
          />
        </div>

        {/* Additional Information */}
        {(mother || user.hospital || user.organisation) && (
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Additional Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {mother && (
                <div className="space-y-3 pb-6 border-b md:border-b-0">
                  <h3 className="font-semibold text-gray-900">Mother Information</h3>
                  <div>
                    <p className="text-xs text-gray-600">Full Name</p>
                    <p className="text-sm font-medium text-gray-900">{mother.fullName}</p>
                  </div>
                  {mother.dob && (
                    <div>
                      <p className="text-xs text-gray-600">Date of Birth</p>
                      <p className="text-sm font-medium text-gray-900">
                        {format(new Date(mother.dob), 'MMMM dd, yyyy')}
                      </p>
                    </div>
                  )}
                  {mother.village && (
                    <div>
                      <p className="text-xs text-gray-600">Village</p>
                      <p className="text-sm font-medium text-gray-900">{mother.village}</p>
                    </div>
                  )}
                  {mother.facility && (
                    <div>
                      <p className="text-xs text-gray-600">Facility</p>
                      <p className="text-sm font-medium text-gray-900">{mother.facility.name}</p>
                    </div>
                  )}
                  {mother.chw && (
                    <div>
                      <p className="text-xs text-gray-600">Assigned CHW</p>
                      <p className="text-sm font-medium text-gray-900">{mother.chw.name}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Organization</h3>
                {user.hospital && (
                  <div>
                    <p className="text-xs text-gray-600">Hospital</p>
                    <p className="text-sm font-medium text-gray-900">{user.hospital.name}</p>
                  </div>
                )}
                {user.organisation && (
                  <div>
                    <p className="text-xs text-gray-600">Organisation</p>
                    <p className="text-sm font-medium text-gray-900">{user.organisation.name}</p>
                  </div>
                )}
                {user.country && (
                  <div>
                    <p className="text-xs text-gray-600">Country</p>
                    <p className="text-sm font-medium text-gray-900">{user.country.name}</p>
                  </div>
                )}
                {user.district && (
                  <div>
                    <p className="text-xs text-gray-600">District</p>
                    <p className="text-sm font-medium text-gray-900">{user.district.name}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Feature Menu */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">My Features & Functions</h2>
          <p className="text-sm text-gray-600 mb-6">
            Access all the tools and features available for your role:
          </p>
          <FeatureMenu role={user.role} displayMode="grid" />
        </div>
      </div>
    </div>
  );
}
