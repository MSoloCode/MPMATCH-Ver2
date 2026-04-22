'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown, Download, FileText } from 'lucide-react';
import { ClinicalArchiveTimeline } from '@/components/ClinicalArchiveTimeline';

interface ClinicalArchive {
  id: number;
  type: 'TEST_RESULT' | 'IMAGING' | 'MEDICATION' | 'PROCEDURE' | 'OTHER';
  title: string;
  datePerformed: string | null;
  notes: string | null;
  fileUrl: string;
  createdAt: string;
  uploadedBy?: {
    name: string;
    role?: string;
  };
}

interface Pregnancy {
  id: number;
  status: 'ACTIVE' | 'CLOSED' | 'DELIVERED';
  lmpDate: string;
  edd: string;
  isHighRisk: boolean;
  antenatalStatus?: string;
  clinicalArchives?: ClinicalArchive[];
  mother?: {
    id: number;
    fullName: string;
  };
}

export default function MyRecordsPage() {
  const router = useRouter();
  const { token, role } = useAuth();
  const [pregnancies, setPregnancies] = useState<Pregnancy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPregnancyId, setExpandedPregnancyId] = useState<number | null>(
    null
  );

  useEffect(() => {
    // Check if user is community user
    if (!token) {
      router.push('/sign-in');
      return;
    }

    if (role !== 'COMMUNITY_USER') {
      router.push('/sign-in');
      return;
    }

    fetchPregnancies();
  }, [token, role, router]);

  const fetchPregnancies = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/pregnancies', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/sign-in');
          return;
        }
        throw new Error('Failed to fetch pregnancies');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setPregnancies(result.data);
      } else {
        throw new Error(result.error || 'Failed to load pregnancies');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'Invalid date';
    }
  };

  const calculateGestationalAge = (lmpDate: string): number | null => {
    try {
      const lmp = new Date(lmpDate);
      const today = new Date();
      const weekInMs = 7 * 24 * 60 * 60 * 1000;
      return Math.floor((today.getTime() - lmp.getTime()) / weekInMs);
    } catch {
      return null;
    }
  };

  const getStatusBadge = (
    status: 'ACTIVE' | 'CLOSED' | 'DELIVERED'
  ) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-blue-100 text-blue-800';
      case 'DELIVERED':
        return 'bg-green-100 text-green-800';
      case 'CLOSED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!token || role !== 'COMMUNITY_USER') {
    return null; // Will redirect via useEffect
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your records...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Records</h1>
          <p className="text-gray-600">
            View your pregnancy records and clinical archives
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 border border-red-200">
            <p className="text-red-800">{error}</p>
            <button
              onClick={fetchPregnancies}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 transition-colors text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {pregnancies.length === 0 ? (
          <div className="rounded-lg bg-white border border-gray-200 p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Pregnancies Found
            </h3>
            <p className="text-gray-600">
              You don't have any pregnancy records yet. Records will appear here once registered.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pregnancies.map((pregnancy) => {
              const gestationalAge = calculateGestationalAge(pregnancy.lmpDate);
              const isExpanded = expandedPregnancyId === pregnancy.id;
              const archives = pregnancy.clinicalArchives || [];

              return (
                <div
                  key={pregnancy.id}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                >
                  {/* Header (Expandable) */}
                  <button
                    onClick={() =>
                      setExpandedPregnancyId(
                        isExpanded ? null : pregnancy.id
                      )
                    }
                    className="w-full px-6 py-4 hover:bg-gray-50 transition-colors text-left flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">
                          Pregnancy #{pregnancy.id}
                        </h3>
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadge(
                            pregnancy.status
                          )}`}
                        >
                          {pregnancy.status}
                        </span>
                        {pregnancy.isHighRisk && (
                          <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                            High Risk
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          <span className="font-medium">LMP:</span>{' '}
                          {formatDate(pregnancy.lmpDate)}
                        </p>
                        <p>
                          <span className="font-medium">Due Date:</span>{' '}
                          {formatDate(pregnancy.edd)}
                          {gestationalAge !== null && (
                            <span className="ml-2 text-gray-500">
                              ({gestationalAge} weeks)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-gray-400 transition-transform ${
                        isExpanded ? 'transform rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
                      <h4 className="font-semibold text-gray-900 mb-4">
                        Clinical Archives ({archives.length})
                      </h4>

                      {archives.length === 0 ? (
                        <div className="text-center py-8">
                          <FileText className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                          <p className="text-gray-600 text-sm">
                            No clinical records for this pregnancy
                          </p>
                        </div>
                      ) : (
                        <ClinicalArchiveTimeline
                          archives={archives}
                          isLoading={false}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>
            If you need help or have questions, please contact your healthcare provider.
          </p>
        </div>
      </div>
    </div>
  );
}
