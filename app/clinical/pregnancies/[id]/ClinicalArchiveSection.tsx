'use client';

import { useState } from 'react';
import { Download, Trash2, Plus, FileText, Image, Pill, Stethoscope } from 'lucide-react';

interface ClinicalArchive {
  id: number;
  type: string;
  title: string;
  datePerformed?: string;
  notes?: string;
  fileUrl?: string;
  uploadedById: number;
  createdAt: string;
  uploadedBy?: {
    id: number;
    name: string;
  };
}

interface ClinicalArchiveSectionProps {
  archives: ClinicalArchive[];
  pregnancyId: number;
  motherId: number;
  onUpload?: (file: File, data: any) => Promise<void>;
  onDelete?: (archiveId: number) => Promise<void>;
}

export function ClinicalArchiveSection({
  archives,
  pregnancyId,
  motherId,
  onUpload,
  onDelete,
}: ClinicalArchiveSectionProps) {
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    type: 'OTHER',
    datePerformed: '',
    notes: '',
    file: null as File | null,
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-UG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'TEST_RESULT':
        return <FileText size={18} />;
      case 'IMAGING':
        return <Image size={18} />;
      case 'MEDICATION':
        return <Pill size={18} />;
      case 'PROCEDURE':
        return <Stethoscope size={18} />;
      default:
        return <FileText size={18} />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'TEST_RESULT':
        return 'bg-blue-100 text-blue-800';
      case 'IMAGING':
        return 'bg-green-100 text-green-800';
      case 'MEDICATION':
        return 'bg-yellow-100 text-yellow-800';
      case 'PROCEDURE':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'TEST_RESULT':
        return 'Test Result';
      case 'IMAGING':
        return 'Imaging';
      case 'MEDICATION':
        return 'Medication';
      case 'PROCEDURE':
        return 'Procedure';
      default:
        return 'Other';
    }
  };

  const handleUpload = async () => {
    if (!formData.file || !formData.title) {
      setUploadError('Please fill in all required fields');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);

      if (onUpload) {
        await onUpload(formData.file, {
          title: formData.title,
          type: formData.type,
          datePerformed: formData.datePerformed,
          notes: formData.notes,
        });
      }

      // Reset form
      setFormData({
        title: '',
        type: 'OTHER',
        datePerformed: '',
        notes: '',
        file: null,
      });
      setShowUploadForm(false);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (archiveId: number) => {
    if (!onDelete || !window.confirm('Are you sure you want to delete this archive?')) {
      return;
    }

    try {
      await onDelete(archiveId);
    } catch (error) {
      console.error('Failed to delete archive:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">Clinical Archives</h2>
        {onUpload && (
          <button
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            Upload Document
          </button>
        )}
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <div className="mb-6 p-4 border border-blue-200 rounded-lg bg-blue-50">
          <h3 className="font-semibold text-gray-900 mb-4">Upload Clinical Document</h3>

          {uploadError && (
            <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded-lg text-red-800 text-sm">
              {uploadError}
            </div>
          )}

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Blood Test Results, Ultrasound Report"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document Type
              </label>
              <select
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="TEST_RESULT">Test Result</option>
                <option value="IMAGING">Imaging</option>
                <option value="MEDICATION">Medication</option>
                <option value="PROCEDURE">Procedure</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* Date Performed */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Performed
              </label>
              <input
                type="date"
                value={formData.datePerformed}
                onChange={e => setFormData({ ...formData, datePerformed: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes or findings"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document File * (PDF or Image)
              </label>
              <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={e => setFormData({ ...formData, file: e.target.files?.[0] || null })}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="text-center pointer-events-none">
                  <FileText size={32} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">
                    {formData.file ? formData.file.name : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">PDF or image files (max 10MB)</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isUploading ? 'Uploading...' : 'Upload Document'}
              </button>
              <button
                onClick={() => setShowUploadForm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archives List */}
      {archives && archives.length > 0 ? (
        <div className="space-y-3">
          {archives.map(archive => (
            <div key={archive.id} className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
              <div className={`mt-1 p-2 rounded-lg ${getTypeColor(archive.type)}`}>
                {getTypeIcon(archive.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{archive.title}</h3>
                    <p className="text-xs text-gray-600 mt-1">
                      {formatDate(archive.datePerformed)}
                      {archive.uploadedBy && ` • Uploaded by ${archive.uploadedBy.name}`}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ml-2 ${getTypeColor(archive.type)}`}>
                    {getTypeLabel(archive.type)}
                  </span>
                </div>

                {archive.notes && (
                  <p className="text-sm text-gray-700 mb-3">{archive.notes}</p>
                )}

                <div className="flex gap-2">
                  {archive.fileUrl && (
                    <a
                      href={archive.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
                    >
                      <Download size={14} />
                      Download
                    </a>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => handleDelete(archive.id)}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600 text-center py-8">No documents uploaded yet.</p>
      )}
    </div>
  );
}
