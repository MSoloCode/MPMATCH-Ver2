'use client';

import React, { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface AncVisit {
  id: number;
  visitNumber: number;
  visitType: string;
  visitDateTime: string;
  nextAppointment?: string | null;
  notes?: string | null;
  mother: {
    id: number;
    fullName: string;
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
              <th className="text-left px-4 py-3 font-semibold text-neutral-900">Mother</th>
              <th className="text-left px-4 py-3 font-semibold text-neutral-900">Visit Type</th>
              <th className="text-left px-4 py-3 font-semibold text-neutral-900">Visit Date</th>
              <th className="text-left px-4 py-3 font-semibold text-neutral-900">Next Appointment</th>
              <th className="text-left px-4 py-3 font-semibold text-neutral-900">Created By</th>
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
                <td className="px-4 py-3 text-neutral-900 font-medium">{visit.mother.fullName}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getVisitTypeBadgeColor(
                      visit.visitType
                    )}`}
                  >
                    {visit.visitType}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  {new Date(visit.visitDateTime).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  <br />
                  <span className="text-xs text-neutral-500">
                    {formatDistanceToNow(new Date(visit.visitDateTime), { addSuffix: true })}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  {visit.nextAppointment
                    ? new Date(visit.nextAppointment).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  {visit.createdBy.name}
                  <br />
                  <span className="text-xs text-neutral-500">{visit.createdBy.role}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visits.length > 10 && (
        <p className="text-xs text-neutral-500 mt-4">Showing {visits.length} recent visits</p>
      )}
    </div>
  );
}
