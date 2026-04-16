'use client';

import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import {
  TextInput,
  PhoneInput,
  SelectDropdown,
  DateInput,
  Textarea,
  Checkbox,
} from './FormInputs';

interface Mother {
  id: number;
  fullName: string;
  phone: string;
}

interface ObstetricHistoryRow {
  id: string; // For UI key/identification
  year: number | '';
  outcome: string;
  deliveryMode: string;
  complications: string[];
}

interface FormData {
  motherId: number | '';
  lmpDate: string;
  edd: string;
  gravida: number | '';
  parity: number | '';
  multiplePregnancy: string;
  riskFactors: string[];
  antenatalStatus: string;
  obstetricHistory: ObstetricHistoryRow[];
  ancCardFile: File | null;
}

interface Errors {
  [key: string]: string;
}

interface OpenPregnancyModalProps {
  isOpen: boolean;
  onClose: () => void;
  motherId?: number;
  onSuccess: (pregnancyId: number) => void;
}

const RISK_FACTORS_OPTIONS = ['Hypertension', 'Diabetes', 'Previous C-section', 'Anaemia', 'HIV+', 'Other'];

const OBSTETRIC_OUTCOMES = ['LIVE_BIRTH', 'MISCARRIAGE', 'STILLBIRTH', 'ABORTION'];
const DELIVERY_MODES = ['SVD', 'C_SECTION', 'ASSISTED'];

