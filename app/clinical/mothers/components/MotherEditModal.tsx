'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Mother } from '../hooks/useMothersList';
import { TextInput, PhoneInput, SelectDropdown } from '@/components/FormInputs';

interface MotherEditModalProps {
  mother: Mother | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedMother: Mother) => void;
  token: string | null;
}

interface EditFormData {
  fullName: string;
  phone: string;
  districtId: string;
  village: string;
}

interface EditFormErrors {
  fullName?: string;
  phone?: string;
  districtId?: string;
  general?: string;
}

export function MotherEditModal({
  mother,
  isOpen,
  onClose,
  onSave,
  token,
}: MotherEditModalProps) {
  const [formData, setFormData] = useState<EditFormData>({
    fullName: '',
    phone: '',
    districtId: '',
    village: '',
  });
  const [errors, setErrors] = useState<EditFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [districts, setDistricts] = useState<any[]>([]);

  // Populate form when mother changes
  useEffect(() => {
    if (mother && isOpen) {
      setFormData({
        fullName: mother.fullName,
        phone: mother.phone,
        districtId: mother.districtId.toString(),
        village: mother.village || '',
      });
      setErrors({});
    }
  }, [mother, isOpen]);

  // Fetch districts
  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        const response = await fetch('/api/districts');
        const data = await response.json();
        if (data.success) {
          setDistricts(data.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch districts:', error);
      }
    };

    if (isOpen) {
      fetchDistricts();
    }
  }, [isOpen]);

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^(07\d{6}|\+256[0-9]{9})$/;
    return phoneRegex.test(phone.trim());
  };

  const validateForm = (): boolean => {
    const newErrors: EditFormErrors = {};

    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters';
    }

    if (!validatePhone(formData.phone)) {
      newErrors.phone = 'Invalid phone number format (07XXXXXX or +256XXXXXXXXX)';
    }

    if (!formData.districtId) {
      newErrors.districtId = 'District is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !mother || !token) return;

    try {
      setIsLoading(true);
      setErrors({});

      const response = await fetch(`/api/mothers/${mother.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
          phone: formData.phone.trim(),
          districtId: Number(formData.districtId),
          village: formData.village.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update mother');
      }

      // Call onSave with updated data
      onSave(data.data);

      // Close modal
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      setErrors({ general: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  if (!mother) return null;

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      {/* Modal */}
      <div
        className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl z-50 w-full max-w-md transform transition-all duration-300 ${
          isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        } max-h-[90vh] overflow-y-auto`}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Edit Mother</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isLoading}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* General Error */}
            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {errors.general}
              </div>
            )}

            {/* Full Name */}
            <div>
              <TextInput
                label="Full Name"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                error={!!errors.fullName}
                helperText={errors.fullName}
                placeholder="Enter full name"
                required
              />
            </div>

            {/* Phone */}
            <div>
              <PhoneInput
                label="Phone Number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                error={!!errors.phone}
                helperText={errors.phone}
                required
              />
            </div>

            {/* District */}
            <div>
              <SelectDropdown
                label="District"
                value={formData.districtId}
                onChange={(e) => setFormData({ ...formData, districtId: e.target.value })}
                options={districts.map((d) => ({ value: d.id.toString(), label: d.name }))}
                error={!!errors.districtId}
                helperText={errors.districtId}
                placeholder="Select a district"
                required
              />
            </div>

            {/* Village */}
            <div>
              <TextInput
                label="Village"
                value={formData.village}
                onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                placeholder="Enter village (optional)"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2 justify-end pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:text-gray-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
