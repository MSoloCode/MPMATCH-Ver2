'use client';

import { useRouter } from 'next/navigation';
import { Pregnancy } from '../hooks/usePregnanciesList';
import {
  formatCreatedDate,
  getStatusDisplay,
  getStatusColor,
  getHighRiskDisplay,
  getHighRiskColor,
  getMotherDisplay,
} from '../utils/formatting';

interface PregnanciesTableProps {
  pregnancies: Pregnancy[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  rowsPerPage: number;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onGoToPage: (page: number) => void;
}

export function PregnanciesTable({
  pregnancies,
  isLoading,
  currentPage,
  totalPages,
  totalCount,
  rowsPerPage,
  onNextPage,
  onPreviousPage,
  onGoToPage,
}: PregnanciesTableProps) {
  const router = useRouter();
  const startIndex = (currentPage - 1) * rowsPerPage + 1;
  const endIndex = Math.min(currentPage * rowsPerPage, totalCount);

  const handleRowClick = (pregnancyId: number) => {
    router.push(`/clinical/pregnancies/${pregnancyId}`);
  };

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-x-auto border border-gray-300 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b border-gray-300">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">ID</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Mother</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">High risk</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Loading pregnancies...
                </td>
              </tr>
            ) : pregnancies.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No pregnancies found
                </td>
              </tr>
            ) : (
              pregnancies.map((pregnancy) => (
                <tr
                  key={pregnancy.id}
                  onClick={() => handleRowClick(pregnancy.id)}
                  className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3 text-gray-900 font-medium">{pregnancy.id}</td>
                  <td className="px-4 py-3 text-gray-900">{getMotherDisplay(pregnancy.mother)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                        pregnancy.status,
                      )}`}
                    >
                      {getStatusDisplay(pregnancy.status)}
                    </span>
                  </td>
                  <td className={`px-4 py-3 font-medium ${getHighRiskColor(pregnancy.isHighRisk)}`}>
                    {getHighRiskDisplay(pregnancy.isHighRisk)}
                  </td>
                  <td className="px-4 py-3 text-gray-900">{formatCreatedDate(pregnancy.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 0 && (
        <div className="flex items-center justify-between bg-white rounded-lg p-4 border border-gray-300">
          <div className="text-sm text-gray-600">
            Showing {startIndex} to {endIndex} of {totalCount} pregnancies
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onPreviousPage}
              disabled={currentPage === 1 || isLoading}
              className="px-3 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = currentPage > 3 ? currentPage - 2 + i : i + 1;
                if (pageNum > totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => onGoToPage(pageNum)}
                    disabled={isLoading}
                    className={`px-2 py-1 rounded text-sm font-medium ${
                      pageNum === currentPage
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 hover:bg-gray-50'
                    } disabled:text-gray-400`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={onNextPage}
              disabled={currentPage === totalPages || isLoading}
              className="px-3 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>

          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
        </div>
      )}
    </div>
  );
}
