'use client';

import React, { ReactNode, useState, useCallback } from 'react';
import { exportReportAsCSV, formatDateRange } from '@/lib/reports';

interface ReportCardProps {
  title: string;
  description?: string;
  reportKey: string;
  children: (filters: {
    from: string;
    to: string;
    facilityId?: string;
  }) => ReactNode;
  onExport?: (filters: { from: string; to: string; facilityId?: string }, data: any[]) => void;
  exportData?: any[];
  facilities?: Array<{ id: number | string; name: string }>;
}

export const ReportCard: React.FC<ReportCardProps> = ({
  title,
  description,
  reportKey,
  children,
  onExport,
  exportData = [],
  facilities = [],
}) => {
  // Default to last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [from, setFrom] = useState<string>(thirtyDaysAgo.toISOString().split('T')[0]);
  const [to, setTo] = useState<string>(today.toISOString().split('T')[0]);
  const [selectedFacility, setSelectedFacility] = useState<string>(
    facilities.length > 0 ? String(facilities[0].id) : ''
  );
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const filters = {
        from,
        to,
        facilityId: selectedFacility,
      };

      if (onExport) {
        onExport(filters, exportData);
      } else {
        // Default export
        exportReportAsCSV(reportKey, filters, exportData);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export report');
    } finally {
      setIsExporting(false);
    }
  }, [from, to, selectedFacility, reportKey, onExport, exportData]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        {description && <p className="text-gray-600 text-sm mt-1">{description}</p>}
      </div>

      {/* Filters Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 pb-6 border-b border-gray-200">
        {/* From Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* To Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Facility Filter */}
        {facilities.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Facility</label>
            <select
              value={selectedFacility}
              onChange={(e) => setSelectedFacility(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Export Button */}
        <div className="flex items-end">
          <button
            onClick={handleExport}
            disabled={isExporting || exportData.length === 0}
            className="w-full px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Date range display */}
      <p className="text-sm text-gray-500 mb-4">
        Showing data for {formatDateRange(from, to)}
      </p>

      {/* Content */}
      <div>{children({ from, to, facilityId: selectedFacility })}</div>
    </div>
  );
};
