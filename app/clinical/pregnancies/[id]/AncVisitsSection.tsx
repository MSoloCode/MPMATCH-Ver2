'use client';

import { Clock } from 'lucide-react';

interface AncVisit {
  id: number;
  visitNumber: number;
  visitType: string;
  purposeOther?: string;
  visitDateTime: string;
  nextAppointment?: string;
  notes?: string;
  createdAt: string;
}

interface AncVisitsSectionProps {
  visits: AncVisit[];
  onAddVisit?: () => void;
}

export function AncVisitsSection({ visits, onAddVisit }: AncVisitsSectionProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-UG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-UG', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getVisitTypeColor = (type: string) => {
    switch (type) {
      case 'ROUTINE':
        return 'bg-blue-100 text-blue-800';
      case 'SCANNING':
        return 'bg-purple-100 text-purple-800';
      case 'REVIEW':
        return 'bg-orange-100 text-orange-800';
      case 'OTHER':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getVisitTypeLabel = (type: string) => {
    switch (type) {
      case 'ROUTINE':
        return 'Routine Checkup';
      case 'SCANNING':
        return 'Ultrasound Scan';
      case 'REVIEW':
        return 'Review Visit';
      case 'OTHER':
        return 'Other';
      default:
        return type;
    }
  };

  if (!visits || visits.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">ANC Visits</h2>
          {onAddVisit && (
            <button
              onClick={onAddVisit}
              className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              + Add Visit
            </button>
          )}
        </div>
        <p className="text-gray-600">No ANC visits recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">ANC Visits ({visits.length})</h2>
        {onAddVisit && (
          <button
            onClick={onAddVisit}
            className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Add Visit
          </button>
        )}
      </div>

      <div className="space-y-4">
        {visits.map((visit, index) => (
          <div
            key={visit.id}
            className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-800 font-bold">
                  {visit.visitNumber}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Visit #{visit.visitNumber}</p>
                  <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                    <Clock size={14} />
                    {formatDate(visit.visitDateTime)} at {formatTime(visit.visitDateTime)}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getVisitTypeColor(visit.visitType)}`}>
                {getVisitTypeLabel(visit.visitType)}
              </span>
            </div>

            {visit.notes && (
              <div className="mb-3 pl-13">
                <p className="text-sm text-gray-700 bg-gray-50 rounded p-2">{visit.notes}</p>
              </div>
            )}

            {visit.nextAppointment && (
              <div className="pl-13 text-sm text-gray-600">
                <p>
                  <span className="font-medium">Next Appointment:</span> {formatDate(visit.nextAppointment)}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
