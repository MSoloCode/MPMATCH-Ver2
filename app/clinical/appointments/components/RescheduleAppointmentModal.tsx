'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { X } from 'lucide-react';

interface RescheduleAppointmentModalProps {
  isOpen: boolean;
  appointmentId?: number;
  currentDateTime?: string;
  currentNotes?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function RescheduleAppointmentModal({
  isOpen,
  appointmentId,
  currentDateTime = '',
  currentNotes = '',
  onClose,
  onSuccess,
}: RescheduleAppointmentModalProps) {
  const { token } = useAuth();

  const [appointmentDateTime, setAppointmentDateTime] = useState(currentDateTime);
  const [notes, setNotes] = useState(currentNotes);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAppointmentDateTime(currentDateTime);
      setNotes(currentNotes);
      setErrors({});
      setSuccessMessage('');
      setErrorMessage('');
    }
  }, [isOpen, currentDateTime, currentNotes]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!appointmentDateTime) {
      newErrors.appointmentDateTime = 'Date and time is required';
    } else {
      const apptDate = new Date(appointmentDateTime);
      const now = new Date();
      if (apptDate <= now) {
        newErrors.appointmentDateTime = 'Appointment must be in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !appointmentId) return;

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const payload = {
        status: 'SCHEDULED',
        appointmentDateTime: new Date(appointmentDateTime).toISOString(),
        notes: notes || null,
      };

      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || 'Failed to reschedule appointment');
        return;
      }

      setSuccessMessage('Appointment rescheduled successfully');

      // Close modal after a short delay
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Reschedule Appointment</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
            disabled={isLoading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        {successMessage && (
          <div className="m-4 p-3 bg-green-50 border border-green-200 rounded text-green-900 text-sm">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 rounded text-red-900 text-sm">
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* New Appointment Date/Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Date & Time *
            </label>
            <input
              type="datetime-local"
              value={appointmentDateTime}
              onChange={(e) => setAppointmentDateTime(e.target.value)}
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.appointmentDateTime ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.appointmentDateTime && (
              <p className="text-red-500 text-xs mt-1">{errors.appointmentDateTime}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isLoading}
              placeholder="Additional notes..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Rescheduling...' : 'Reschedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
