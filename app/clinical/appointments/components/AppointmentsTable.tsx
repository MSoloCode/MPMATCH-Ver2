'use client';

import { useRouter } from 'next/navigation';
import { Appointment } from '@/app/clinical/appointments/hooks/useAppointmentsList';
import {
  getStatusDisplay,
  getStatusColor,
  formatAppointmentDateTime,
  getPurposeDisplay,
  isLikelyMissed,
  canReschedule,
  canMarkAttended,
  canMarkMissed,
} from '@/app/clinical/appointments/utils/formatters';
import { MoreVertical } from 'lucide-react';
import { useState } from 'react';

interface AppointmentsTableProps {
  appointments: Appointment[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  rowsPerPage: number;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onGoToPage: (page: number) => void;
  onMarkAttended?: (appointmentId: number) => void;
  onMarkMissed?: (appointmentId: number) => void;
  onReschedule?: (appointmentId: number, currentDateTime: string) => void;
}

export function AppointmentsTable({
  appointments,
  isLoading,
  currentPage,
  totalPages,
  totalCount,
  rowsPerPage,
  onNextPage,
  onPreviousPage,
  onGoToPage,
  onMarkAttended,
  onMarkMissed,
  onReschedule,
}: AppointmentsTableProps) {
  const router = useRouter();
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const startIndex = (currentPage - 1) * rowsPerPage + 1;
  const endIndex = Math.min(currentPage * rowsPerPage, totalCount);

  const handleMarkAttended = async (appointmentId: number) => {
    setOpenMenuId(null);
    onMarkAttended?.(appointmentId);
  };

  const handleMarkMissed = async (appointmentId: number) => {
    setOpenMenuId(null);
    onMarkMissed?.(appointmentId);
  };

  const handleReschedule = (appointmentId: number, currentDateTime: string) => {
    setOpenMenuId(null);
    onReschedule?.(appointmentId, currentDateTime);
  };

  const renderActionButtons = (appointment: Appointment) => {
    const status = appointment.status as any;

    return (
      <div className="relative">
        <button
          onClick={() => setOpenMenuId(openMenuId === appointment.id ? null : appointment.id)}
          className="p-1 hover:bg-gray-100 rounded"
          title="More actions"
        >
          <MoreVertical size={18} />
        </button>

        {openMenuId === appointment.id && (
          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
            {canMarkAttended(status) && (
              <button
                onClick={() => handleMarkAttended(appointment.id)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-200 font-medium text-green-600"
              >
                Mark attended
              </button>
            )}
            {canMarkMissed(status) && (
              <button
                onClick={() => handleMarkMissed(appointment.id)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-200 font-medium text-red-600"
              >
                Mark missed
              </button>
            )}
            {canReschedule(status) && (
              <button
                onClick={() =>
                  handleReschedule(appointment.id, appointment.appointmentDateTime)
                }
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 font-medium text-blue-600"
              >
                Reschedule
              </button>
            )}
            {Object.keys(renderActionButtons).length === 0 && (
              <div className="px-4 py-2 text-sm text-gray-500">No actions available</div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-x-auto border border-gray-300 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b border-gray-300">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Mother</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Pregnancy</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">ANC Visit #</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">
                Appointment Date/Time
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Purpose</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Loading appointments...
                </td>
              </tr>
            ) : appointments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No appointments found
                </td>
              </tr>
            ) : (
              appointments.map((appointment) => {
                const statusColor = getStatusColor(appointment.status as any);
                const isHighlighted = isLikelyMissed(appointment.status as any);

                return (
                  <tr
                    key={appointment.id}
                    className={`border-b border-gray-200 ${
                      isHighlighted ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {appointment.mother?.fullName || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {appointment.pregnancy?.id || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {appointment.ancVisitId ? `Visit #${appointment.ancVisitId}` : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatAppointmentDateTime(appointment.appointmentDateTime)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {getPurposeDisplay(appointment.purpose)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
                      >
                        {getStatusDisplay(appointment.status as any)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {renderActionButtons(appointment)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing {startIndex}-{endIndex} of {totalCount}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onPreviousPage}
            disabled={currentPage === 1 || isLoading}
            className="px-3 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <div className="flex items-center gap-1">
            {/* Page number buttons */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = currentPage > 3 ? currentPage - 2 + i : i + 1;
              if (pageNum > totalPages) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => onGoToPage(pageNum)}
                  disabled={isLoading}
                  className={`px-2 py-1 rounded text-sm font-medium ${
                    pageNum === currentPage
                      ? 'bg-gray-900 text-white'
                      : 'border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={onNextPage}
            disabled={currentPage === totalPages || isLoading}
            className="px-3 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
