'use client';

import React from 'react';
import { X } from 'lucide-react';
import { formatVisitDateTime } from '@/lib/date-format';

interface VisitDetailsModalProps {
  visit: {
    id: number;
    visitNumber: number;
    pregnancyId: number;
    motherId: number;
    visitType: string;
    purposeOther?: string | null;
    visitDateTime: string | Date;
    nextAppointment?: string | Date | null;
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
  };
  isOpen: boolean;
  onClose: () => void;
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

export default function VisitDetailsModal({ visit, isOpen, onClose }: VisitDetailsModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl z-50 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-neutral-900">Visit Details</h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Visit ID & Number */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase">Visit ID</p>
              <p className="mt-1 text-sm font-medium text-neutral-900">{visit.id}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase">Visit #</p>
              <p className="mt-1 text-sm font-medium text-neutral-900">{visit.visitNumber}</p>
            </div>
          </div>

          {/* Mother Information */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase">Mother</p>
            <div className="mt-2 bg-neutral-50 rounded p-3">
              <p className="font-medium text-neutral-900">{visit.mother.fullName}</p>
              <p className="text-sm text-neutral-600">{visit.mother.phone}</p>
            </div>
          </div>

          {/* Pregnancy ID */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase">Pregnancy ID</p>
            <p className="mt-1 text-sm font-medium text-neutral-900">{visit.pregnancyId}</p>
          </div>

          {/* Visit Type */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase">Visit Type</p>
            <div className="mt-2">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getVisitTypeBadgeColor(visit.visitType)}`}>
                {visit.visitType}
              </span>
              {visit.visitType === 'OTHER' && visit.purposeOther && (
                <p className="mt-2 text-sm text-neutral-600">Purpose: {visit.purposeOther}</p>
              )}
            </div>
          </div>

          {/* Visit Date */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase">Visit Date</p>
            <p className="mt-1 text-sm font-medium text-neutral-900">{formatVisitDateTime(visit.visitDateTime)}</p>
          </div>

          {/* Next Appointment */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase">Next Appointment</p>
            <p className="mt-1 text-sm font-medium text-neutral-900">{formatVisitDateTime(visit.nextAppointment)}</p>
          </div>

          {/* Notes */}
          {visit.notes && (
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase">Notes</p>
              <p className="mt-2 text-sm text-neutral-700 bg-neutral-50 rounded p-3 whitespace-pre-wrap">{visit.notes}</p>
            </div>
          )}

          {/* Created By */}
          <div className="border-t border-neutral-200 pt-4">
            <p className="text-xs font-semibold text-neutral-500 uppercase">Created By</p>
            <div className="mt-2 text-sm">
              <p className="font-medium text-neutral-900">{visit.createdBy.name}</p>
              <p className="text-neutral-600">{visit.createdBy.role}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 bg-neutral-50 px-6 py-3">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
