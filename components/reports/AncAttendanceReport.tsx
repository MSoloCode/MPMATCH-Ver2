'use client';

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AncAttendanceData {
  facility: string;
  facilityId: number;
  visitCount: number;
  motherCount: number;
  attendancePercentage: number;
  dates: Array<{
    date: string;
    visits: number;
  }>;
}

interface AncAttendanceReportProps {
  filters: {
    from: string;
    to: string;
    facilityId?: string;
  };
  onDataLoaded?: (data: any[]) => void;
}

export const AncAttendanceReport: React.FC<AncAttendanceReportProps> = ({ filters, onDataLoaded }) => {
  const [data, setData] = useState<AncAttendanceData[]>([]);
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

        const response = await fetch(`/api/clinical/reports/anc-attendance?${query}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch ANC attendance data');
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
    return <div className="text-gray-500 text-center py-6">No data available for the selected period</div>;
  }

  // Prepare data for chart
  const chartData = data.map((facility) => ({
    name: facility.facility,
    percentage: Math.round(facility.attendancePercentage * 100) / 100,
    visits: facility.visitCount,
    mothers: facility.motherCount,
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
              label={{ value: 'Attendance %', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
              }}
              formatter={(value: any) => [`${value}%`, 'Attendance']}
            />
            <Bar dataKey="percentage" fill="#10b981" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 border border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Facility</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">Visits</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">Mothers</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">Attendance %</th>
            </tr>
          </thead>
          <tbody>
            {data.map((facility, idx) => (
              <tr key={idx} className="border border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900">{facility.facility}</td>
                <td className="px-4 py-3 text-right text-gray-700">{facility.visitCount}</td>
                <td className="px-4 py-3 text-right text-gray-700">{facility.motherCount}</td>
                <td className="px-4 py-3 text-right text-gray-900 font-semibold">
                  {Math.round(facility.attendancePercentage * 100) / 100}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
