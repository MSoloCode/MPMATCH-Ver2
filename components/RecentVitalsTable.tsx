'use client';

import React from 'react';

interface VitalsRecord {
  id: number;
  systolicBP?: number | null;
  diastolicBP?: number | null;
  bpNotTaken: boolean;
  temperatureC?: number | null;
  weightKg?: number | null;
  pulseBpm?: number | null;
  respRate?: number | null;
  oxygenSatPct?: number | null;
  createdAt: string;
  mother?: {
    fullName: string;
  };
  ancVisit?: {
    visitNumber: number;
  };
}

interface RecentVitalsTableProps {
  vitals: VitalsRecord[];
  isLoading?: boolean;
}

// Helper function to determine BP color class and text styling
const getBPStyles = (systolic?: number | null, diastolic?: number | null, bpNotTaken?: boolean) => {
  if (bpNotTaken || systolic === null || systolic === undefined || diastolic === null || diastolic === undefined) {
    return { text: '', bg: '', display: 'Not taken' };
  }

  const sys = systolic;
  const dias = diastolic;

  // Hypertensive crisis: systolic ≥160 OR diastolic ≥100
  if (sys >= 160 || dias >= 100) {
    return {
      text: 'text-red-600',
      bg: 'bg-red-50',
      display: `${sys}/${dias}`,
    };
  }

  // Elevated: systolic 140–159 OR diastolic 90–99
  if ((sys >= 140 && sys <= 159) || (dias >= 90 && dias <= 99)) {
    return {
      text: 'text-amber-600',
      bg: 'bg-amber-50',
      display: `${sys}/${dias}`,
    };
  }

  // Low: systolic <90 OR diastolic <60
  if (sys < 90 || dias < 60) {
    return {
      text: 'text-blue-600',
      bg: 'bg-white',
      display: `${sys}/${dias}`,
    };
  }

  // Normal: systolic 90–139 AND diastolic 60–89
  return {
    text: 'text-gray-900',
    bg: 'bg-white',
    display: `${sys}/${dias}`,
  };
};

export default function RecentVitalsTable({ vitals, isLoading = false }: RecentVitalsTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        <p>Loading recent vitals...</p>
      </div>
    );
  }

  if (!vitals || vitals.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        <p>No recent vitals recorded</p>
      </div>
    );
  }

  const bpStyles = (vital: VitalsRecord) => getBPStyles(vital.systolicBP, vital.diastolicBP, vital.bpNotTaken);

  return (
    <div className="overflow-x-auto border border-neutral-300 rounded-lg bg-neutral-50">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-300 bg-neutral-100">
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Mother</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Visit</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">BP</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Temp</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Weight</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Pulse</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">RR</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">SpO2</th>
          </tr>
        </thead>
        <tbody>
          {vitals.map((vital, index) => {
            const bpStyle = bpStyles(vital);
            const isGrayText = vital.bpNotTaken || vital.systolicBP === null || vital.systolicBP === undefined;

            return (
              <tr
                key={vital.id}
                className={`border-b border-neutral-200 hover:bg-neutral-100 transition-colors ${
                  index % 2 === 0 ? 'bg-white' : 'bg-neutral-50'
                }`}
              >
                <td className="px-4 py-3 text-gray-900">{vital.mother?.fullName || '---'}</td>
                <td className="px-4 py-3 text-gray-900">
                  {vital.ancVisit ? `#${vital.ancVisit.visitNumber}` : '---'}
                </td>
                <td className={`px-4 py-3 font-medium ${bpStyle.bg} ${isGrayText ? 'text-gray-500' : bpStyle.text}`}>
                  {bpStyle.display}
                </td>
                <td className="px-4 py-3 text-gray-900">
                  {vital.temperatureC !== null && vital.temperatureC !== undefined
                    ? `${vital.temperatureC}°C`
                    : '---'}
                </td>
                <td className="px-4 py-3 text-gray-900">
                  {vital.weightKg !== null && vital.weightKg !== undefined ? `${vital.weightKg} kg` : '---'}
                </td>
                <td className="px-4 py-3 text-gray-900">
                  {vital.pulseBpm !== null && vital.pulseBpm !== undefined ? `${vital.pulseBpm} bpm` : '---'}
                </td>
                <td className="px-4 py-3 text-gray-900">
                  {vital.respRate !== null && vital.respRate !== undefined ? `${vital.respRate}` : '---'}
                </td>
                <td className="px-4 py-3 text-gray-900">
                  {vital.oxygenSatPct !== null && vital.oxygenSatPct !== undefined ? `${vital.oxygenSatPct}%` : '---'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
