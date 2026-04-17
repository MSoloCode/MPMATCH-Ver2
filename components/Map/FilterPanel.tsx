'use client';

import React from 'react';

interface FilterPanelProps {
  showFacilities: boolean;
  onFacilitiesToggle: (value: boolean) => void;
  showHighRiskMothers: boolean;
  onHighRiskMothersToggle: (value: boolean) => void;
  showOpenAlerts: boolean;
  onOpenAlertsToggle: (value: boolean) => void;
}

export default function FilterPanel({
  showFacilities,
  onFacilitiesToggle,
  showHighRiskMothers,
  onHighRiskMothersToggle,
  showOpenAlerts,
  onOpenAlertsToggle,
}: FilterPanelProps) {
  return (
    <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-4 min-w-64">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Filters</h3>

      <div className="space-y-3">
        {/* Facilities Toggle */}
        <label className="flex items-center cursor-pointer group">
          <input
            type="checkbox"
            checked={showFacilities}
            onChange={(e) => onFacilitiesToggle(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
          <div className="ml-3 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
            <span className="text-sm text-gray-700">Show Facilities</span>
          </div>
        </label>

        {/* High-Risk Mothers Toggle */}
        <label className="flex items-center cursor-pointer group">
          <input
            type="checkbox"
            checked={showHighRiskMothers}
            onChange={(e) => onHighRiskMothersToggle(e.target.checked)}
            className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-2 focus:ring-orange-500"
          />
          <div className="ml-3 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ff9800' }} />
            <span className="text-sm text-gray-700">Show High-Risk Mothers</span>
          </div>
        </label>

        {/* Open Alerts Toggle */}
        <label className="flex items-center cursor-pointer group">
          <input
            type="checkbox"
            checked={showOpenAlerts}
            onChange={(e) => onOpenAlertsToggle(e.target.checked)}
            className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-2 focus:ring-red-500"
          />
          <div className="ml-3 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full pulsing-alert-dot" style={{ backgroundColor: '#f44336' }} />
            <span className="text-sm text-gray-700">Show Open Alerts</span>
          </div>
        </label>
      </div>
    </div>
  );
}