export default function OpenPregnancyModal({
  isOpen,
  onClose,
  motherId: initialMotherId,
  onSuccess,
}: OpenPregnancyModalProps) {
  const [formData, setFormData] = useState<FormData>({
    motherId: initialMotherId || '',
    lmpDate: '',
    edd: '',
    gravida: '',
    parity: '',
    multiplePregnancy: 'NONE',
    riskFactors: [],
    antenatalStatus: 'YET_TO_START',
    obstetricHistory: [],
    ancCardFile: null,
  });

  const [errors, setErrors] = useState<Errors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [mothers, setMothers] = useState<Mother[]>([]);
  const [ancCardPreview, setAncCardPreview] = useState<{ name: string; url?: string } | null>(null);
  const [isAncUploading, setIsAncUploading] = useState(false);
  const [obstetricHistoryExpanded, setObstetricHistoryExpanded] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch mothers list when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchMothers();
    }
  }, [isOpen]);

  // Auto-calculate EDD when LMP date changes
  useEffect(() => {
    if (formData.lmpDate) {
      try {
        const lmpDate = new Date(formData.lmpDate);
        const eddDate = new Date(lmpDate);
        eddDate.setDate(eddDate.getDate() + 280);
        const eddString = eddDate.toISOString().split('T')[0];
        setFormData((prev) => ({
          ...prev,
          edd: eddString,
        }));
      } catch {
        // Invalid date, leave EDD empty
      }
    }
  }, [formData.lmpDate]);

  // Auto-calculate gravida and parity from obstetric history
  useEffect(() => {
    if (formData.obstetricHistory.length > 0) {
      const gravida = formData.obstetricHistory.length;
      const parity = formData.obstetricHistory.filter(
        (record) => record.outcome === 'LIVE_BIRTH'
      ).length;
      setFormData((prev) => ({
        ...prev,
        gravida: gravida || '',
        parity: parity || '',
      }));
    }
  }, [formData.obstetricHistory]);

  const fetchMothers = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/mothers', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setMothers(result.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch mothers:', error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Errors = {};

    if (!formData.motherId) {
      newErrors.motherId = 'Mother is required';
    }

    if (!formData.lmpDate) {
      newErrors.lmpDate = 'LMP date is required';
    } else {
      try {
        const lmpDate = new Date(formData.lmpDate);
        const now = new Date();

        if (lmpDate > now) {
          newErrors.lmpDate = 'LMP date must be a past date';
        }

        const maxLmpDateMs = now.getTime() - 294 * 24 * 60 * 60 * 1000;
        if (lmpDate.getTime() < maxLmpDateMs) {
          newErrors.lmpDate = 'LMP date must not be more than 42 weeks ago';
        }
      } catch {
        newErrors.lmpDate = 'Invalid date format';
      }
    }

    if (!formData.antenatalStatus) {
      newErrors.antenatalStatus = 'Antenatal status is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRiskFactorToggle = (factor: string) => {
    setFormData((prev) => ({
      ...prev,
      riskFactors: prev.riskFactors.includes(factor)
        ? prev.riskFactors.filter((f) => f !== factor)
        : [...prev.riskFactors, factor],
    }));
  };

  const handleAncCardFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF');
      return;
    }

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setErrorMessage('File size exceeds 10MB limit');
      return;
    }

    // Show preview
    setAncCardPreview({ name: file.name });
    setFormData((prev) => ({
      ...prev,
      ancCardFile: file,
    }));

    // For image files, show thumbnail
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAncCardPreview({ name: file.name, url: e.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const addObstetricHistoryRow = () => {
    const newId = `row-${Date.now()}`;
    setFormData((prev) => ({
      ...prev,
      obstetricHistory: [
        ...prev.obstetricHistory,
        {
          id: newId,
          year: '',
          outcome: '',
          deliveryMode: '',
          complications: [],
        },
      ],
    }));
  };

  const updateObstetricHistoryRow = (rowId: string, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      obstetricHistory: prev.obstetricHistory.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      ),
    }));
  };

  const deleteObstetricHistoryRow = (rowId: string) => {
    setFormData((prev) => ({
      ...prev,
      obstetricHistory: prev.obstetricHistory.filter((row) => row.id !== rowId),
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('authToken');

      // First, create the pregnancy
      const pregnancyPayload = {
        motherId: Number(formData.motherId),
        lmpDate: formData.lmpDate,
        multiplePregnancy: formData.multiplePregnancy,
        riskFactors: formData.riskFactors,
        antenatalStatus: formData.antenatalStatus,
        obstetricHistory: formData.obstetricHistory
          .filter((row) => row.year && row.outcome)
          .map((row) => ({
            year: Number(row.year),
            outcome: row.outcome,
            deliveryMode: row.deliveryMode || null,
            complications: row.complications.length > 0 ? row.complications : null,
          })),
      };

      const pregnancyResponse = await fetch('/api/pregnancies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(pregnancyPayload),
      });

      if (!pregnancyResponse.ok) {
        const result = await pregnancyResponse.json();
        throw new Error(result.error || 'Failed to create pregnancy');
      }

      const pregnancyResult = await pregnancyResponse.json();
      const pregnancyId = pregnancyResult.data.id;

      // Then, upload ANC card if provided
      if (formData.ancCardFile) {
        const ancFormData = new FormData();
        ancFormData.append('file', formData.ancCardFile);
        ancFormData.append('pregnancyId', pregnancyId.toString());
        ancFormData.append('motherId', formData.motherId.toString());
        ancFormData.append('title', 'ANC Card');
        ancFormData.append('type', 'OTHER');

        await fetch('/api/clinical-archives', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: ancFormData,
        }).catch((error) => {
          console.error('Failed to upload ANC card:', error);
          // Don't fail the whole operation if ANC upload fails
        });
      }

      setSuccessMessage('Pregnancy created successfully!');
      
      // Close modal and call success callback
      setTimeout(() => {
        onClose();
        onSuccess(pregnancyId);
      }, 1500);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
          bg-white rounded-lg shadow-xl z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto
          transform transition-all duration-300
          ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
      >
        {/* Yellow Banner */}
        <div className="bg-amber-100 border-b border-amber-300 p-4 sticky top-0 z-10">
          <p className="text-sm font-semibold text-amber-900">
            You are opening a NEW pregnancy episode for this mother.
            <br />
            This is separate from any previous pregnancies on record.
          </p>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="p-4 bg-green-50 border border-green-200 rounded text-sm text-green-700">
              {successMessage}
            </div>
          )}

          {/* Mother Dropdown */}
          <SelectDropdown
            label="Mother"
            required
            options={mothers.map((m) => ({
              value: m.id.toString(),
              label: `${m.fullName} (${m.phone})`,
            }))}
            value={formData.motherId.toString()}
            onChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                motherId: value ? parseInt(value, 10) : '',
              }))
            }
            error={errors.motherId}
          />

          {/* LMP Date Picker */}
          <DateInput
            label="LMP Date"
            required
            value={formData.lmpDate}
            onChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                lmpDate: value,
              }))
            }
            error={errors.lmpDate}
            helperText="Must be a valid past date, not more than 42 weeks ago"
          />

          {/* EDD (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expected Delivery Date (EDD)
            </label>
            <input
              type="date"
              value={formData.edd}
              disabled
              className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded text-gray-700 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Auto-calculated as LMP + 280 days</p>
          </div>

          {/* Gravida and Parity Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gravida
              </label>
              <input
                type="number"
                value={formData.gravida}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    gravida: e.target.value ? parseInt(e.target.value, 10) : '',
                  }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Auto-calculated"
              />
              <p className="text-xs text-gray-500 mt-1">Auto-calculated from history</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parity
              </label>
              <input
                type="number"
                value={formData.parity}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    parity: e.target.value ? parseInt(e.target.value, 10) : '',
                  }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Auto-calculated"
              />
              <p className="text-xs text-gray-500 mt-1">Live births</p>
            </div>
          </div>

          {/* Multiple Pregnancy Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Multiple Pregnancy
            </label>
            <div className="space-y-2">
              {['NONE', 'TWINS', 'TRIPLETS_PLUS'].map((option) => (
                <label key={option} className="flex items-center">
                  <input
                    type="radio"
                    name="multiplePregnancy"
                    value={option}
                    checked={formData.multiplePregnancy === option}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        multiplePregnancy: e.target.value,
                      }))
                    }
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {option === 'NONE' ? 'None' : option === 'TWINS' ? 'Twins' : 'Triplets+'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Risk Factors Checkboxes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Known Risk Factors
            </label>
            <div className="space-y-2">
              {RISK_FACTORS_OPTIONS.map((factor) => (
                <label key={factor} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.riskFactors.includes(factor)}
                    onChange={() => handleRiskFactorToggle(factor)}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">{factor}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Antenatal Journey Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Antenatal Journey Status
            </label>
            <div className="space-y-2">
              {[
                { value: 'YET_TO_START', label: 'Yet to start antenatal' },
                { value: 'ACTIVE', label: 'Actively attending' },
                { value: 'COMPLETED', label: 'Completed antenatal' },
              ].map((option) => (
                <label key={option.value} className="flex items-center">
                  <input
                    type="radio"
                    name="antenatalStatus"
                    value={option.value}
                    checked={formData.antenatalStatus === option.value}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        antenatalStatus: e.target.value,
                      }))
                    }
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="ml-2 text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
            {errors.antenatalStatus && (
              <p className="text-sm text-red-600 mt-2">{errors.antenatalStatus}</p>
            )}
          </div>

          {/* Past Obstetric History Section (Expandable) */}
          <div className="border rounded-lg">
            <button
              type="button"
              onClick={() => setObstetricHistoryExpanded(!obstetricHistoryExpanded)}
              className="w-full px-4 py-3 font-medium text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
            >
              <span>Past Obstetric History (Optional)</span>
              <span>{obstetricHistoryExpanded ? '▼' : '▶'}</span>
            </button>

            {obstetricHistoryExpanded && (
              <div className="border-t px-4 py-4 space-y-4 bg-gray-50">
                {formData.obstetricHistory.length > 0 ? (
                  <div className="space-y-4">
                    {formData.obstetricHistory.map((row, idx) => (
                      <div
                        key={row.id}
                        className="border rounded p-4 bg-white space-y-3"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="text-sm font-semibold text-gray-700">
                            Pregnancy {idx + 1}
                          </h4>
                          <button
                            type="button"
                            onClick={() => deleteObstetricHistoryRow(row.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="number"
                            placeholder="Year"
                            value={row.year}
                            onChange={(e) =>
                              updateObstetricHistoryRow(
                                row.id,
                                'year',
                                e.target.value ? parseInt(e.target.value, 10) : ''
                              )
                            }
                            className="px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                          />

                          <select
                            value={row.outcome}
                            onChange={(e) =>
                              updateObstetricHistoryRow(row.id, 'outcome', e.target.value)
                            }
                            className="px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Outcome</option>
                            {OBSTETRIC_OUTCOMES.map((outcome) => (
                              <option key={outcome} value={outcome}>
                                {outcome === 'LIVE_BIRTH'
                                  ? 'Live birth'
                                  : outcome === 'MISCARRIAGE'
                                  ? 'Miscarriage'
                                  : outcome === 'STILLBIRTH'
                                  ? 'Stillbirth'
                                  : 'Abortion'}
                              </option>
                            ))}
                          </select>
                        </div>

                        <select
                          value={row.deliveryMode}
                          onChange={(e) =>
                            updateObstetricHistoryRow(row.id, 'deliveryMode', e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Delivery Mode</option>
                          {DELIVERY_MODES.map((mode) => (
                            <option key={mode} value={mode}>
                              {mode === 'SVD' ? 'SVD' : mode === 'C_SECTION' ? 'C-section' : 'Assisted'}
                            </option>
                          ))}
                        </select>

                        <textarea
                          placeholder="Complications (e.g., gestational diabetes)"
                          value={row.complications.join(', ')}
                          onChange={(e) =>
                            updateObstetricHistoryRow(
                              row.id,
                              'complications',
                              e.target.value
                                .split(',')
                                .map((c) => c.trim())
                                .filter((c) => c !== '')
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                          rows={2}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No previous pregnancies added yet</p>
                )}

                <button
                  type="button"
                  onClick={addObstetricHistoryRow}
                  className="w-full px-4 py-2 bg-blue-50 border border-blue-300 text-blue-700 rounded text-sm font-medium hover:bg-blue-100 transition"
                >
                  + Add Previous Pregnancy
                </button>
              </div>
            )}
          </div>

          {/* ANC Card Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload ANC Card
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded p-4">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleAncCardFileChange}
                className="w-full"
              />
              {ancCardPreview && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">File: {ancCardPreview.name}</p>
                  {ancCardPreview.url && (
                    <img
                      src={ancCardPreview.url}
                      alt="ANC Card Preview"
                      className="max-w-xs max-h-48 border rounded"
                    />
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Accepted formats: JPEG, PNG, GIF, WebP, PDF (max 10MB)
            </p>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 justify-end border-t pt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 'Create Pregnancy'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
