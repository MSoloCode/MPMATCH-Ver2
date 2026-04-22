'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { RoleGuard } from '@/components/RoleGuard';
import ReferralForm from '@/components/ReferralForm';
import ReferralsTable from '@/components/ReferralsTable';
import UpdateStatusModal from '@/components/UpdateStatusModal';
import { Referral } from '@/types';
import { AlertCircle } from 'lucide-react';

interface User {
  id: number;
  name: string;
  hospitalId?: number;
  districtId?: number;
  facilityId?: number;
}

interface UserFacilityInfo {
  id?: number;
  name?: string;
}

export default function ReferralsPage() {
  const { token } = useAuth();

  // State
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');

  // User and facility info
  const [userFacilityId, setUserFacilityId] = useState<number | undefined>();
  const [userFacilityName, setUserFacilityName] = useState<string>('Current Facility');

  // Modal state
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // Fetch user facility info
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          // Try to extract facility info from token payload
          if (data.data) {
            setUserFacilityId(data.data.facilityId);
            // Facility name would need to be fetched from facilities endpoint
            // For now, using a placeholder
          }
        }
      } catch (err) {
        console.error('Failed to fetch user info:', err);
      }
    };

    if (token) {
      fetchUserInfo();
    }
  }, [token]);

  // Fetch referrals
  const fetchReferrals = useCallback(
    async (page: number, status: string) => {
      if (!token) return;

      try {
        setIsLoading(true);
        setError(null);

        let url = `/api/referrals?skip=${(page - 1) * pageSize}&take=${pageSize}`;
        if (status) {
          url += `&status=${status}`;
        }

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch referrals');
        }

        const result = await response.json();
        setReferrals(result.data || []);
        setTotalReferrals(result.pagination?.total || 0);
      } catch (err) {
        console.error('Error fetching referrals:', err);
        setError(err instanceof Error ? err.message : 'Failed to load referrals');
      } finally {
        setIsLoading(false);
      }
    },
    [token, pageSize]
  );

  // Initial fetch and re-fetch on page/filter change
  useEffect(() => {
    fetchReferrals(currentPage, statusFilter);
  }, [currentPage, statusFilter, fetchReferrals]);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle status filter change
  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1); // Reset to first page when filtering
  };

  // Handle referral creation success
  const handleReferralCreated = () => {
    setStatusFilter(''); // Reset filter to show all
    setCurrentPage(1); // Go to first page
  };

  // Handle update status button click
  const handleUpdateStatus = (referral: Referral) => {
    setSelectedReferral(referral);
    setIsUpdateModalOpen(true);
  };

  // Handle status update success
  const handleStatusUpdateSuccess = (updatedReferral: Referral) => {
    // Update the referral in the list
    setReferrals((prev) =>
      prev.map((r) => (r.id === updatedReferral.id ? updatedReferral : r))
    );
    setIsUpdateModalOpen(false);
    setSelectedReferral(null);
  };

  return (
    <RoleGuard requiredRole="DOCTOR|NURSE|MIDWIFE">
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Referrals Management</h1>
          <p className="text-neutral-600 mt-1">Create and track patient referrals between facilities</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-red-900">Error</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Referral Form */}
        <ReferralForm
          userFacilityId={userFacilityId}
          userFacilityName={userFacilityName}
          onSuccess={handleReferralCreated}
        />

        {/* Referrals Table */}
        <ReferralsTable
          referrals={referrals}
          isLoading={isLoading}
          total={totalReferrals}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onStatusFilterChange={handleStatusFilterChange}
          statusFilter={statusFilter}
          onUpdateStatus={handleUpdateStatus}
        />

        {/* Update Status Modal */}
        <UpdateStatusModal
          isOpen={isUpdateModalOpen}
          referral={selectedReferral}
          onClose={() => {
            setIsUpdateModalOpen(false);
            setSelectedReferral(null);
          }}
          onSuccess={handleStatusUpdateSuccess}
        />
      </div>
    </RoleGuard>
  );
}
