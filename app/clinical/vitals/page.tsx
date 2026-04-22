'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import RecentVitalsTable from '@/components/RecentVitalsTable';

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

interface AncVisit {
  id: number;
  visitNumber: number;
  pregnancyId: number;
  visitType: string;
  visitDateTime: string;
  nextAppointment?: string;
}

interface Vitals {
  id?: number;
  ancVisitId?: number;
  systolicBP?: number | null;
  diastolicBP?: number | null;
  bpNotTaken?: boolean;
  temperatureC?: number | null;
  weightKg?: number | null;
  pulseBpm?: number | null;
  respRate?: number | null;
  oxygenSatPct?: number | null;
}

interface VitalsRecord {
  id: number;
  ancVisitId?: number;
  systolicBP?: number | null;
  diastolicBP?: number | null;
  bpNotTaken: boolean;
  temperatureC?: number | null;
  weightKg?: number | null;
  pulseBpm?: number | null;
  respRate?: number | null;
  oxygenSatPct?: number | null;
  createdAt: string;
  mother?: {
    fullName: string;
  };
  ancVisit?: {
    visitNumber: number;
  };
}

interface PregnancyWithVitals extends Pregnancy {
  vitals?: VitalsRecord[];
  ancVisits?: AncVisit[];
}

export default function VitalsPage() {
  // Dropdown data
  const [mothers, setMothers] = useState<Mother[]>([]);
  const [pregnancies, setPregnancies] = useState<Pregnancy[]>([]);
  const [ancVisits, setAncVisits] = useState<AncVisit[]>([]);

  // Form state
  const [selectedMotherId, setSelectedMotherId] = useState('');
  const [selectedPregnancyId, setSelectedPregnancyId] = useState('');
  const [selectedVisitId, setSelectedVisitId] = useState('');

  const [formData, setFormData] = useState<Vitals>({
    systolicBP: undefined,
    diastolicBP: undefined,
    bpNotTaken: false,
    temperatureC: undefined,
    weightKg: undefined,
    pulseBpm: undefined,
    respRate: undefined,
    oxygenSatPct: undefined,
  });

  // UI state
  const [loadingMothers, setLoadingMothers] = useState(true);
  const [loadingPregnancies, setLoadingPregnancies] = useState(false);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [missingVitals, setMissingVitals] = useState<string[]>([]);

  // Recent vitals state
  const [pregnancyData, setPregnancyData] = useState<PregnancyWithVitals | null>(null);
  const [recentVitals, setRecentVitals] = useState<VitalsRecord[]>([]);
  const [loadingRecentVitals, setLoadingRecentVitals] = useState(false);

  // Get role from URL for navigation (doctor/nurse/midwife)
  const getRole = () => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.includes('/doctor/')) return 'doctor';
      if (path.includes('/nurse/')) return 'nurse';
      if (path.includes('/midwife/')) return 'midwife';
    }
    return 'doctor'; // default
  };

  const role = getRole();

  // Helper function to extract and sort recent vitals
  const getRecentVitals = (pregnancy: PregnancyWithVitals | null, limit: number = 5): VitalsRecord[] => {
    if (!pregnancy || !pregnancy.vitals) return [];
    
    // Sort by createdAt descending and limit to last 5
    const sorted = [...pregnancy.vitals].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    return sorted.slice(0, limit);
  };

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
    if (!selectedMotherId) {
      setPregnancies([]);
      setSelectedPregnancyId('');
      setAncVisits([]);
      setSelectedVisitId('');
      setFormData({
        systolicBP: undefined,
        diastolicBP: undefined,
        bpNotTaken: false,
        temperatureC: undefined,
        weightKg: undefined,
        pulseBpm: undefined,
        respRate: undefined,
        oxygenSatPct: undefined,
      });
      setMissingVitals([]);
      setPregnancyData(null);
      setRecentVitals([]);
      return;
    }

    const fetchPregnancies = async () => {
      setLoadingPregnancies(true);
      try {
        const response = await fetch(
          `/api/pregnancies?motherId=${selectedMotherId}&status=ACTIVE`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );
        if (!response.ok) throw new Error('Failed to fetch pregnancies');
        const data = await response.json();
        setPregnancies(data.data || []);
        setSelectedPregnancyId('');
        setAncVisits([]);
        setSelectedVisitId('');
        setFormData({
          systolicBP: undefined,
          diastolicBP: undefined,
          bpNotTaken: false,
          temperatureC: undefined,
          weightKg: undefined,
          pulseBpm: undefined,
          respRate: undefined,
          oxygenSatPct: undefined,
        });
        setMissingVitals([]);
        setPregnancyData(null);
        setRecentVitals([]);
      } catch (error) {
        console.error('Error fetching pregnancies:', error);
        setPregnancies([]);
      } finally {
        setLoadingPregnancies(false);
      }
    };

    fetchPregnancies();
  }, [selectedMotherId]);

  // Fetch full pregnancy data with vitals when pregnancy is selected
  useEffect(() => {
    if (!selectedPregnancyId) {
      setAncVisits([]);
      setSelectedVisitId('');
      setFormData({
        systolicBP: undefined,
        diastolicBP: undefined,
        bpNotTaken: false,
        temperatureC: undefined,
        weightKg: undefined,
        pulseBpm: undefined,
        respRate: undefined,
        oxygenSatPct: undefined,
      });
      setMissingVitals([]);
      setPregnancyData(null);
      setRecentVitals([]);
      return;
    }

    const fetchFullPregnancyData = async () => {
      setLoadingRecentVitals(true);
      try {
        const response = await fetch(`/api/pregnancies/${selectedPregnancyId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (!response.ok) throw new Error('Failed to fetch pregnancy details');
        const data = await response.json();
        const pregnancy = data.data as PregnancyWithVitals;
        setPregnancyData(pregnancy);
        
        // Extract and set recent vitals
        const recent = getRecentVitals(pregnancy, 5);
        setRecentVitals(recent);
        
        // Also populate ANC visits
        if (pregnancy.ancVisits) {
          setAncVisits(pregnancy.ancVisits);
        }
      } catch (error) {
        console.error('Error fetching pregnancy details:', error);
        setPregnancyData(null);
        setRecentVitals([]);
      } finally {
        setLoadingRecentVitals(false);
      }
    };

    fetchFullPregnancyData();
  }, [selectedPregnancyId]);

  // Fetch ANC visits when pregnancy is selected (fallback if not loaded from pregnancy data)
  useEffect(() => {
    if (!selectedPregnancyId) {
      return;
    }

    // If we already have ANC visits from the pregnancy data fetch, skip this
    if (ancVisits.length > 0) {
      return;
    }

    const fetchVisits = async () => {
      setLoadingVisits(true);
      try {
        const response = await fetch(
          `/api/ancvisits?pregnancyId=${selectedPregnancyId}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );
        if (!response.ok) throw new Error('Failed to fetch visits');
        const data = await response.json();
        setAncVisits(data.data || []);
      } catch (error) {
        console.error('Error fetching visits:', error);
      } finally {
        setLoadingVisits(false);
      }
    };

    fetchVisits();
  }, [selectedPregnancyId, ancVisits.length]);

  // Fetch vitals when visit is selected
  useEffect(() => {
    if (!selectedVisitId) {
      setFormData({
        systolicBP: undefined,
        diastolicBP: undefined,
        bpNotTaken: false,
        temperatureC: undefined,
        weightKg: undefined,
        pulseBpm: undefined,
        respRate: undefined,
        oxygenSatPct: undefined,
      });
      setMissingVitals([]);
      return;
    }

    const fetchVitals = async () => {
      try {
        const response = await fetch(`/api/ancvisits/${selectedVisitId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (!response.ok) throw new Error('Failed to fetch visit');
        const result = await response.json();
        const visit = result.data;

        // Extract vitals from the visit (it returns as an array, take the first)
        const visitVitals = visit.vitals && visit.vitals.length > 0 ? visit.vitals[0] : null;

        if (visitVitals) {
          setFormData({
            id: visitVitals.id,
            ancVisitId: visitVitals.ancVisitId,
            systolicBP: visitVitals.systolicBP,
            diastolicBP: visitVitals.diastolicBP,
            bpNotTaken: visitVitals.bpNotTaken || false,
            temperatureC: visitVitals.temperatureC,
            weightKg: visitVitals.weightKg,
            pulseBpm: visitVitals.pulseBpm,
            respRate: visitVitals.respRate,
            oxygenSatPct: visitVitals.oxygenSatPct,
          });
        } else {
          // No vitals yet for this visit, show empty form
          setFormData({
            systolicBP: undefined,
            diastolicBP: undefined,
            bpNotTaken: false,
            temperatureC: undefined,
            weightKg: undefined,
            pulseBpm: undefined,
            respRate: undefined,
            oxygenSatPct: undefined,
          });
        }
        setMissingVitals([]);
        setErrors({});
      } catch (error) {
        console.error('Error fetching vitals:', error);
        setFormData({
          systolicBP: undefined,
          diastolicBP: undefined,
          bpNotTaken: false,
          temperatureC: undefined,
          weightKg: undefined,
          pulseBpm: undefined,
          respRate: undefined,
          oxygenSatPct: undefined,
        });
      }
    };

    fetchVitals();
  }, [selectedVisitId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;

    if (type === 'checkbox') {
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      const numValue = value === '' ? undefined : parseFloat(value);
      setFormData((prev) => ({
        ...prev,
        [name]: isNaN(numValue as any) ? undefined : numValue,
      }));
    }

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const checkMissingVitals = (): string[] => {
    const missing: string[] = [];

    if (formData.temperatureC === undefined || formData.temperatureC === null) {
      missing.push('Temperature');
    }
    if (formData.weightKg === undefined || formData.weightKg === null) {
      missing.push('Weight');
    }
    if (formData.pulseBpm === undefined || formData.pulseBpm === null) {
      missing.push('Pulse');
    }
    if (formData.respRate === undefined || formData.respRate === null) {
      missing.push('Resp rate');
    }
    if (formData.oxygenSatPct === undefined || formData.oxygenSatPct === null) {
      missing.push('SpO2');
    }

    return missing;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // BP validation: Must have both BP values OR bpNotTaken must be true
    if (!formData.bpNotTaken) {
      if (formData.systolicBP === undefined || formData.systolicBP === null) {
        newErrors.systolicBP = 'Required (or check BP not taken)';
      }
      if (formData.diastolicBP === undefined || formData.diastolicBP === null) {
        newErrors.diastolicBP = 'Required (or check BP not taken)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess(false);

    if (!validateForm()) {
      setSubmitError('Blood pressure is required. Enter a reading or tick BP not taken.');
      return;
    }

    // Check for missing optional vitals and warn
    const missing = checkMissingVitals();
    setMissingVitals(missing);

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/ancvisits/${selectedVisitId}/vitals`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          systolicBP: formData.bpNotTaken ? null : formData.systolicBP,
          diastolicBP: formData.bpNotTaken ? null : formData.diastolicBP,
          bpNotTaken: formData.bpNotTaken,
          temperatureC: formData.temperatureC || null,
          weightKg: formData.weightKg || null,
          pulseBpm: formData.pulseBpm || null,
          respRate: formData.respRate || null,
          oxygenSatPct: formData.oxygenSatPct || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save vitals');
      }

      setSubmitSuccess(true);
      setErrors({});
      // Keep form populated for re-editing
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'An error occurred while saving vitals';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSaveDisabled = () => {
    // Save disabled if:
    // - No visit selected, OR
    // - BP fields empty AND bpNotTaken unchecked
    if (!selectedVisitId) return true;

    if (!formData.bpNotTaken) {
      return (
        (formData.systolicBP === undefined || formData.systolicBP === null) ||
        (formData.diastolicBP === undefined || formData.diastolicBP === null)
      );
    }

    return false;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Record Vitals</h1>
          <p className="text-gray-600 mt-2">
            Select a mother, pregnancy, and ANC visit to record vital signs.
          </p>
        </div>

        {/* Success Banner */}
        {submitSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 font-medium">
              ✓ Vitals saved successfully!
            </p>
          </div>
        )}

        {/* Error Banner */}
        {submitError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-red-600 mt-0.5 flex-shrink-0" size={18} />
            <p className="text-sm text-red-800">{submitError}</p>
          </div>
        )}

        {/* Warning Banner for Missing Optional Vitals */}
        {missingVitals.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="text-yellow-600 mt-0.5 flex-shrink-0" size={18} />
            <p className="text-sm text-yellow-800">
              <strong>Some vitals are missing:</strong> {missingVitals.join(', ')}. These are
              optional but recommended.
            </p>
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={handleSubmit}>
          {/* Cascading Selects Section */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Visit Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Mother Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Mother
                </label>
                <select
                  value={selectedMotherId}
                  onChange={(e) => setSelectedMotherId(e.target.value)}
                  disabled={loadingMothers}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-neutral-300 text-neutral-900 text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-neutral-100 disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors"
                >
                  <option value="">Select mother</option>
                  {mothers.map((mother) => (
                    <option key={mother.id} value={mother.id}>
                      {mother.fullName} ({mother.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Pregnancy Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Pregnancy
                </label>
                <select
                  value={selectedPregnancyId}
                  onChange={(e) => setSelectedPregnancyId(e.target.value)}
                  disabled={!selectedMotherId || loadingPregnancies}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-neutral-300 text-neutral-900 text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-neutral-100 disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors"
                >
                  <option value="">
                    {!selectedMotherId
                      ? 'Select mother first'
                      : loadingPregnancies
                        ? 'Loading...'
                        : 'Select pregnancy'}
                  </option>
                  {pregnancies.map((pregnancy) => (
                    <option key={pregnancy.id} value={pregnancy.id}>
                      #P{pregnancy.id} (G{pregnancy.gravida || '?'} P{pregnancy.parity || '?'})
                    </option>
                  ))}
                </select>
              </div>

              {/* ANC Visit Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  ANC Visit
                </label>
                <select
                  value={selectedVisitId}
                  onChange={(e) => setSelectedVisitId(e.target.value)}
                  disabled={!selectedPregnancyId || loadingVisits}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-neutral-300 text-neutral-900 text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-neutral-100 disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors"
                >
                  <option value="">
                    {!selectedPregnancyId
                      ? 'Select pregnancy first'
                      : loadingVisits
                        ? 'Loading...'
                        : 'Select visit'}
                  </option>
                  {ancVisits.map((visit) => (
                    <option key={visit.id} value={visit.id}>
                      Visit #{visit.visitNumber} ({new Date(visit.visitDateTime).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Helper text for ANC visit creation */}
            {selectedPregnancyId && ancVisits.length === 0 && !loadingVisits && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Tip:</strong> Create a visit from the{' '}
                  <Link
                    href={`/clinical/${role}/anc-visits`}
                    className="text-blue-600 hover:text-blue-700 underline flex items-center gap-1 inline-flex"
                  >
                    ANC Visits page <ExternalLink size={14} />
                  </Link>
                </p>
              </div>
            )}
          </div>

          {/* Vitals Form (only show if visit selected) */}
          {selectedVisitId && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Vital Signs</h2>

              {/* BP Section with Checkbox */}
              <div className="mb-6 pb-6 border-b border-neutral-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                  {/* Left Column: Systolic BP & Temperature */}
                  <div>
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Systolic BP (mmHg)
                      </label>
                      <input
                        type="number"
                        name="systolicBP"
                        placeholder="e.g. 120"
                        value={formData.systolicBP ?? ''}
                        onChange={handleInputChange}
                        disabled={formData.bpNotTaken}
                        className={`w-full px-3 py-2 bg-white rounded-lg border text-neutral-900 text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:border-transparent disabled:bg-neutral-100 disabled:text-neutral-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${
                          errors.systolicBP
                            ? 'border-red-600 focus:ring-red-600'
                            : 'border-neutral-300 focus:ring-blue-500'
                        }`}
                      />
                      {errors.systolicBP && (
                        <p className="text-sm text-red-600 mt-1">{errors.systolicBP}</p>
                      )}
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Pulse (bpm)
                      </label>
                      <input
                        type="number"
                        name="pulseBpm"
                        placeholder="e.g. 76"
                        value={formData.pulseBpm ?? ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-white rounded-lg border border-neutral-300 text-neutral-900 text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      />
                    </div>
                  </div>

                  {/* Right Column: Diastolic BP & Weight */}
                  <div>
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Diastolic BP (mmHg)
                      </label>
                      <input
                        type="number"
                        name="diastolicBP"
                        placeholder="e.g. 80"
                        value={formData.diastolicBP ?? ''}
                        onChange={handleInputChange}
                        disabled={formData.bpNotTaken}
                        className={`w-full px-3 py-2 bg-white rounded-lg border text-neutral-900 text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:border-transparent disabled:bg-neutral-100 disabled:text-neutral-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${
                          errors.diastolicBP
                            ? 'border-red-600 focus:ring-red-600'
                            : 'border-neutral-300 focus:ring-blue-500'
                        }`}
                      />
                      {errors.diastolicBP && (
                        <p className="text-sm text-red-600 mt-1">{errors.diastolicBP}</p>
                      )}
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Weight (kg)
                      </label>
                      <input
                        type="number"
                        name="weightKg"
                        placeholder="e.g. 62"
                        step="0.1"
                        value={formData.weightKg ?? ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-white rounded-lg border border-neutral-300 text-neutral-900 text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* BP Not Taken Checkbox */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <input
                    type="checkbox"
                    name="bpNotTaken"
                    id="bpNotTaken"
                    checked={formData.bpNotTaken}
                    onChange={handleInputChange}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="bpNotTaken" className="text-sm font-medium text-gray-900 cursor-pointer">
                    BP not taken
                  </label>
                </div>
              </div>

              {/* Other Vitals Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Left Column */}
                <div>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Temperature (°C)
                    </label>
                    <input
                      type="number"
                      name="temperatureC"
                      placeholder="e.g. 36.8"
                      step="0.1"
                      value={formData.temperatureC ?? ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-neutral-300 text-neutral-900 text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Oxygen Sat (%)
                    </label>
                    <input
                      type="number"
                      name="oxygenSatPct"
                      placeholder="e.g. 98"
                      value={formData.oxygenSatPct ?? ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-neutral-300 text-neutral-900 text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Resp Rate
                    </label>
                    <input
                      type="number"
                      name="respRate"
                      placeholder="e.g. 18"
                      value={formData.respRate ?? ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-neutral-300 text-neutral-900 text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <button
                type="submit"
                disabled={isSaveDisabled() || isSubmitting}
                className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Vitals'
                )}
              </button>

              {/* Recent Vitals Table */}
              <div className="mt-8 pt-8 border-t border-neutral-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Vitals</h3>
                <RecentVitalsTable vitals={recentVitals} isLoading={loadingRecentVitals} />
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
