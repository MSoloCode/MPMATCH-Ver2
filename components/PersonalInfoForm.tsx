/**
 * Personal Information Form Component
 * Form for editing user profile information
 * Handles validation and API submission
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/Button';
import { TextInput } from '@/components/FormInputs';
import { AlertCircle, CheckCircle, Upload, X } from 'lucide-react';

interface PersonalInfoFormProps {
  onSuccess?: () => void;
  redirectOnSuccess?: boolean;
}

interface FormData {
  name: string;
  email?: string;
  phone: string;
  fullName?: string; // For mothers
  dob?: string;
  village?: string;
}

export default function PersonalInfoForm({
  onSuccess,
  redirectOnSuccess = false,
}: PersonalInfoFormProps) {
  const router = useRouter();
  const { token, isLoading: authLoading, role, motherId } = useAuth();

  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Image upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Load current user data
  useEffect(() => {
    const loadUserData = async () => {
      try {
        // Wait for auth to finish loading
        if (authLoading) {
          return;
        }

        setLoading(true);

        // Check if token exists
        if (!token) {
          router.push('/sign-in');
          return;
        }

        const response = await fetch('/api/users/profile', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load profile data');
        }

        const result = await response.json();
        if (result.success && result.data.user) {
          const user = result.data.user;
          const newFormData: FormData = {
            name: user.name || '',
            email: user.email || '',
            phone: user.phone || '',
          };

          // For community users, also load mother data
          if (role === 'COMMUNITY_USER' && result.data.mother) {
            const mother = result.data.mother;
            newFormData.fullName = mother.fullName || '';
            newFormData.dob = mother.dob ? mother.dob.split('T')[0] : '';
            newFormData.village = mother.village || '';
          }

          setFormData(newFormData);
          setErrorMessage(null);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        setErrorMessage('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [token, authLoading, role, router]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (formData.name && formData.name.length > 100) {
      newErrors.name = 'Name must be less than 100 characters';
    }

    if (formData.phone && formData.phone.trim().length < 7) {
      newErrors.phone = 'Phone must be at least 7 characters';
    }

    if (formData.email && formData.email.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Invalid email format';
      }
    }

    if (role === 'COMMUNITY_USER') {
      if (!formData.fullName || formData.fullName.trim().length < 2) {
        newErrors.fullName = 'Full name must be at least 2 characters';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle file selection
  const handleFileSelect = (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid file type. Only JPG, PNG, and WebP are allowed.');
      return;
    }

    if (file.size > maxSize) {
      setUploadError('File size exceeds 5MB limit');
      return;
    }

    setSelectedFile(file);
    setUploadError(null);

    // Generate preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Upload profile picture
  const handleImageUpload = async () => {
    if (!selectedFile || !token) {
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('avatar', selectedFile);

      const response = await fetch('/api/users/profile/upload-avatar', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to upload image');
      }

      setSelectedFile(null);
      setPreviewUrl(null);
      setSuccessMessage('Profile picture updated successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      setUploadError(
        error instanceof Error ? error.message : 'Failed to upload profile picture'
      );
    } finally {
      setUploading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      if (!token) {
        router.push('/sign-in');
        return;
      }

      // Update user profile
      const userUpdateData: Record<string, any> = {
        name: formData.name.trim(),
      };

      if (formData.email) {
        userUpdateData.email = formData.email.trim();
      }

      if (formData.phone) {
        userUpdateData.phone = formData.phone.trim();
      }

      const response = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userUpdateData),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to update profile');
      }

      // If community user, also update mother profile
      if (role === 'COMMUNITY_USER' && motherId) {
        const motherUpdateData: Record<string, any> = {};

        if (formData.fullName) {
          motherUpdateData.fullName = formData.fullName.trim();
        }

        if (formData.dob) {
          motherUpdateData.dob = formData.dob;
        }

        if (formData.village !== undefined) {
          motherUpdateData.village = formData.village ? formData.village.trim() : null;
        }

        if (Object.keys(motherUpdateData).length > 0) {
          const motherResponse = await fetch('/api/mothers/me', {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(motherUpdateData),
          });

          if (!motherResponse.ok) {
            const result = await motherResponse.json();
            throw new Error(result.error || 'Failed to update mother profile');
          }
        }
      }

      setSuccessMessage('Profile updated successfully!');
      
      if (onSuccess) {
        onSuccess();
      }

      if (redirectOnSuccess) {
        setTimeout(() => {
          router.push('/profile');
        }, 2000);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to update profile'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-green-800">Success</h3>
            <p className="text-sm text-green-700">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-800">Error</h3>
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Picture Upload */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Picture</h3>

          {uploadError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{uploadError}</p>
            </div>
          )}

          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
          >
            {previewUrl ? (
              <div className="space-y-4">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-24 h-24 rounded-full mx-auto object-cover"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedFile?.name}</p>
                  <p className="text-xs text-gray-500">
                    {(selectedFile?.size ?? 0) / (1024 * 1024) < 1
                      ? `${Math.round((selectedFile?.size ?? 0) / 1024)}KB`
                      : `${((selectedFile?.size ?? 0) / (1024 * 1024)).toFixed(2)}MB`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="cursor-pointer space-y-2">
                <Upload className="w-8 h-8 mx-auto text-gray-400" />
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-blue-600 hover:text-blue-700">Click to upload</span>
                  {' '}or drag and drop
                </div>
                <p className="text-xs text-gray-500">JPG, PNG or WebP (max 5MB)</p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {selectedFile && (
            <button
              type="button"
              onClick={handleImageUpload}
              disabled={uploading}
              className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {uploading ? 'Uploading...' : 'Upload Picture'}
            </button>
          )}
        </div>

        {/* Professional Info */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Professional Information</h3>

          <div className="space-y-4">
            <TextInput
              label="Full Name"
              type="text"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (errors.name) setErrors({ ...errors, name: '' });
              }}
              error={errors.name}
              required
            />

            <TextInput
              label="Phone Number"
              type="tel"
              placeholder="e.g. +256701234567 or 0701234567"
              value={formData.phone}
              onChange={(e) => {
                setFormData({ ...formData, phone: e.target.value });
                if (errors.phone) setErrors({ ...errors, phone: '' });
              }}
              error={errors.phone}
            />

            <TextInput
              label="Email Address"
              type="email"
              placeholder="Enter your email address"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value });
                if (errors.email) setErrors({ ...errors, email: '' });
              }}
              error={errors.email}
            />
          </div>
        </div>

        {/* Community User Specific Fields */}
        {role === 'COMMUNITY_USER' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>

            <div className="space-y-4">
              <TextInput
                label="Full Name"
                type="text"
                placeholder="Enter your full name"
                value={formData.fullName || ''}
                onChange={(e) => {
                  setFormData({ ...formData, fullName: e.target.value });
                  if (errors.fullName) setErrors({ ...errors, fullName: '' });
                }}
                error={errors.fullName}
                required
              />

              <TextInput
                label="Date of Birth"
                type="date"
                value={formData.dob || ''}
                onChange={(e) => {
                  setFormData({ ...formData, dob: e.target.value });
                }}
              />

              <TextInput
                label="Village"
                type="text"
                placeholder="Enter your village name"
                value={formData.village || ''}
                onChange={(e) => {
                  setFormData({ ...formData, village: e.target.value });
                }}
              />
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex gap-3 pt-6 border-t border-gray-200">
          <Button
            type="submit"
            disabled={submitting}
            className="flex-1"
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>

          <button
            type="button"
            onClick={() => router.push('/profile')}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
