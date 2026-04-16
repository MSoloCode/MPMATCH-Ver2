'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { TextInput, PhoneInput, SelectDropdown, Checkbox } from '@/components/FormInputs';

interface RegisterMotherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  token: string | null;
}

interface RegisterFormData {
  fullName: string;
  phone: string;
  districtId: string;
  village: string;
  consent: boolean;
}

interface RegisterFormErrors {
  fullName?: string;
  phone?: string;
  districtId?: string;
  consent?: string;
  general?: string;
}

export function RegisterMotherModal({
  isOpen,
  onClose,
  onSuccess,
  token,
}: RegisterMotherModalProps) {
  const [formData, setFormData] = useState<RegisterFormData>({
    fullName: '',
    phone: '',
    districtId: '',
    village: '',
    consent: false,
  });
  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [districts, setDistricts] = useState<any[]>([]);
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch districts on open
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
    const newErrors: RegisterFormErrors = {};

    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters';
    }

    if (!validatePhone(formData.phone)) {
      newErrors.phone = 'Invalid phone number format (07XXXXXX or +256XXXXXXXXX)';
    }

    if (!formData.districtId) {
      newErrors.districtId = 'District is required';
    }

    if (!formData.consent) {
      newErrors.consent = 'You must accept the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !token) return;

    try {
      setIsLoading(true);
      setErrors({});

      const response = await fetch('/api/mothers/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
        throw new Error(data.error || 'Failed to register mother');
      }

      setSuccessMessage('Mother registered successfully!');

      // Reset form
      setFormData({
        fullName: '',
        phone: '',
        districtId: '',
        village: '',
        consent: false,
      });

      // Close modal and notify parent
      setTimeout(() => {
        onSuccess();
        onClose();
        setSuccessMessage('');
      }, 1500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      setErrors({ general: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

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
            <h2 className="text-xl font-bold text-gray-900">Register New Mother</h2>
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

            {/* Success Message */}
            {successMessage && (
              <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                {successMessage}
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

            {/* Consent */}
            <div>
              <Checkbox
                label="I accept the terms and conditions"
                checked={formData.consent}
                onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
              />
              {errors.consent && <p className="text-sm text-red-600 mt-1">{errors.consent}</p>}
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
                {isLoading ? 'Registering...' : 'Register'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
