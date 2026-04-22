'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { X } from 'lucide-react';

interface Mother {
  id: number;
  fullName: string;
  phone: string;
}

interface Pregnancy {
  id: number;
  status: string;
}

interface ScheduleAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (appointmentId: number) => void;
}

export function ScheduleAppointmentModal({
  isOpen,
  onClose,
  onSuccess,
}: ScheduleAppointmentModalProps) {
  const { token } = useAuth();

  // Form state
  const [formData, setFormData] = useState({
    motherId: '',
    pregnancyId: '',
    appointmentDateTime: '',
    purpose: 'ROUTINE',
    purposeOther: '',
    notes: '',
  });

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [mothers, setMothers] = useState<Mother[]>([]);
  const [pregnancies, setPregnancies] = useState<Pregnancy[]>([]);
  const [nextVisitNumber, setNextVisitNumber] = useState<number | null>(null);
  const [loadingMothers, setLoadingMothers] = useState(false);
  const [loadingPregnancies, setLoadingPregnancies] = useState(false);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch mothers when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchMothers();
    }
  }, [isOpen]);

  // Fetch pregnancies when mother changes
  useEffect(() => {
    if (formData.motherId) {
      fetchPregnancies();
    } else {
      setPregnancies([]);
      setFormData((prev) => ({ ...prev, pregnancyId: '' }));
      setNextVisitNumber(null);
    }
  }, [formData.motherId]);

  // Fetch next visit number when pregnancy changes
  useEffect(() => {
    if (formData.pregnancyId) {
      fetchNextVisitNumber();
    } else {
      setNextVisitNumber(null);
    }
  }, [formData.pregnancyId]);

  const fetchMothers = async () => {
    setLoadingMothers(true);
    try {
      const response = await fetch('/api/mothers', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch mothers');

      const data = await response.json();
      if (data.success) {
        setMothers(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching mothers:', error);
      setMothers([]);
    } finally {
      setLoadingMothers(false);
    }
  };

  const fetchPregnancies = async () => {
    if (!formData.motherId) return;

    setLoadingPregnancies(true);
    try {
      const response = await fetch(
        `/api/pregnancies?motherId=${formData.motherId}&take=100`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch pregnancies');

      const data = await response.json();
      if (data.success) {
        setPregnancies(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching pregnancies:', error);
      setPregnancies([]);
    } finally {
      setLoadingPregnancies(false);
    }
  };

  const fetchNextVisitNumber = async () => {
    if (!formData.pregnancyId) return;

    setLoadingVisits(true);
    try {
      const response = await fetch(
        `/api/ancvisits?pregnancyId=${formData.pregnancyId}&take=1000`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch visits');

      const data = await response.json();
      if (data.success) {
        const visits = data.data || [];
        const maxVisitNumber = visits.length > 0 ? Math.max(...visits.map((v: any) => v.visitNumber || 0)) : 0;
        setNextVisitNumber(maxVisitNumber + 1);
      }
    } catch (error) {
      console.error('Error fetching visits:', error);
      setNextVisitNumber(null);
    } finally {
      setLoadingVisits(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.motherId) {
      newErrors.motherId = 'Mother is required';
    }

    if (!formData.pregnancyId) {
      newErrors.pregnancyId = 'Pregnancy is required';
    }

    if (!formData.appointmentDateTime) {
      newErrors.appointmentDateTime = 'Date and time is required';
    } else {
      const apptDate = new Date(formData.appointmentDateTime);
      const now = new Date();
      if (apptDate <= now) {
        newErrors.appointmentDateTime = 'Appointment must be in the future';
      }
    }

    if (!formData.purpose) {
      newErrors.purpose = 'Purpose is required';
    }

    if (formData.purpose === 'OTHER' && !formData.purposeOther) {
      newErrors.purposeOther = 'Please specify the purpose';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const payload = {
        motherId: parseInt(formData.motherId),
        pregnancyId: formData.pregnancyId ? parseInt(formData.pregnancyId) : null,
        appointmentDateTime: new Date(formData.appointmentDateTime).toISOString(),
        purpose: formData.purpose,
        purposeOther: formData.purpose === 'OTHER' ? formData.purposeOther : null,
        notes: formData.notes || null,
      };

      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || 'Failed to create appointment');
        return;
      }

      setSuccessMessage('Appointment created successfully');
      setFormData({
        motherId: '',
        pregnancyId: '',
        appointmentDateTime: '',
        purpose: 'ROUTINE',
        purposeOther: '',
        notes: '',
      });
      setErrors({});

      // Call success callback with appointment ID
      onSuccess(data.data.id);

      // Close modal after a short delay
      setTimeout(() => {
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
          <h2 className="text-lg font-bold text-gray-900">Schedule Appointment</h2>
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
          {/* Mother */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mother *
            </label>
            <select
              value={formData.motherId}
              onChange={(e) => setFormData((prev) => ({ ...prev, motherId: e.target.value }))}
              disabled={isLoading || loadingMothers}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.motherId ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select a mother...</option>
              {mothers.map((mother) => (
                <option key={mother.id} value={mother.id}>
                  {mother.fullName} ({mother.phone})
                </option>
              ))}
            </select>
            {errors.motherId && <p className="text-red-500 text-xs mt-1">{errors.motherId}</p>}
          </div>

          {/* Pregnancy */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pregnancy *
            </label>
            <select
              value={formData.pregnancyId}
              onChange={(e) => setFormData((prev) => ({ ...prev, pregnancyId: e.target.value }))}
              disabled={isLoading || !formData.motherId || loadingPregnancies}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.pregnancyId ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select a pregnancy...</option>
              {pregnancies.map((pregnancy) => (
                <option key={pregnancy.id} value={pregnancy.id}>
                  Pregnancy #{pregnancy.id} ({pregnancy.status})
                </option>
              ))}
            </select>
            {errors.pregnancyId && <p className="text-red-500 text-xs mt-1">{errors.pregnancyId}</p>}
          </div>

          {/* ANC Visit Number (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ANC Visit #
            </label>
            <input
              type="text"
              value={loadingVisits ? 'Loading...' : nextVisitNumber || 'TBD'}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
            />
          </div>

          {/* Appointment Date/Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date & Time *
            </label>
            <input
              type="datetime-local"
              value={formData.appointmentDateTime}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, appointmentDateTime: e.target.value }))
              }
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.appointmentDateTime ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.appointmentDateTime && (
              <p className="text-red-500 text-xs mt-1">{errors.appointmentDateTime}</p>
            )}
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Purpose *
            </label>
            <select
              value={formData.purpose}
              onChange={(e) => setFormData((prev) => ({ ...prev, purpose: e.target.value }))}
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.purpose ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="ROUTINE">Routine Checkup</option>
              <option value="SCANNING">Scanning</option>
              <option value="REVIEW">Review</option>
              <option value="OTHER">Other</option>
            </select>
            {errors.purpose && <p className="text-red-500 text-xs mt-1">{errors.purpose}</p>}
          </div>

          {/* Purpose Other (visible when purpose is OTHER) */}
          {formData.purpose === 'OTHER' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Specify Purpose *
              </label>
              <input
                type="text"
                value={formData.purposeOther}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, purposeOther: e.target.value }))
                }
                disabled={isLoading}
                placeholder="e.g., Follow-up consultation"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.purposeOther ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.purposeOther && (
                <p className="text-red-500 text-xs mt-1">{errors.purposeOther}</p>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
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
              {isLoading ? 'Creating...' : 'Create Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
