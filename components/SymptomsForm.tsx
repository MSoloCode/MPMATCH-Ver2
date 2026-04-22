'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

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

interface Symptoms {
  id?: number;
  ancVisitId?: number;
  bleeding?: boolean;
  severeHeadache?: boolean;
  blurredVision?: boolean;
  swelling?: boolean;
  fever?: boolean;
  abdominalPain?: boolean;
  reducedFetalMovement?: boolean;
  other?: string | null;
}

interface SymptomEntry {
  visitNumber: number;
  visitId: number;
  bleeding?: boolean;
  severeHeadache?: boolean;
  blurredVision?: boolean;
  swelling?: boolean;
  fever?: boolean;
  abdominalPain?: boolean;
  reducedFetalMovement?: boolean;
  other?: string | null;
}

interface SymptomsFormProps {
  onSuccess?: (symptoms: Symptoms) => void;
}

const DANGER_SIGNS = ['bleeding', 'severeHeadache', 'blurredVision', 'reducedFetalMovement'];

export default function SymptomsForm({ onSuccess }: SymptomsFormProps) {
  // Dropdown data
  const [mothers, setMothers] = useState<Mother[]>([]);
  const [pregnancies, setPregnancies] = useState<Pregnancy[]>([]);
  const [ancVisits, setAncVisits] = useState<AncVisit[]>([]);

  // Form state
  const [selectedMotherId, setSelectedMotherId] = useState('');
  const [selectedPregnancyId, setSelectedPregnancyId] = useState('');
  const [selectedVisitId, setSelectedVisitId] = useState('');

  const [formData, setFormData] = useState<Symptoms>({
    bleeding: false,
    severeHeadache: false,
    blurredVision: false,
    swelling: false,
    fever: false,
    abdominalPain: false,
    reducedFetalMovement: false,
    other: '',
  });

  // UI state
  const [loadingMothers, setLoadingMothers] = useState(true);
  const [loadingPregnancies, setLoadingPregnancies] = useState(false);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [allSymptomEntries, setAllSymptomEntries] = useState<SymptomEntry[]>([]);

  // Detect danger signs
  const hasDangerSigns =
    formData.bleeding ||
    formData.severeHeadache ||
    formData.blurredVision ||
    formData.reducedFetalMovement;

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
      setAllSymptomEntries([]);
      setFormData({
        bleeding: false,
        severeHeadache: false,
        blurredVision: false,
        swelling: false,
        fever: false,
        abdominalPain: false,
        reducedFetalMovement: false,
        other: '',
      });
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
        setPregnancies(data.data || data || []);
        setSelectedPregnancyId('');
        setAncVisits([]);
        setSelectedVisitId('');
      } catch (error) {
        console.error('Error fetching pregnancies:', error);
        setPregnancies([]);
      } finally {
        setLoadingPregnancies(false);
      }
    };

    fetchPregnancies();
  }, [selectedMotherId]);

  // Fetch ANC visits when pregnancy is selected
  useEffect(() => {
    if (!selectedPregnancyId) {
      setAncVisits([]);
      setSelectedVisitId('');
      setAllSymptomEntries([]);
      setFormData({
        bleeding: false,
        severeHeadache: false,
        blurredVision: false,
        swelling: false,
        fever: false,
        abdominalPain: false,
        reducedFetalMovement: false,
        other: '',
      });
      return;
    }

    const fetchVisits = async () => {
      setLoadingVisits(true);
      try {
        const response = await fetch(
          `/api/pregnancies/${selectedPregnancyId}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );
        if (!response.ok) throw new Error('Failed to fetch visits');
        const data = await response.json();
        const pregnancy = data.data || data;
        setAncVisits(pregnancy.ancVisits || []);
        setSelectedVisitId('');

        // Extract all symptom entries from visits
        const entries: SymptomEntry[] = [];
        if (pregnancy.ancVisits && Array.isArray(pregnancy.ancVisits)) {
          pregnancy.ancVisits.forEach((visit: any) => {
            if (visit.symptoms && Array.isArray(visit.symptoms)) {
              visit.symptoms.forEach((symptom: any) => {
                entries.push({
                  visitNumber: visit.visitNumber,
                  visitId: visit.id,
                  bleeding: symptom.bleeding || false,
                  severeHeadache: symptom.severeHeadache || false,
                  blurredVision: symptom.blurredVision || false,
                  swelling: symptom.swelling || false,
                  fever: symptom.fever || false,
                  abdominalPain: symptom.abdominalPain || false,
                  reducedFetalMovement: symptom.reducedFetalMovement || false,
                  other: symptom.other || null,
                });
              });
            }
          });
        }
        setAllSymptomEntries(entries);
      } catch (error) {
        console.error('Error fetching visits:', error);
        setAncVisits([]);
        setAllSymptomEntries([]);
      } finally {
        setLoadingVisits(false);
      }
    };

    fetchVisits();
  }, [selectedPregnancyId]);

  // Fetch symptoms when visit is selected
  useEffect(() => {
    if (!selectedVisitId) {
      setFormData({
        bleeding: false,
        severeHeadache: false,
        blurredVision: false,
        swelling: false,
        fever: false,
        abdominalPain: false,
        reducedFetalMovement: false,
        other: '',
      });
      return;
    }

    const fetchSymptoms = async () => {
      try {
        const response = await fetch(`/api/ancvisits/${selectedVisitId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (!response.ok) throw new Error('Failed to fetch visit');
        const result = await response.json();
        const visit = result.data;

        // Extract symptoms from the visit (if any)
        const visitSymptoms =
          visit.symptoms && visit.symptoms.length > 0 ? visit.symptoms[0] : null;

        if (visitSymptoms) {
          setFormData({
            id: visitSymptoms.id,
            ancVisitId: visitSymptoms.ancVisitId,
            bleeding: visitSymptoms.bleeding || false,
            severeHeadache: visitSymptoms.severeHeadache || false,
            blurredVision: visitSymptoms.blurredVision || false,
            swelling: visitSymptoms.swelling || false,
            fever: visitSymptoms.fever || false,
            abdominalPain: visitSymptoms.abdominalPain || false,
            reducedFetalMovement: visitSymptoms.reducedFetalMovement || false,
            other: visitSymptoms.other || '',
          });
        } else {
          // No symptoms yet for this visit, show empty form
          setFormData({
            bleeding: false,
            severeHeadache: false,
            blurredVision: false,
            swelling: false,
            fever: false,
            abdominalPain: false,
            reducedFetalMovement: false,
            other: '',
          });
        }
        setSubmitError('');
      } catch (error) {
        console.error('Error fetching symptoms:', error);
        setFormData({
          bleeding: false,
          severeHeadache: false,
          blurredVision: false,
          swelling: false,
          fever: false,
          abdominalPain: false,
          reducedFetalMovement: false,
          other: '',
        });
      }
    };

    fetchSymptoms();
  }, [selectedVisitId]);

  const handleCheckboxChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = e.target;
    setFormData((prev) => ({
      ...prev,
      other: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess(false);

    if (!selectedVisitId) {
      setSubmitError('Please select an ANC visit');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/ancvisits/${selectedVisitId}/symptoms`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          bleeding: formData.bleeding || false,
          severeHeadache: formData.severeHeadache || false,
          blurredVision: formData.blurredVision || false,
          swelling: formData.swelling || false,
          fever: formData.fever || false,
          abdominalPain: formData.abdominalPain || false,
          reducedFetalMovement: formData.reducedFetalMovement || false,
          other: formData.other || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save symptoms');
      }

      setSubmitSuccess(true);
      if (onSuccess) {
        onSuccess(result.data);
      }
      // Keep form populated for re-editing
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'An error occurred while saving symptoms';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSaveDisabled = () => {
    return !selectedVisitId || isSubmitting;
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h1 className="text-3xl font-bold mb-6">Record Symptoms</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cascading Selectors */}
        <div className="space-y-4">
          {/* Mother Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mother
            </label>
            {loadingMothers ? (
              <div className="flex items-center gap-2 text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading mothers...
              </div>
            ) : (
              <select
                value={selectedMotherId}
                onChange={(e) => setSelectedMotherId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a mother</option>
                {mothers.map((mother) => (
                  <option key={mother.id} value={mother.id}>
                    {mother.fullName} ({mother.phone})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Pregnancy Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pregnancy
            </label>
            {loadingPregnancies ? (
              <div className="flex items-center gap-2 text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading pregnancies...
              </div>
            ) : (
              <select
                value={selectedPregnancyId}
                onChange={(e) => setSelectedPregnancyId(e.target.value)}
                disabled={!selectedMotherId}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Select a pregnancy</option>
                {pregnancies.map((pregnancy) => (
                  <option key={pregnancy.id} value={pregnancy.id}>
                    #P{pregnancy.id} (G{pregnancy.gravida} P{pregnancy.parity})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* ANC Visit Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ANC Visit
            </label>
            {loadingVisits ? (
              <div className="flex items-center gap-2 text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading visits...
              </div>
            ) : (
              <select
                value={selectedVisitId}
                onChange={(e) => setSelectedVisitId(e.target.value)}
                disabled={!selectedPregnancyId}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Select an ANC visit</option>
                {ancVisits.map((visit) => (
                  <option key={visit.id} value={visit.id}>
                    Visit #{visit.visitNumber} - {new Date(visit.visitDateTime).toLocaleDateString()} ({visit.visitType})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {selectedVisitId && (
          <>
            {/* Symptom Checkboxes */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-800">Symptoms</h2>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="bleeding"
                  checked={formData.bleeding || false}
                  onChange={handleCheckboxChange}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="font-semibold text-gray-700">Bleeding</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="severeHeadache"
                  checked={formData.severeHeadache || false}
                  onChange={handleCheckboxChange}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="font-semibold text-gray-700">Severe headache</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="blurredVision"
                  checked={formData.blurredVision || false}
                  onChange={handleCheckboxChange}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="font-semibold text-gray-700">Blurred vision</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="swelling"
                  checked={formData.swelling || false}
                  onChange={handleCheckboxChange}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="font-semibold text-gray-700">Swelling</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="fever"
                  checked={formData.fever || false}
                  onChange={handleCheckboxChange}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="font-semibold text-gray-700">Fever</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="abdominalPain"
                  checked={formData.abdominalPain || false}
                  onChange={handleCheckboxChange}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="font-semibold text-gray-700">Abdominal pain</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="reducedFetalMovement"
                  checked={formData.reducedFetalMovement || false}
                  onChange={handleCheckboxChange}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="font-semibold text-gray-700">Reduced fetal movement</span>
              </label>
            </div>

            {/* Other Symptoms Textarea */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Other symptoms (optional)
              </label>
              <textarea
                value={formData.other || ''}
                onChange={handleTextAreaChange}
                placeholder="Enter any other symptoms or notes..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Danger Signs Alert */}
            {hasDangerSigns && (
              <div className="flex gap-3 p-4 bg-red-50 border border-red-300 rounded-md">
                <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-red-800">DANGER SIGNS DETECTED</h3>
                  <p className="text-red-700 text-sm">
                    Consider immediate referral or escalation.
                  </p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {submitError && (
              <div className="p-4 bg-red-50 border border-red-300 rounded-md">
                <p className="text-red-800 font-medium">{submitError}</p>
              </div>
            )}

            {/* Success Message */}
            {submitSuccess && (
              <div className="p-4 bg-green-50 border border-green-300 rounded-md">
                <p className="text-green-800 font-medium">Symptoms saved successfully!</p>
              </div>
            )}

            {/* Save Button */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isSaveDisabled()}
                className={`px-6 py-2 font-medium rounded-md text-white transition-colors ${
                  isSaveDisabled()
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </div>
                ) : (
                  'Save symptoms'
                )}
              </button>
            </div>
          </>
        )}
      </form>

      {/* Recent Symptom Entries Table */}
      {selectedPregnancyId && allSymptomEntries.length > 0 && (
        <div className="mt-8 pt-8 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent symptom entries</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Mother</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Visit</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-700">Bleeding</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-700">Fever</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-700">Severe HA</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-700">Blurred</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-700">Swelling</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-700">Abd pain</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-700">Reduced FM</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Other</th>
                </tr>
              </thead>
              <tbody>
                {allSymptomEntries.map((entry, idx) => (
                  <tr
                    key={`${entry.visitId}-${idx}`}
                    className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    {/* Mother */}
                    <td className="px-3 py-2 text-gray-700">
                      {mothers.find((m) => m.id.toString() === selectedMotherId)?.fullName || 'Unknown'}
                    </td>

                    {/* Visit */}
                    <td className="px-3 py-2 text-gray-700 font-medium">{entry.visitNumber}</td>

                    {/* Bleeding (Danger Sign) */}
                    <td className="px-3 py-2 text-center">
                      {entry.bleeding ? (
                        <span className="font-bold text-red-600">Yes</span>
                      ) : (
                        <span className="text-gray-500">No</span>
                      )}
                    </td>

                    {/* Fever */}
                    <td className="px-3 py-2 text-center">
                      {entry.fever ? (
                        <span className="text-amber-600">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>

                    {/* Severe Headache (Danger Sign) */}
                    <td className="px-3 py-2 text-center">
                      {entry.severeHeadache ? (
                        <span className="font-bold text-red-600">Yes</span>
                      ) : (
                        <span className="text-gray-500">No</span>
                      )}
                    </td>

                    {/* Blurred Vision (Danger Sign) */}
                    <td className="px-3 py-2 text-center">
                      {entry.blurredVision ? (
                        <span className="font-bold text-red-600">Yes</span>
                      ) : (
                        <span className="text-gray-500">No</span>
                      )}
                    </td>

                    {/* Swelling */}
                    <td className="px-3 py-2 text-center">
                      {entry.swelling ? (
                        <span className="text-amber-600">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>

                    {/* Abdominal Pain */}
                    <td className="px-3 py-2 text-center">
                      {entry.abdominalPain ? (
                        <span className="text-amber-600">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>

                    {/* Reduced Fetal Movement (Danger Sign) */}
                    <td className="px-3 py-2 text-center">
                      {entry.reducedFetalMovement ? (
                        <span className="font-bold text-red-600">Yes</span>
                      ) : (
                        <span className="text-gray-500">No</span>
                      )}
                    </td>

                    {/* Other */}
                    <td className="px-3 py-2 text-gray-600 truncate">
                      {entry.other && entry.other.trim() ? (
                        entry.other.length > 30 ? (
                          <span title={entry.other}>
                            {entry.other.substring(0, 30)}...
                          </span>
                        ) : (
                          <span>{entry.other}</span>
                        )
                      ) : (
                        <span className="text-gray-400">---</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
