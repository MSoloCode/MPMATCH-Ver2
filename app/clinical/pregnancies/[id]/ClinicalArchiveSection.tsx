'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ClinicalArchiveTimeline } from '@/components/ClinicalArchiveTimeline';
import { AddClinicalArchiveModal } from '@/components/AddClinicalArchiveModal';

interface ClinicalArchive {
  id: number;
  type: 'TEST_RESULT' | 'IMAGING' | 'MEDICATION' | 'PROCEDURE' | 'OTHER';
  title: string;
  datePerformed: string | null;
  notes: string | null;
  fileUrl: string;
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleModalSuccess = async () => {
    // Refresh the pregnancy data to get updated archives
    setIsRefreshing(true);
    try {
      // The parent will handle the refresh through the API call
      // Just close the modal and let the parent component refetch
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">Clinical Archive</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          Add Entry
        </button>
      </div>

      {/* Timeline Display */}
      <ClinicalArchiveTimeline
        archives={archives}
        isLoading={isRefreshing}
        onRefresh={handleModalSuccess}
      />

      {/* Add Entry Modal */}
      <AddClinicalArchiveModal
        pregnancyId={pregnancyId}
        motherId={motherId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
