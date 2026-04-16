'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/Button';
import { TextInput } from '@/components/FormInputs';

interface MotherData {
  id: number;
  fullName: string;
  phone: string;
  village: string | null;
  districtId: number;
  district: {
    id: number;
    name: string;
  };
  facilityId: number;
  facility: {
    id: number;
    name: string;
    lat: number | null;
    lng: number | null;
  };
  chwId: number | null;
}

interface MotherCounts {
  districtCount: number;
  villageCount: number;
}

interface CHW {
  id: number;
  name: string;
  phone: string;
  facilityName: string;
  distanceKm: number;
}

export default function CommunityDashboard() {
  const router = useRouter();
  const { isAuthenticated, motherId, getAuthHeader, logout, isLoading } =
    useAuth();

  const [motherData, setMotherData] = useState<MotherData | null>(null);
  const [counts, setCounts] = useState<MotherCounts | null>(null);
  const [chws, setChws] = useState<CHW[]>([]);
  const [alertDescription, setAlertDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alertSubmitting, setAlertSubmitting] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // ========================================================================
  // 1. AUTHENTICATION CHECK & ROLE VERIFICATION
  // ========================================================================
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !motherId) {
      router.push('/sign-in');
      return;
    }

    // For COMMUNITY_USER role, this is validated server-side in the API calls
  }, [isAuthenticated, motherId, isLoading, router]);

  // ========================================================================
  // 2. FETCH DATA ON MOUNT AND WHEN REFRESHING
  // ========================================================================
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const authHeader = getAuthHeader();

      if (!authHeader) {
        setError('Authentication failed');
        return;
      }

      // Fetch mother profile
      const motherResponse = await fetch('/api/mothers/me', {
        headers: authHeader,
      });

      if (!motherResponse.ok) {
        if (motherResponse.status === 401) {
          router.push('/sign-in');
          return;
        }
        throw new Error('Failed to fetch mother profile');
      }

      const motherJson = await motherResponse.json();
      if (!motherJson.success) {
        throw new Error(motherJson.error || 'Failed to fetch mother profile');
      }

      const mother: MotherData = motherJson.data;
      setMotherData(mother);

      // Fetch mother counts (district and village)
      const countParams = new URLSearchParams({
        districtId: mother.districtId.toString(),
      });
      if (mother.village) {
        countParams.append('village', mother.village);
      }

      const countResponse = await fetch(
        `/api/mothers/count?${countParams.toString()}`,
        {
          headers: authHeader,
        }
      );

      if (!countResponse.ok) {
        throw new Error('Failed to fetch mother counts');
      }

      const countJson = await countResponse.json();
      if (!countJson.success) {
        throw new Error(countJson.error || 'Failed to fetch counts');
      }

      setCounts(countJson.data);

      // Fetch nearest CHWs (only if facility has coordinates)
      if (mother.facility?.lat && mother.facility?.lng) {
        const chwParams = new URLSearchParams({
          lat: mother.facility.lat.toString(),
          lng: mother.facility.lng.toString(),
        });

        const chwResponse = await fetch(
          `/api/chws/nearest?${chwParams.toString()}`,
          {
            headers: authHeader,
          }
        );

        if (!chwResponse.ok) {
          throw new Error('Failed to fetch CHWs');
        }

        const chwJson = await chwResponse.json();
        if (!chwJson.success) {
          throw new Error(chwJson.error || 'Failed to fetch CHWs');
        }

        setChws(chwJson.data);
      } else {
        setChws([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading && isAuthenticated && motherId) {
      fetchData();
    }
  }, [isLoading, isAuthenticated, motherId]);

  // ========================================================================
  // 3. HANDLE REFRESH BUTTON
  // ========================================================================
  const handleRefresh = () => {
    fetchData();
  };

  // ========================================================================
  // 4. HANDLE LOGOUT
  // ========================================================================
  const handleLogout = () => {
    logout();
    router.push('/');
  };

  // ========================================================================
  // 5. HANDLE SHARE/COPY REFERRAL LINK
  // ========================================================================
  const handleShareReferral = async () => {
    if (!motherId) return;

    const referralUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/register?referredBy=${motherId}`
        : '';

    try {
      // Try Web Share API first (mobile devices)
      if (navigator.share) {
        await navigator.share({
          title: 'Join MPMATCH Community',
          text: 'Invite your friend to join the MPMATCH community for maternal health tracking',
          url: referralUrl,
        });
        setCopyFeedback('Shared successfully!');
        setTimeout(() => setCopyFeedback(null), 3000);
      } else {
        // Fallback: Copy to clipboard
        await navigator.clipboard.writeText(referralUrl);
        setCopyFeedback('Link copied to clipboard!');
        setTimeout(() => setCopyFeedback(null), 3000);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Share error:', err);
        setCopyFeedback('Failed to share link');
        setTimeout(() => setCopyFeedback(null), 3000);
      }
    }
  };

  // ========================================================================
  // 6. HANDLE ALERT SUBMISSION
  // ========================================================================
  const handleSubmitAlert = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!alertDescription.trim() || !motherId) {
      setAlertMessage('Please describe your issue');
      return;
    }

    try {
      setAlertSubmitting(true);
      setAlertMessage(null);

      const facilityId = motherData?.facilityId;
      if (!facilityId) {
        setAlertMessage('Facility information not available');
        return;
      }

      const response = await fetch('/api/emergency-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          motherPhone: motherData?.phone,
          facilityId,
          description: alertDescription.trim(),
        }),
      });

      const json = await response.json();

      if (!json.success) {
        setAlertMessage(json.error || 'Failed to send alert');
        return;
      }

      setAlertMessage('Alert sent successfully!');
      setAlertDescription('');
      setTimeout(() => setAlertMessage(null), 3000);
    } catch (err) {
      setAlertMessage(
        err instanceof Error ? err.message : 'An error occurred'
      );
      console.error('Error submitting alert:', err);
    } finally {
      setAlertSubmitting(false);
    }
  };

  // ========================================================================
  // 7. HANDLE QUICK ACTION NAVIGATION
  // ========================================================================
  const handleQuickAction = (path: string) => {
    router.push(path);
  };

  // ========================================================================
  // 8. LOADING STATE
  // ========================================================================
  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-neutral-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // ========================================================================
  // 9. ERROR STATE
  // ========================================================================
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-neutral-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-800">
            <h3 className="font-semibold text-lg mb-2">Error Loading Dashboard</h3>
            <p className="mb-4">{error}</p>
            <Button variant="primary" onClick={handleRefresh}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ========================================================================
  // 10. RENDER DASHBOARD
  // ========================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-neutral-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* ================================================================ */}
        {/* HEADER SECTION */}
        {/* ================================================================ */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-primary-800 mb-3">
            For public/community users
          </h1>
          <p className="text-lg text-neutral-600 max-w-3xl mx-auto">
            Welcome to your community dashboard. Here you can access health
            services, connect with CHWs, and track your health information.
          </p>
        </div>

        {/* ================================================================ */}
        {/* MAIN CARD */}
        {/* ================================================================ */}
        <div className="bg-white border border-neutral-300 rounded-lg p-8 shadow-sm mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-primary-800">
                Your community dashboard
              </h2>
              <p className="text-neutral-600 mt-1">
                Welcome, {motherData?.fullName}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleRefresh}>
                Refresh
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>

          {/* ============================================================ */}
          {/* TWO-COLUMN SUB-CARDS */}
          {/* ============================================================ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* LEFT CARD: REGISTERED USERS */}
            <div className="border border-neutral-300 rounded-lg p-6 bg-neutral-50">
              <h3 className="text-xl font-bold text-primary-800 mb-4">
                Registered users
              </h3>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-700">District:</span>
                  <span className="text-2xl font-bold text-accent-600">
                    {counts?.districtCount || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-700">Village:</span>
                  <span className="text-2xl font-bold text-accent-600">
                    {counts?.villageCount || 0}
                  </span>
                </div>
              </div>

              <Button
                variant="primary"
                onClick={handleShareReferral}
                className="w-full"
              >
                Share link / Invite a friend
              </Button>
              {copyFeedback && (
                <p className="text-sm text-green-600 mt-2 text-center">
                  {copyFeedback}
                </p>
              )}
            </div>

            {/* RIGHT CARD: NEAREST CHWs */}
            <div className="border border-neutral-300 rounded-lg p-6 bg-neutral-50">
              <h3 className="text-xl font-bold text-primary-800 mb-4">
                Nearest CHWs
              </h3>

              {chws.length > 0 ? (
                <div className="space-y-3">
                  {chws.map((chw) => (
                    <div
                      key={chw.id}
                      className="border border-neutral-200 rounded p-3 bg-white hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-primary-800">
                            {chw.name}
                          </p>
                          <p className="text-sm text-neutral-600">
                            {chw.facilityName}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-accent-600">
                          {chw.distanceKm.toFixed(1)} km
                        </span>
                      </div>
                      <a
                        href={`tel:${chw.phone}`}
                        className="text-sm text-primary-600 hover:text-primary-700 underline"
                      >
                        {chw.phone}
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-neutral-600 text-center py-6">
                  No CHWs found for your area yet.
                </p>
              )}
            </div>
          </div>

          {/* ============================================================ */}
          {/* ALERT INITIATION SECTION */}
          {/* ============================================================ */}
          <div className="border border-neutral-300 rounded-lg p-6 bg-neutral-50 mb-8">
            <h3 className="text-xl font-bold text-primary-800 mb-4">
              Initiate an alert (via CHW)
            </h3>

            <form onSubmit={handleSubmitAlert} className="space-y-4">
              <textarea
                placeholder="Describe your issue..."
                value={alertDescription}
                onChange={(e) => setAlertDescription(e.target.value)}
                className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 resize-none"
                rows={3}
              />

              {alertMessage && (
                <div
                  className={`p-3 rounded text-sm ${
                    alertMessage.includes('success')
                      ? 'bg-green-50 text-green-800'
                      : 'bg-red-50 text-red-800'
                  }`}
                >
                  {alertMessage}
                </div>
              )}

              <Button
                variant="primary"
                type="submit"
                disabled={alertSubmitting}
                className="w-full"
              >
                {alertSubmitting ? 'Sending...' : 'Send request'}
              </Button>
            </form>
          </div>

          {/* ============================================================ */}
          {/* QUICK ACTION BUTTONS */}
          {/* ============================================================ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              variant="outline"
              onClick={() => handleQuickAction('/chat')}
              className="w-full"
            >
              AI Chat
            </Button>
            <Button
              variant="outline"
              onClick={() => handleQuickAction('/emergency')}
              className="w-full"
            >
              Emergency
            </Button>
            <Button
              variant="outline"
              onClick={() => handleQuickAction('/appointments')}
              className="w-full"
            >
              Schedule Appointment
            </Button>
            <Button
              variant="outline"
              onClick={() => handleQuickAction('/services')}
              className="w-full"
            >
              Locate a Service Provider
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
