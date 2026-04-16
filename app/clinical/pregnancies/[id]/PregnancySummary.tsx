'use client';

import { Download } from 'lucide-react';

interface PregnancySummaryProps {
  lmpDate: string;
  edd: string;
  gestationalAgeWeeks: number;
  gravida: number;
  parity: number;
  multiplePregnancy?: string;
  antenatalStatus?: string;
  ancCardUrl?: string;
}

export function PregnancySummary({
  lmpDate,
  edd,
  gestationalAgeWeeks,
  gravida,
  parity,
  multiplePregnancy = 'NONE',
  antenatalStatus = 'YET_TO_START',
  ancCardUrl,
}: PregnancySummaryProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-UG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getMultiplePregnancyLabel = (type?: string) => {
    switch (type) {
      case 'TWINS':
        return 'Twins';
      case 'TRIPLETS_PLUS':
        return 'Triplets+';
      case 'NONE':
      default:
        return 'Single';
    }
  };

  const getAntenatalStatusLabel = (status?: string) => {
    switch (status) {
      case 'YET_TO_START':
        return 'Yet to Start';
      case 'ACTIVE':
        return 'Actively Attending';
      case 'COMPLETED':
        return 'Completed';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-6">Pregnancy Summary</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* LMP Date */}
        <div className="border-l-4 border-blue-500 pl-4">
          <label className="block text-sm font-medium text-gray-600 mb-1">Last Menstrual Period (LMP)</label>
          <p className="text-lg font-semibold text-gray-900">{formatDate(lmpDate)}</p>
        </div>

        {/* EDD */}
        <div className="border-l-4 border-green-500 pl-4">
          <label className="block text-sm font-medium text-gray-600 mb-1">Expected Delivery Date (EDD)</label>
          <p className="text-lg font-semibold text-gray-900">{formatDate(edd)}</p>
        </div>

        {/* Gestational Age */}
        <div className="border-l-4 border-purple-500 pl-4">
          <label className="block text-sm font-medium text-gray-600 mb-1">Gestational Age</label>
          <p className="text-lg font-semibold text-gray-900">{gestationalAgeWeeks} weeks</p>
        </div>

        {/* Gravida */}
        <div className="border-l-4 border-orange-500 pl-4">
          <label className="block text-sm font-medium text-gray-600 mb-1">Gravida (Total Pregnancies)</label>
          <p className="text-lg font-semibold text-gray-900">{gravida}</p>
        </div>

        {/* Parity */}
        <div className="border-l-4 border-pink-500 pl-4">
          <label className="block text-sm font-medium text-gray-600 mb-1">Parity (Live Births)</label>
          <p className="text-lg font-semibold text-gray-900">{parity}</p>
        </div>

        {/* Multiple Pregnancy */}
        <div className="border-l-4 border-indigo-500 pl-4">
          <label className="block text-sm font-medium text-gray-600 mb-1">Multiple Pregnancy</label>
          <p className="text-lg font-semibold text-gray-900">{getMultiplePregnancyLabel(multiplePregnancy)}</p>
        </div>

        {/* Antenatal Status */}
        <div className="border-l-4 border-teal-500 pl-4">
          <label className="block text-sm font-medium text-gray-600 mb-1">Antenatal Status</label>
          <p className="text-lg font-semibold text-gray-900">{getAntenatalStatusLabel(antenatalStatus)}</p>
        </div>
      </div>

      {/* ANC Card Download */}
      {ancCardUrl && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-600 mb-3">ANC Card Document</label>
          <a
            href={ancCardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors"
          >
            <Download size={18} />
            Download ANC Card
          </a>
        </div>
      )}
    </div>
  );
}
