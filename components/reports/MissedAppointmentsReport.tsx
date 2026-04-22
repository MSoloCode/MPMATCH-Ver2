'use client';

import React, { useState, useEffect } from 'react';

interface MissedAppointmentData {
  motherId: number;
  motherName: string;
  phone: string;
  lastMissedDate: string;
  missedCount: number;
  dates: Array<{
    date: string;
    count: number;
  }>;
}

interface MissedAppointmentsReportProps {
  filters: {
    from: string;
    to: string;
    facilityId?: string;
  };
  onDataLoaded?: (data: any[]) => void;
}

export const MissedAppointmentsReport: React.FC<MissedAppointmentsReportProps> = ({
  filters,
  onDataLoaded,
}) => {
  const [data, setData] = useState<MissedAppointmentData[]>([]);
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

        const response = await fetch(`/api/clinical/reports/missed-appointments?${query}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch missed appointments data');
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
    return <div className="text-gray-500 text-center py-6">No missed appointments found in the selected period</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100 border border-gray-200">
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Mother Name</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Phone</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-900">Missed Count</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Last Missed Date</th>
          </tr>
        </thead>
        <tbody>
          {data.map((appointment) => (
            <tr key={appointment.motherId} className="border border-gray-200 hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-900 font-medium">{appointment.motherName}</td>
              <td className="px-4 py-3 text-gray-700">{appointment.phone}</td>
              <td className="px-4 py-3 text-right">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-red-100 text-red-800 rounded-full font-bold text-sm">
                  {appointment.missedCount}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-700">
                {appointment.lastMissedDate
                  ? new Date(appointment.lastMissedDate).toLocaleDateString()
                  : 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
