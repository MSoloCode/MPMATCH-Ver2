'use client';

import React, { useState, useEffect } from 'react';

interface Alert {
  id: number;
  type: string;
  status: string;
  createdAt: string;
}

interface HighRiskPregnancyData {
  pregnancyId: number;
  motherId: number;
  motherName: string;
  phone: string;
  lmpDate: string | null;
  edd: string | null;
  riskFactors: string[];
  lastAlertDate: string | null;
  alerts: Alert[];
}

interface HighRiskPregnanciesReportProps {
  filters: {
    from: string;
    to: string;
    facilityId?: string;
  };
  onDataLoaded?: (data: any[]) => void;
}

export const HighRiskPregnanciesReport: React.FC<HighRiskPregnanciesReportProps> = ({ filters, onDataLoaded }) => {
  const [data, setData] = useState<HighRiskPregnancyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const query = new URLSearchParams({
          from: filters.from,
          to: filters.to,
          page: String(page),
          pageSize: '50',
          ...(filters.facilityId && { facilityId: filters.facilityId }),
        });

        const response = await fetch(`/api/clinical/reports/high-risk-pregnancies?${query}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch high-risk pregnancy data');
        }

        const result = await response.json();
        if (result.success) {
          setData(result.data || []);
          setTotalPages(Math.ceil((result.total || 0) / 50));
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
  }, [filters, page, onDataLoaded]);

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
    return <div className="text-gray-500 text-center py-6">No high-risk pregnancies found in the selected period</div>;
  }

  return (
    <div>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 border border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Mother</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Phone</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">EDD</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Risk Factors</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Last Alert</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-900">Action</th>
            </tr>
          </thead>
          <tbody>
            {data.map((pregnancy) => (
              <React.Fragment key={pregnancy.pregnancyId}>
                <tr className="border border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{pregnancy.motherName}</td>
                  <td className="px-4 py-3 text-gray-700">{pregnancy.phone}</td>
                  <td className="px-4 py-3 text-gray-700">{pregnancy.edd || 'N/A'}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {pregnancy.riskFactors.length > 0 ? pregnancy.riskFactors.join(', ') : 'None'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {pregnancy.lastAlertDate ? new Date(pregnancy.lastAlertDate).toLocaleDateString() : 'None'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setExpandedId(expandedId === pregnancy.pregnancyId ? null : pregnancy.pregnancyId)}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                      {expandedId === pregnancy.pregnancyId ? 'Hide' : 'Details'}
                    </button>
                  </td>
                </tr>

                {/* Expanded row - Alert details */}
                {expandedId === pregnancy.pregnancyId && pregnancy.alerts.length > 0 && (
                  <tr className="bg-blue-50 border border-gray-200">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="text-sm">
                        <p className="font-semibold text-gray-900 mb-3">Recent Alerts:</p>
                        <div className="space-y-2">
                          {pregnancy.alerts.map((alert) => (
                            <div key={alert.id} className="bg-white p-2 rounded border border-gray-300">
                              <div className="flex justify-between">
                                <span className="font-medium text-gray-900">{alert.type}</span>
                                <span
                                  className={`text-xs px-2 py-1 rounded ${
                                    alert.status === 'CLOSED'
                                      ? 'bg-green-100 text-green-800'
                                      : alert.status === 'ACKNOWLEDGED'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {alert.status}
                                </span>
                              </div>
                              <p className="text-gray-600 text-xs mt-1">
                                Created: {new Date(alert.createdAt).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-6">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
