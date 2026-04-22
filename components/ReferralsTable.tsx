'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Loader, AlertCircle } from 'lucide-react';
import { SelectDropdown } from './FormInputs';

interface Referral {
  id: number;
  motherId: number;
  pregnancyId: number | null;
  mother: {
    id: number;
    fullName: string;
    phone: string;
  };
  fromFacility: {
    id: number;
    name: string;
  };
  toFacility: {
    id: number;
    name: string;
  };
  reason: string | null;
  urgency: string;
  status: string;
  statusNotes: string | null;
  createdAt: string;
  createdBy: {
    id: number;
    name: string;
    role: string;
  };
}

interface ReferralsTableProps {
  referrals: Referral[];
  isLoading: boolean;
  total: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onStatusFilterChange: (status: string) => void;
  statusFilter: string;
  onUpdateStatus: (referral: Referral) => void;
}

const VALID_STATUSES = ['PENDING', 'ACCEPTED', 'COMPLETED', 'DECLINED'];

const getStatusBadgeColor = (status: string): string => {
  switch (status) {
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-700';
    case 'ACCEPTED':
      return 'bg-blue-100 text-blue-700';
    case 'COMPLETED':
      return 'bg-green-100 text-green-700';
    case 'DECLINED':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const getUrgencyBadgeColor = (urgency: string): string => {
  switch (urgency) {
    case 'ROUTINE':
      return 'bg-gray-100 text-gray-700';
    case 'URGENT':
      return 'bg-orange-100 text-orange-700';
    case 'EMERGENCY':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const truncateText = (text: string | null, length: number): string => {
  if (!text) return '-';
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
};

export default function ReferralsTable({
  referrals,
  isLoading,
  total,
  currentPage,
  pageSize,
  onPageChange,
  onStatusFilterChange,
  statusFilter,
  onUpdateStatus,
}: ReferralsTableProps) {
  const totalPages = Math.ceil(total / pageSize);
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handleStatusFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>
  ) => {
    onStatusFilterChange(e.target.value);
  };

  if (isLoading && referrals.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-neutral-200 p-8 flex items-center justify-center gap-3">
        <Loader className="animate-spin text-blue-600" size={20} />
        <p className="text-neutral-600">Loading referrals...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-neutral-900">Referrals List</h2>
        <SelectDropdown
          name="statusFilter"
          value={statusFilter}
          onChange={handleStatusFilterChange}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'PENDING', label: 'Pending' },
            { value: 'ACCEPTED', label: 'Accepted' },
            { value: 'COMPLETED', label: 'Completed' },
            { value: 'DECLINED', label: 'Declined' },
          ]}
          className="w-48"
        />
      </div>

      {referrals.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-12 text-neutral-500">
          <AlertCircle size={20} />
          <p>No referrals found</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="px-4 py-3 text-left font-semibold text-neutral-900">Mother</th>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-900">From</th>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-900">To</th>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-900">Reason</th>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-900">Urgency</th>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-900">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-900">Created</th>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((referral) => (
                  <tr
                    key={referral.id}
                    className="border-b border-neutral-200 hover:bg-neutral-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-neutral-900">{referral.mother.fullName}</p>
                        <p className="text-xs text-neutral-600">{referral.mother.phone}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{referral.fromFacility.name}</td>
                    <td className="px-4 py-3 text-neutral-700">{referral.toFacility.name}</td>
                    <td className="px-4 py-3 text-neutral-700 max-w-xs">
                      {truncateText(referral.reason, 40)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getUrgencyBadgeColor(referral.urgency)}`}
                      >
                        {referral.urgency}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(referral.status)}`}
                      >
                        {referral.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-700 text-xs">
                      {formatDate(referral.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onUpdateStatus(referral)}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-xs font-medium"
                      >
                        Update Status
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-neutral-600">
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, total)} of {total} referrals
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className="p-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'border border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="p-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
