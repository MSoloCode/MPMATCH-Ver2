'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface FacilityUtilisationData {
  facility: string;
  facilityId: number;
  dates: Array<{
    period: string;
    visitCount: number;
  }>;
  total: number;
}

interface FacilityUtilisationReportProps {
  filters: {
    from: string;
    to: string;
    facilityId?: string;
  };
  onDataLoaded?: (data: any[]) => void;
}

export const FacilityUtilisationReport: React.FC<FacilityUtilisationReportProps> = ({
  filters,
  onDataLoaded,
}) => {
  const [data, setData] = useState<FacilityUtilisationData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('day');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const query = new URLSearchParams({
          from: filters.from,
          to: filters.to,
          period,
          ...(filters.facilityId && { facilityId: filters.facilityId }),
        });

        const response = await fetch(`/api/clinical/reports/facility-utilisation?${query}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch facility utilisation data');
        }

        const result = await response.json();
        if (result.success) {
          setData(result.data || []);
          onDataLoaded?.(result.data || []);
        } else {
          setError(result.error || 'Failed to load data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filters, period, onDataLoaded]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 text-center py-6">{error}</div>;
  }

  if (!data || data.length === 0) {
    return <div className="text-gray-500 text-center py-6">No facility utilisation data available for the selected period</div>;
  }

  // Prepare aggregated data for chart (sum of all facilities)
  const aggregatedByPeriod = new Map<string, number>();

  data.forEach((facility) => {
    facility.dates.forEach((dateEntry) => {
      const existing = aggregatedByPeriod.get(dateEntry.period) || 0;
      aggregatedByPeriod.set(dateEntry.period, existing + dateEntry.visitCount);
    });
  });

  const chartData = Array.from(aggregatedByPeriod.entries())
    .sort(([periodA], [periodB]) => periodA.localeCompare(periodB))
    .map(([period, visitCount]) => ({
      period,
      visits: visitCount,
    }));

  return (
    <div>
      {/* Period Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Time Period</label>
        <div className="flex gap-2">
          {['day', 'week', 'month'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="period" stroke="#6b7280" style={{ fontSize: '12px' }} />
            <YAxis
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              label={{ value: 'ANC Visits', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
              }}
              formatter={(value: any) => [value, 'Visits']}
            />
            <Line
              type="monotone"
              dataKey="visits"
              stroke="#10b981"
              strokeWidth={2}
              dot={true}
              isAnimationActive={true}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 border border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Facility</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">Total Visits</th>
            </tr>
          </thead>
          <tbody>
            {data.map((facility) => (
              <tr key={facility.facilityId} className="border border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900 font-medium">{facility.facility}</td>
                <td className="px-4 py-3 text-right text-gray-900 font-semibold">{facility.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
