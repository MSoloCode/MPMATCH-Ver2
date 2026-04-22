'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { TextInput, SelectDropdown, Textarea } from './FormInputs';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';

interface Mother {
  id: number;
  fullName: string;
  phone: string;
}

interface Pregnancy {
  id: number;
  edd: string | null;
  gravida: number | null;
  parity: number | null;
  riskFactors: string | null;
  isHighRisk: boolean;
  status: string;
}

interface Facility {
  id: number;
  name: string;
}

interface ReferralFormProps {
  userFacilityId?: number;
  userFacilityName?: string;
  onSuccess?: () => void;
}

interface FormData {
  motherId: string;
  pregnancyId: string;
  toFacilityId: string;
  reason: string;
  notes: string;
  urgency: string;
}

interface Errors {
  [key: string]: string;
}

export default function ReferralForm({
  userFacilityId,
  userFacilityName = 'Current Facility',
  onSuccess,
}: ReferralFormProps) {
  const [formData, setFormData] = useState<FormData>({
    motherId: '',
    pregnancyId: '',
    toFacilityId: '',
    reason: '',
    notes: '',
    urgency: 'ROUTINE',
  });

  const [errors, setErrors] = useState<Errors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [mothers, setMothers] = useState<Mother[]>([]);
  const [pregnancies, setPregnancies] = useState<Pregnancy[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);

  const [selectedPregnancy, setSelectedPregnancy] = useState<Pregnancy | null>(null);
  const [isLoadingMothers, setIsLoadingMothers] = useState(false);
  const [isLoadingPregnancies, setIsLoadingPregnancies] = useState(false);

  // Fetch mothers and facilities on mount
  useEffect(() => {
    fetchMothers();
    fetchFacilities();
  }, []);

  // Fetch pregnancies when mother is selected
  useEffect(() => {
    if (formData.motherId) {
      fetchPregnancies(parseInt(formData.motherId));
    } else {
      setPregnancies([]);
      setFormData((prev) => ({ ...prev, pregnancyId: '' }));
    }
  }, [formData.motherId]);

  // Update selected pregnancy when pregnancyId changes
  useEffect(() => {
    if (formData.pregnancyId) {
      const pregnancy = pregnancies.find((p) => p.id === parseInt(formData.pregnancyId));
      setSelectedPregnancy(pregnancy || null);
    } else {
      setSelectedPregnancy(null);
    }
  }, [formData.pregnancyId, pregnancies]);

  const fetchMothers = async () => {
    try {
      setIsLoadingMothers(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/mothers', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch mothers');

      const result = await response.json();
      setMothers(result.data || []);
    } catch (error) {
      console.error('Error fetching mothers:', error);
      setErrorMessage('Failed to load mothers');
    } finally {
      setIsLoadingMothers(false);
    }
  };

  const fetchPregnancies = async (motherId: number) => {
    try {
      setIsLoadingPregnancies(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/pregnancies?motherId=${motherId}&take=100`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch pregnancies');

      const result = await response.json();
      setPregnancies(result.data || []);
    } catch (error) {
      console.error('Error fetching pregnancies:', error);
      setErrorMessage('Failed to load pregnancies');
      setPregnancies([]);
    } finally {
      setIsLoadingPregnancies(false);
    }
  };

  const fetchFacilities = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/facilities', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch facilities');

      const result = await response.json();
      // Filter out the user's own facility from receiving facilities
      const filtered = (result.data || []).filter(
        (f: Facility) => !userFacilityId || f.id !== userFacilityId
      );
      setFacilities(filtered);
    } catch (error) {
      console.error('Error fetching facilities:', error);
      setErrorMessage('Failed to load facilities');
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Errors = {};

    if (!formData.motherId) {
      newErrors.motherId = 'Mother is required';
    }
    if (!formData.pregnancyId) {
      newErrors.pregnancyId = 'Pregnancy is required';
    }
    if (!formData.toFacilityId) {
      newErrors.toFacilityId = 'Receiving facility is required';
    }
    if (!formData.urgency) {
      newErrors.urgency = 'Urgency is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleUrgencyChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      urgency: value,
    }));
    if (errors.urgency) {
      setErrors((prev) => ({
        ...prev,
        urgency: '',
      }));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage('');
      setSuccessMessage('');

      const token = localStorage.getItem('token');
      const response = await fetch('/api/referrals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          motherId: parseInt(formData.motherId),
          pregnancyId: parseInt(formData.pregnancyId),
          toFacilityId: parseInt(formData.toFacilityId),
          reason: formData.reason || null,
          notes: formData.notes || null,
          urgency: formData.urgency,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create referral');
      }

      setSuccessMessage('Referral created successfully!');

      // Reset form
      setFormData({
        motherId: '',
        pregnancyId: '',
        toFacilityId: '',
        reason: '',
        notes: '',
        urgency: 'ROUTINE',
      });
      setSelectedPregnancy(null);

      // Call callback
      if (onSuccess) {
        onSuccess();
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error creating referral:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create referral');
    } finally {
      setIsLoading(false);
    }
  };

  const formatRiskFactors = (riskFactorsJson: string | null): string[] => {
    if (!riskFactorsJson) return [];
    try {
      return Array.isArray(JSON.parse(riskFactorsJson)) ? JSON.parse(riskFactorsJson) : [];
    } catch {
      return [];
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-8">
      <h2 className="text-xl font-bold text-neutral-900 mb-6">Create New Referral</h2>

      {successMessage && (
        <div className="mb-4 flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="text-green-600" size={20} />
          <span className="text-green-700 text-sm">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="text-red-600" size={20} />
          <span className="text-red-700 text-sm">{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mother and Pregnancy Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectDropdown
            label="Mother"
            name="motherId"
            value={formData.motherId}
            onChange={handleInputChange}
            error={errors.motherId}
            options={mothers.map((m) => ({
              value: m.id,
              label: `${m.fullName} (${m.phone})`,
            }))}
            placeholder={isLoadingMothers ? 'Loading mothers...' : 'Select a mother'}
            disabled={isLoadingMothers}
            required
          />

          <SelectDropdown
            label="Pregnancy"
            name="pregnancyId"
            value={formData.pregnancyId}
            onChange={handleInputChange}
            error={errors.pregnancyId}
            options={pregnancies.map((p) => ({
              value: p.id,
              label: `ID: ${p.id} | EDD: ${formatDate(p.edd)}`,
            }))}
            placeholder={
              !formData.motherId
                ? 'Select mother first'
                : isLoadingPregnancies
                  ? 'Loading pregnancies...'
                  : 'Select pregnancy'
            }
            disabled={!formData.motherId || isLoadingPregnancies}
            required
          />
        </div>

        {/* Pregnancy Summary Card */}
        {selectedPregnancy && (
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
            <h3 className="font-semibold text-neutral-900 text-sm mb-3">Pregnancy History Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-neutral-600 text-xs font-medium">Gravida</p>
                <p className="text-neutral-900 font-semibold">{selectedPregnancy.gravida || '-'}</p>
              </div>
              <div>
                <p className="text-neutral-600 text-xs font-medium">Parity</p>
                <p className="text-neutral-900 font-semibold">{selectedPregnancy.parity || '-'}</p>
              </div>
              <div>
                <p className="text-neutral-600 text-xs font-medium">Status</p>
                <p className="text-neutral-900 font-semibold">{selectedPregnancy.status}</p>
              </div>
              <div>
                <p className="text-neutral-600 text-xs font-medium">High Risk</p>
                <div>
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                      selectedPregnancy.isHighRisk
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {selectedPregnancy.isHighRisk ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            {formatRiskFactors(selectedPregnancy.riskFactors).length > 0 && (
              <div className="mt-3 pt-3 border-t border-neutral-200">
                <p className="text-neutral-600 text-xs font-medium mb-2">Risk Factors:</p>
                <div className="flex flex-wrap gap-2">
                  {formatRiskFactors(selectedPregnancy.riskFactors).map((factor, idx) => (
                    <span
                      key={idx}
                      className="inline-block px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded"
                    >
                      {factor}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Facility Selection Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-900 block mb-2">
              Referring Facility
            </label>
            <div className="px-3 py-2 bg-neutral-100 rounded-lg border border-neutral-300">
              <p className="text-neutral-700 text-sm">{userFacilityName}</p>
              <p className="text-neutral-500 text-xs mt-1">Auto-filled from your facility</p>
            </div>
          </div>

          <SelectDropdown
            label="Receiving Facility"
            name="toFacilityId"
            value={formData.toFacilityId}
            onChange={handleInputChange}
            error={errors.toFacilityId}
            options={facilities.map((f) => ({
              value: f.id,
              label: f.name,
            }))}
            placeholder="Select receiving facility"
            required
          />
        </div>

        {/* Reason and Notes Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Textarea
            label="Reason for Referral"
            name="reason"
            value={formData.reason}
            onChange={handleInputChange}
            placeholder="e.g., High blood pressure with symptoms, Poor fetal growth, Abnormal presentation..."
            rows={4}
          />

          <Textarea
            label="Clinical Notes"
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            placeholder="Additional clinical information relevant to the referral..."
            rows={4}
          />
        </div>

        {/* Urgency Selection */}
        <div>
          <label className="text-sm font-medium text-neutral-900 block mb-3">
            Urgency Level
            <span className="text-red-600 ml-1">*</span>
          </label>
          <div className="flex gap-4">
            {['ROUTINE', 'URGENT', 'EMERGENCY'].map((level) => (
              <label key={level} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="urgency"
                  value={level}
                  checked={formData.urgency === level}
                  onChange={() => handleUrgencyChange(level)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-neutral-700">{level}</span>
              </label>
            ))}
          </div>
          {errors.urgency && <span className="text-sm text-red-600 mt-2 block">{errors.urgency}</span>}
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 justify-end pt-4">
          <button
            type="reset"
            className="px-4 py-2 border border-neutral-300 rounded-lg text-neutral-700 font-medium hover:bg-neutral-50 transition-colors disabled:opacity-50"
            disabled={isLoading}
          >
            Clear
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            disabled={isLoading}
          >
            {isLoading && <Loader size={16} className="animate-spin" />}
            {isLoading ? 'Creating...' : 'Create Referral'}
          </button>
        </div>
      </form>
    </div>
  );
}
