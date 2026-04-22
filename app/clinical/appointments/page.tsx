'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { RoleGuard } from '@/components/RoleGuard';
import { AppointmentsTable } from './components/AppointmentsTable';
import { ScheduleAppointmentModal } from './components/ScheduleAppointmentModal';
import { RescheduleAppointmentModal } from './components/RescheduleAppointmentModal';
import { useAppointmentsList } from './hooks/useAppointmentsList';

export default function AppointmentsPage() {
  const router = useRouter();
  const { token } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  // Modal states
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleData, setRescheduleData] = useState<{
    appointmentId: number;
    currentDateTime: string;
    currentNotes: string;
  } | null>(null);

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Fetch appointments based on active tab
  const { appointments, isLoading, error, currentPage, totalPages, totalCount, rowsPerPage, 
          goToPage, nextPage, previousPage, refetch } = useAppointmentsList({
    upcoming: activeTab === 'upcoming',
  });

  const handleShowToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleScheduleAppointmentSuccess = useCallback((appointmentId: number) => {
    handleShowToast('Appointment scheduled successfully!', 'success');
    refetch();
  }, [refetch]);

  const handleRescheduleAppointmentOpen = (appointmentId: number, currentDateTime: string, currentNotes: string = '') => {
    setRescheduleData({ appointmentId, currentDateTime, currentNotes });
    setShowRescheduleModal(true);
  };

  const handleRescheduleSuccess = useCallback(() => {
    handleShowToast('Appointment rescheduled successfully!', 'success');
    refetch();
  }, [refetch]);

  const handleMarkAttended = async (appointmentId: number) => {
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'ATTENDED' }),
      });

      const data = await response.json();

      if (!response.ok) {
        handleShowToast(data.error || 'Failed to update appointment', 'error');
        return;
      }

      handleShowToast('Appointment marked as attended', 'success');
      refetch();
    } catch (error) {
      handleShowToast(
        error instanceof Error ? error.message : 'An error occurred',
        'error'
      );
    }
  };

  const handleMarkMissed = async (appointmentId: number) => {
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'MISSED' }),
      });

      const data = await response.json();

      if (!response.ok) {
        handleShowToast(data.error || 'Failed to update appointment', 'error');
        return;
      }

      handleShowToast('Appointment marked as missed', 'success');
      refetch();
    } catch (error) {
      handleShowToast(
        error instanceof Error ? error.message : 'An error occurred',
        'error'
      );
    }
  };

  return (
    <RoleGuard requiredRole="DOCTOR|NURSE|MIDWIFE|CHW">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Appointments</h1>
            <p className="text-gray-600 mt-1">Manage mother appointments and follow-ups</p>
          </div>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="px-6 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Schedule appointment
          </button>
        </div>

        {/* Toast Notification */}
        {toast && (
          <div
            className={`p-4 rounded-lg ${
              toast.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-900'
                : 'bg-red-50 border border-red-200 text-red-900'
            }`}
          >
            {toast.message}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`flex-1 px-6 py-4 font-medium text-center transition-colors ${
                activeTab === 'upcoming'
                  ? 'text-gray-900 border-b-2 border-gray-900 bg-gray-50'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`flex-1 px-6 py-4 font-medium text-center transition-colors ${
                activeTab === 'past'
                  ? 'text-gray-900 border-b-2 border-gray-900 bg-gray-50'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Past
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-900">
              {error}
            </div>
          )}

          {/* Table */}
          <div className="p-6">
            <AppointmentsTable
              appointments={appointments}
              isLoading={isLoading}
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              rowsPerPage={rowsPerPage}
              onNextPage={nextPage}
              onPreviousPage={previousPage}
              onGoToPage={goToPage}
              onMarkAttended={handleMarkAttended}
              onMarkMissed={handleMarkMissed}
              onReschedule={(appointmentId, currentDateTime) => {
                const appointment = appointments.find((a) => a.id === appointmentId);
                handleRescheduleAppointmentOpen(
                  appointmentId,
                  currentDateTime,
                  appointment?.notes || ''
                );
              }}
            />
          </div>
        </div>
      </div>

      {/* Schedule Appointment Modal */}
      <ScheduleAppointmentModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSuccess={handleScheduleAppointmentSuccess}
      />

      {/* Reschedule Appointment Modal */}
      {rescheduleData && (
        <RescheduleAppointmentModal
          isOpen={showRescheduleModal}
          appointmentId={rescheduleData.appointmentId}
          currentDateTime={rescheduleData.currentDateTime}
          currentNotes={rescheduleData.currentNotes}
          onClose={() => {
            setShowRescheduleModal(false);
            setRescheduleData(null);
          }}
          onSuccess={handleRescheduleSuccess}
        />
      )}
    </RoleGuard>
  );
}
