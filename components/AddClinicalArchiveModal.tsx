'use client';

import { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';

interface AddClinicalArchiveModalProps {
  pregnancyId: number;
  motherId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  token?: string;
}

export function AddClinicalArchiveModal({
  pregnancyId,
  motherId,
  isOpen,
  onClose,
  onSuccess,
  token,
}: AddClinicalArchiveModalProps) {
  const [formData, setFormData] = useState({
    type: 'OTHER',
    title: '',
    datePerformed: '',
    notes: '',
  });

  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.currentTarget;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileSelect = async (selectedFile: File) => {
    setError(null);

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError(
        `Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF`
      );
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setError('File size exceeds 10MB limit');
      return;
    }

    setFile(selectedFile);
    await uploadFile(selectedFile);
  };

  const uploadFile = async (selectedFile: File) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setError(null);

      const formDataObj = new FormData();
      formDataObj.append('file', selectedFile);

      // Use XMLHttpRequest to track progress
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      // Return a promise that resolves when upload completes
      return new Promise<void>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status === 201 || xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            if (response.success && response.data?.fileUrl) {
              setFileUrl(response.data.fileUrl);
              setUploadProgress(100);
              resolve();
            } else {
              reject(
                new Error(response.error || 'Upload failed')
              );
            }
          } else {
            const response = JSON.parse(xhr.responseText);
            reject(new Error(response.error || 'Upload failed'));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });

        xhr.open('POST', '/api/uploads');
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        xhr.send(formDataObj);
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'File upload failed';
      setError(message);
      setFile(null);
      setFileUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragRef.current) {
      dragRef.current.classList.add('border-blue-500', 'bg-blue-50');
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragRef.current) {
      dragRef.current.classList.remove('border-blue-500', 'bg-blue-50');
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragRef.current) {
      dragRef.current.classList.remove('border-blue-500', 'bg-blue-50');
    }

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      await handleFileSelect(droppedFiles[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    if (!fileUrl) {
      setError('Please upload a file first');
      return;
    }

    try {
      setIsSubmitting(true);

      const submitFormData = new FormData();
      submitFormData.append('pregnancyId', pregnancyId.toString());
      submitFormData.append('motherId', motherId.toString());
      submitFormData.append('type', formData.type);
      submitFormData.append('title', formData.title.trim());
      submitFormData.append('fileUrl', fileUrl);
      if (formData.datePerformed) {
        submitFormData.append('datePerformed', formData.datePerformed);
      }
      if (formData.notes.trim()) {
        submitFormData.append('notes', formData.notes.trim());
      }

      const response = await fetch('/api/clinical-archives', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token || localStorage.getItem('token') || ''}`,
        },
        body: submitFormData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create archive entry');
      }

      // Success - reset form and close
      setFormData({ type: 'OTHER', title: '', datePerformed: '', notes: '' });
      setFile(null);
      setFileUrl(null);
      setUploadProgress(0);
      onSuccess();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create archive entry';
      setError(message);
      console.error('Archive creation error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Add Clinical Archive Entry
          </h2>
          <button
            onClick={onClose}
            disabled={isSubmitting || isUploading}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="rounded-md bg-red-50 p-4 border border-red-200">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Type Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="text-red-600">*</span>
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              disabled={isSubmitting || isUploading}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="TEST_RESULT">Test Result</option>
              <option value="IMAGING">Imaging Report</option>
              <option value="MEDICATION">Medication</option>
              <option value="PROCEDURE">Procedure</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title / Description <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., Blood Test Results, Ultrasound Report"
              disabled={isSubmitting || isUploading}
              maxLength={200}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.title.length}/200
            </p>
          </div>

          {/* Date Performed */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date Performed
            </label>
            <input
              type="date"
              name="datePerformed"
              value={formData.datePerformed}
              onChange={handleInputChange}
              disabled={isSubmitting || isUploading}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          {/* Notes / Details */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes / Details
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Additional notes or details about this entry..."
              disabled={isSubmitting || isUploading}
              maxLength={1000}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.notes.length}/1000
            </p>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              File Upload <span className="text-red-600">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Supported: JPEG, PNG, GIF, WebP, PDF (max 10MB)
            </p>

            {!fileUrl ? (
              <div
                ref={dragRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors"
              >
                <Upload className="mx-auto h-10 w-10 text-gray-400 mb-2" />
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Drag and drop your file here
                </p>
                <p className="text-xs text-gray-500 mb-3">or</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                >
                  Select File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                  disabled={isUploading}
                  accept="image/*,.pdf"
                  className="hidden"
                />
              </div>
            ) : (
              <div className="border border-green-200 rounded-lg bg-green-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-green-100 flex items-center justify-center">
                      <span className="text-xs font-semibold text-green-700">
                        ✓
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {file?.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {((file?.size || 0) / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setFileUrl(null);
                      setUploadProgress(0);
                    }}
                    disabled={isSubmitting}
                    className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {isUploading && (
              <div className="mt-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isUploading}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploading || !fileUrl}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
