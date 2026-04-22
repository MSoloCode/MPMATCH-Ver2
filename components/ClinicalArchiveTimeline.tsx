'use client';

import { Download, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';

interface ClinicalArchive {
  id: number;
  type: 'TEST_RESULT' | 'IMAGING' | 'MEDICATION' | 'PROCEDURE' | 'OTHER';
  title: string;
  datePerformed: string | null;
  notes: string | null;
  fileUrl: string;
  createdAt: string;
  uploadedBy?: {
    name: string;
    role?: string;
  };
}

interface ClinicalArchiveTimelineProps {
  archives: ClinicalArchive[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

const typeBadgeConfig = {
  TEST_RESULT: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Test Result' },
  IMAGING: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Imaging' },
  MEDICATION: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Medication' },
  PROCEDURE: { bg: 'bg-red-100', text: 'text-red-800', label: 'Procedure' },
  OTHER: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Other' },
};

export function ClinicalArchiveTimeline({
  archives,
  isLoading = false,
  onRefresh,
}: ClinicalArchiveTimelineProps) {
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async (archive: ClinicalArchive) => {
    try {
      setDownloadingId(archive.id);
      setDownloadError(null);

      // Fetch file
      const response = await fetch(archive.fileUrl);
      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      // Audit log the download
      await fetch('/api/audit-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          action: 'READ_SENSITIVE',
          resource: 'clinical_archive',
          resourceId: archive.id,
          changesSummary: {
            action: 'download',
            archiveType: archive.type,
            fileName: archive.title,
          },
        }),
      }).catch(() => {
        // Log error but don't block download
        console.error('Failed to log download');
      });

      // Trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = archive.title || 'download';
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadError(
        error instanceof Error ? error.message : 'Download failed'
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No date';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Invalid date';
    }
  };

  // Sort by datePerformed or createdAt, newest first
  const sortedArchives = [...archives].sort((a, b) => {
    const aDate = new Date(a.datePerformed || a.createdAt);
    const bDate = new Date(b.datePerformed || b.createdAt);
    return bDate.getTime() - aDate.getTime();
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading clinical archives...</div>
      </div>
    );
  }

  if (sortedArchives.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
        <div className="text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-gray-600 font-medium">No clinical archives yet</p>
          <p className="text-gray-500 text-sm">
            Add clinical interventions to build the patient's archive
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {downloadError && (
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <p className="text-sm text-red-800">{downloadError}</p>
        </div>
      )}

      <div className="space-y-4">
        {sortedArchives.map((archive, index) => {
          const badgeConfig =
            typeBadgeConfig[archive.type as keyof typeof typeBadgeConfig] ||
            typeBadgeConfig.OTHER;
          const isFirst = index === 0;

          return (
            <div key={archive.id} className="relative">
              {/* Timeline connector */}
              {!isFirst && (
                <div className="absolute left-6 top-0 h-4 w-0.5 bg-gray-300 -translate-y-4" />
              )}

              {/* Timeline dot */}
              <div className="absolute left-2 top-4 h-10 w-10 rounded-full bg-white border-2 border-blue-500 flex items-center justify-center">
                <div className="h-3 w-3 rounded-full bg-blue-500" />
              </div>

              {/* Card */}
              <div className="ml-20 rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {archive.title}
                      </h3>
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${badgeConfig.bg} ${badgeConfig.text}`}
                      >
                        {badgeConfig.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="font-medium">
                        {formatDate(archive.datePerformed)}
                      </span>
                      {archive.uploadedBy && (
                        <span>
                          by <span className="font-medium">{archive.uploadedBy.name}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownload(archive)}
                    disabled={downloadingId === archive.id}
                    className="ml-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                    title="Download file"
                  >
                    <Download className="h-4 w-4" />
                    {downloadingId === archive.id ? 'Downloading...' : 'Download'}
                  </button>
                </div>

                {archive.notes && (
                  <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {archive.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
