'use client';

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ChwActivityData {
  chwId: number;
  chwName: string;
  chwPhone: string;
  dates: Array<{
    date: string;
    attended: number;
    scheduled: number;
    missed: number;
  }>;
  totals: {
    attended: number;
    scheduled: number;
    missed: number;
  };
}

interface ChwActivityReportProps {
  filters: {
    from: string;
    to: string;
    facilityId?: string;
  };
  onDataLoaded?: (data: any[]) => void;
}

export const ChwActivityReport: React.FC<ChwActivityReportProps> = ({ filters, onDataLoaded }) => {
  const [data, setData] = useState<ChwActivityData[]>([]);
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

        const response = await fetch(`/api/clinical/reports/chw-activity?${query}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch CHW activity data');
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
    return <div className="text-gray-500 text-center py-6">No CHW activity data available for the selected period</div>;
  }

  // Prepare aggregated data for chart (sum of all CHWs)
  const aggregatedByDate = new Map<
    string,
    { attended: number; scheduled: number; missed: number }
  >();

  data.forEach((chw) => {
    chw.dates.forEach((dateEntry) => {
      const existing = aggregatedByDate.get(dateEntry.date) || {
        attended: 0,
        scheduled: 0,
        missed: 0,
      };
      aggregatedByDate.set(dateEntry.date, {
        attended: existing.attended + dateEntry.attended,
        scheduled: existing.scheduled + dateEntry.scheduled,
        missed: existing.missed + dateEntry.missed,
      });
    });
  });

  const chartData = Array.from(aggregatedByDate.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, counts]) => ({
      date: date.split('-').slice(1).join('-'), // Show MM-DD format
      attended: counts.attended,
      scheduled: counts.scheduled,
      missed: counts.missed,
    }));

  return (
    <div>
      {/* Chart */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '12px' }} />
            <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
              }}
            />
            <Legend />
            <Bar dataKey="attended" fill="#10b981" stackId="a" />
            <Bar dataKey="scheduled" fill="#3b82f6" stackId="a" />
            <Bar dataKey="missed" fill="#ef4444" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 border border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-900">CHW Name</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Phone</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">Attended</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">Scheduled</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">Missed</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((chw) => {
              const total = chw.totals.attended + chw.totals.scheduled + chw.totals.missed;
              return (
                <tr key={chw.chwId} className="border border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 font-medium">{chw.chwName}</td>
                  <td className="px-4 py-3 text-gray-700">{chw.chwPhone || 'N/A'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center justify-center w-7 h-7 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                      {chw.totals.attended}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center justify-center w-7 h-7 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
                      {chw.totals.scheduled}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center justify-center w-7 h-7 bg-red-100 text-red-800 rounded-full text-xs font-bold">
                      {chw.totals.missed}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900 font-semibold">{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
