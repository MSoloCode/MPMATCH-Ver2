'use client';

import React, { useState, useEffect } from 'react';
import { TextInput, SelectDropdown, Textarea } from '@/components/FormInputs';
import { Loader2 } from 'lucide-react';

interface Mother {
  id: number;
  fullName: string;
  phone: string;
}

interface Pregnancy {
  id: number;
  motherId: number;
  gravida?: number;
  parity?: number;
  isHighRisk: boolean;
  status: string;
}

interface AncVisitFormProps {
  onSuccess?: (visitId: number) => void;
  isLoading?: boolean;
}

export default function AncVisitForm({ onSuccess, isLoading = false }: AncVisitFormProps) {
  // Form state
  const [formData, setFormData] = useState({
    motherId: '',
    pregnancyId: '',
    visitType: '',
    visitDateTime: new Date().toISOString().slice(0, 16),
    nextAppointment: '',
    notes: '',
    purposeOther: '',
  });

  // Dropdown data
  const [mothers, setMothers] = useState<Mother[]>([]);
  const [pregnancies, setPregnancies] = useState<Pregnancy[]>([]);

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingMothers, setLoadingMothers] = useState(true);
  const [loadingPregnancies, setLoadingPregnancies] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Fetch mothers on mount
  useEffect(() => {
    const fetchMothers = async () => {
      try {
        const response = await fetch('/api/mothers', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (!response.ok) throw new Error('Failed to fetch mothers');
        const data = await response.json();
        setMothers(data.data || data || []);
      } catch (error) {
        console.error('Error fetching mothers:', error);
        setMothers([]);
      } finally {
        setLoadingMothers(false);
      }
    };
    fetchMothers();
  }, []);

  // Fetch pregnancies when mother is selected
  useEffect(() => {
    if (!formData.motherId) {
      setPregnancies([]);
      return;
    }

    const fetchPregnancies = async () => {
      setLoadingPregnancies(true);
      try {
        const response = await fetch(`/api/pregnancies?motherId=${formData.motherId}&status=ACTIVE`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (!response.ok) throw new Error('Failed to fetch pregnancies');
        const data = await response.json();
        setPregnancies(data.data || []);
        // Clear pregnancy selection when mother changes
        setFormData((prev) => ({ ...prev, pregnancyId: '' }));
      } catch (error) {
        console.error('Error fetching pregnancies:', error);
        setPregnancies([]);
      } finally {
        setLoadingPregnancies(false);
      }
    };

    fetchPregnancies();
  }, [formData.motherId]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.motherId) newErrors.motherId = 'Mother is required';
    if (!formData.pregnancyId) newErrors.pregnancyId = 'Pregnancy is required';
    if (!formData.visitType) newErrors.visitType = 'Visit type is required';
    if (!formData.visitDateTime) newErrors.visitDateTime = 'Visit date/time is required';
    if (formData.visitType === 'OTHER' && !formData.purposeOther) {
      newErrors.purposeOther = 'Please describe the visit purpose';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/ancvisits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          pregnancyId: parseInt(formData.pregnancyId, 10),
          motherId: parseInt(formData.motherId, 10),
          visitType: formData.visitType,
          visitDateTime: formData.visitDateTime,
          nextAppointment: formData.nextAppointment || null,
          notes: formData.notes || null,
          purposeOther: formData.visitType === 'OTHER' ? formData.purposeOther : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create ANC visit');
      }

      const result = await response.json();
      setSubmitSuccess(true);

      // Reset form
      setFormData({
        motherId: '',
        pregnancyId: '',
        visitType: '',
        visitDateTime: new Date().toISOString().slice(0, 16),
        nextAppointment: '',
        notes: '',
        purposeOther: '',
      });

      // Call onSuccess callback with visit ID
      if (onSuccess) {
        onSuccess(result.data.id);
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-neutral-900 mb-6">Create ANC Visit</h2>

      {submitError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{submitError}</p>
        </div>
      )}

      {submitSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">ANC visit created successfully!</p>
        </div>
      )}

      {/* Row 1: Mother | Pregnancy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <SelectDropdown
          name="motherId"
          label="Mother"
          value={formData.motherId}
          onChange={handleInputChange}
          error={errors.motherId}
          disabled={loadingMothers}
          options={mothers.map((m) => ({
            value: m.id,
            label: `${m.fullName} (${m.phone})`,
          }))}
          required
        />

        <SelectDropdown
          name="pregnancyId"
          label="Pregnancy"
          value={formData.pregnancyId}
          onChange={handleInputChange}
          error={errors.pregnancyId}
          disabled={!formData.motherId || loadingPregnancies}
          options={pregnancies.map((p) => ({
            value: p.id,
            label: `#${p.id} (G${p.gravida || '-'} P${p.parity || '-'})`,
          }))}
          required
        />
      </div>

      {formData.motherId && !formData.pregnancyId && pregnancies.length === 0 && !loadingPregnancies && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 mb-6">
          If you don't see a pregnancy, open one from the Mothers page.
        </p>
      )}

      {/* Row 2: Visit Type | Visit Date/Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <SelectDropdown
          name="visitType"
          label="Visit Type"
          value={formData.visitType}
          onChange={handleInputChange}
          error={errors.visitType}
          options={[
            { value: 'ROUTINE', label: 'Routine' },
            { value: 'SCANNING', label: 'Scanning' },
            { value: 'REVIEW', label: 'Review' },
            { value: 'OTHER', label: 'Other' },
          ]}
          required
        />

        <TextInput
          type="datetime-local"
          name="visitDateTime"
          label="Visit Date & Time"
          value={formData.visitDateTime}
          onChange={handleInputChange}
          error={errors.visitDateTime}
          required
        />
      </div>

      {/* Conditional: Purpose (if visitType === OTHER) */}
      {formData.visitType === 'OTHER' && (
        <div className="mb-6">
          <TextInput
            name="purposeOther"
            label="Describe Visit Purpose"
            placeholder="Enter the purpose of this visit"
            value={formData.purposeOther}
            onChange={handleInputChange}
            error={errors.purposeOther}
            required
          />
        </div>
      )}

      {/* Row 3: Next Appointment (full-width) */}
      <div className="mb-6">
        <TextInput
          type="datetime-local"
          name="nextAppointment"
          label="Next Appointment (Optional)"
          value={formData.nextAppointment}
          onChange={handleInputChange}
        />
      </div>

      {/* Row 4: Notes (full-width) */}
      <div className="mb-6">
        <Textarea
          name="notes"
          label="Notes (Optional)"
          placeholder="Add any notes about this visit..."
          value={formData.notes}
          onChange={handleInputChange}
          rows={4}
        />
      </div>

      {/* Submit Button */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading || isLoading}
          className="flex items-center gap-2 px-6 py-3 bg-blue-700 text-white font-semibold rounded-lg hover:bg-blue-800 disabled:bg-neutral-400 disabled:cursor-not-allowed transition-colors"
        >
          {(loading || isLoading) && <Loader2 className="w-4 h-4 animate-spin" />}
          Create Visit
        </button>
      </div>
    </form>
  );
}
