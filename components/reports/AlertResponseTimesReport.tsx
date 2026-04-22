'use client';

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatHours } from '@/lib/reports';

interface AlertResponseData {
  type: string;
  count: number;
  avgResponseHours: number;
  minResponseHours: number;
  maxResponseHours: number;
  dates: Array<{
    date: string;
    avgResponse: number;
    count: number;
  }>;
}

interface AlertResponseTimesReportProps {
  filters: {
    from: string;
    to: string;
    facilityId?: string;
  };
  onDataLoaded?: (data: any[]) => void;
}

export const AlertResponseTimesReport: React.FC<AlertResponseTimesReportProps> = ({
  filters,
  onDataLoaded,
}) => {
  const [data, setData] = useState<AlertResponseData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const query = new URLSearchParams({
          from: filters.from,
          to: filters.to,
          ...(filters.facilityId && { facilityId: filters.facilityId }),
        });

        const response = await fetch(`/api/clinical/reports/alert-response-times?${query}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch alert response times data');
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
  }, [filters, onDataLoaded]);

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
    return <div className="text-gray-500 text-center py-6">No alert data available for the selected period</div>;
  }

  // Prepare data for chart
  const chartData = data.map((alert) => ({
    name: alert.type.replace(/_/g, ' '),
    avgHours: Math.round(alert.avgResponseHours * 100) / 100,
    count: alert.count,
  }));

  return (
    <div>
      {/* Chart */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              label={{ value: 'Response Time (hours)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
              }}
              formatter={(value: any) => [formatHours(value), 'Avg Response']}
            />
            <Bar dataKey="avgHours" fill="#3b82f6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 border border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Alert Type</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">Count</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">Avg Response</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">Min Response</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">Max Response</th>
            </tr>
          </thead>
          <tbody>
            {data.map((alert, idx) => (
              <tr key={idx} className="border border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900 font-medium">{alert.type.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-right text-gray-700">{alert.count}</td>
                <td className="px-4 py-3 text-right text-gray-900 font-semibold">
                  {formatHours(alert.avgResponseHours)}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">{formatHours(alert.minResponseHours)}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatHours(alert.maxResponseHours)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
