'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpRight, Info } from 'lucide-react';
import { formatVisitDateTime } from '@/lib/date-format';
import VisitDetailsModal from '@/components/VisitDetailsModal';

interface AncVisit {
  id: number;
  visitNumber: number;
  pregnancyId: number;
  motherId: number;
  visitType: string;
  purposeOther?: string | null;
  visitDateTime: string;
  nextAppointment?: string | null;
  notes?: string | null;
  mother: {
    id: number;
    fullName: string;
    phone: string;
  };
  createdBy: {
    id: number;
    name: string;
    role: string;
  };
}

interface RecentAncVisitsTableProps {
  visits: AncVisit[];
  isLoading?: boolean;
  highlightedVisitId?: number | null;
}

const getVisitTypeBadgeColor = (visitType: string) => {
  switch (visitType) {
    case 'ROUTINE':
      return 'bg-blue-100 text-blue-800';
    case 'SCANNING':
      return 'bg-purple-100 text-purple-800';
    case 'REVIEW':
      return 'bg-orange-100 text-orange-800';
    case 'OTHER':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-neutral-100 text-neutral-800';
  }
};

export default function RecentAncVisitsTable({
  visits,
  isLoading = false,
  highlightedVisitId = null,
}: RecentAncVisitsTableProps) {
  const [highlightedId, setHighlightedId] = useState<number | null>(highlightedVisitId);
  const [selectedVisit, setSelectedVisit] = useState<AncVisit | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (highlightedVisitId) {
      setHighlightedId(highlightedVisitId);

      // Scroll to highlighted row
      if (highlightedRowRef.current) {
        highlightedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      // Remove highlight after 3 seconds
      const timer = setTimeout(() => {
        setHighlightedId(null);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [highlightedVisitId]);

  const handleInfoClick = (visit: AncVisit) => {
    setSelectedVisit(visit);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedVisit(null);
  };

  const handleTrendClick = (visit: AncVisit) => {
    // Navigate to vitals/symptoms page for this visit
    // Route: /clinical/pregnancies/[pregnancyId]/visits/[visitId]
    window.location.href = `/clinical/pregnancies/${visit.pregnancyId}/visits/${visit.id}`;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Recent ANC Visits</h3>
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (visits.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Recent ANC Visits</h3>
        <p className="text-neutral-600 text-center py-8">No ANC visits found. Create one to get started!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-neutral-900 mb-4">Recent ANC Visits</h3>

      <div className="overflow-x-auto">
        <table ref={tableRef} className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-300 bg-neutral-50">
              <th className="text-left px-4 py-3 font-semibold text-neutral-900">ID</th>
              <th className="text-left px-4 py-3 font-semibold text-neutral-900">Mother</th>
              <th className="text-left px-4 py-3 font-semibold text-neutral-900">Visit #</th>
              <th className="text-left px-4 py-3 font-semibold text-neutral-900">Pregnancy ID</th>
              <th className="text-left px-4 py-3 font-semibold text-neutral-900">Type</th>
              <th className="text-left px-4 py-3 font-semibold text-neutral-900">Visit Date</th>
              <th className="text-left px-4 py-3 font-semibold text-neutral-900">Next Appt</th>
              <th className="text-center px-4 py-3 font-semibold text-neutral-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visits.map((visit) => (
              <tr
                key={visit.id}
                ref={highlightedId === visit.id ? highlightedRowRef : null}
                className={`border-b border-neutral-200 hover:bg-neutral-50 transition-colors ${
                  highlightedId === visit.id ? 'bg-yellow-100 animate-pulse' : ''
                }`}
              >
                {/* ID */}
                <td className="px-4 py-3 text-neutral-900 font-medium">{visit.id}</td>

                {/* Mother - Name + Phone */}
                <td className="px-4 py-3">
                  <div className="text-neutral-900 font-medium">{visit.mother.fullName}</div>
                  <div className="text-sm text-neutral-600">{visit.mother.phone}</div>
                </td>

                {/* Visit # */}
                <td className="px-4 py-3 text-neutral-900 font-medium">{visit.visitNumber}</td>

                {/* Pregnancy ID */}
                <td className="px-4 py-3 text-neutral-900 font-medium">{visit.pregnancyId}</td>

                {/* Type */}
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getVisitTypeBadgeColor(
                      visit.visitType
                    )}`}
                  >
                    {visit.visitType}
                  </span>
                </td>

                {/* Visit Date */}
                <td className="px-4 py-3 text-neutral-600">{formatVisitDateTime(visit.visitDateTime)}</td>

                {/* Next Appointment */}
                <td className="px-4 py-3 text-neutral-600">{formatVisitDateTime(visit.nextAppointment)}</td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex justify-center items-center gap-2">
                    {/* Trend/Vitals Button */}
                    <button
                      onClick={() => handleTrendClick(visit)}
                      className="inline-flex items-center justify-center p-2 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="View vitals and symptoms"
                      aria-label="View vitals"
                    >
                      <ArrowUpRight size={18} />
                    </button>

                    {/* Info Button */}
                    <button
                      onClick={() => handleInfoClick(visit)}
                      className="inline-flex items-center justify-center p-2 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="View visit details"
                      aria-label="View details"
                    >
                      <Info size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visits.length > 10 && (
        <p className="text-xs text-neutral-500 mt-4">Showing {visits.length} recent visits</p>
      )}

      {/* Visit Details Modal */}
      {selectedVisit && (
        <VisitDetailsModal visit={selectedVisit} isOpen={isModalOpen} onClose={handleCloseModal} />
      )}
    </div>
  );
}
