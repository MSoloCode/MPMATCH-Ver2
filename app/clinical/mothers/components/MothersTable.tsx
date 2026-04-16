'use client';

import { Info, Bell, Pencil, Trash2 } from 'lucide-react';
import { Mother } from '../hooks/useMothersList';
import {
  formatCreatedDate,
  getConsentDisplay,
  getFacilityDisplay,
  getDistrictDisplay,
  getRegisteredByDisplay,
} from '../utils/formatting';

interface MothersTableProps {
  mothers: Mother[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  rowsPerPage: number;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onGoToPage: (page: number) => void;
  canEdit: boolean; // Whether user can edit/delete
  onInfo: (mother: Mother) => void;
  onAlert: (mother: Mother) => void;
  onEdit: (mother: Mother) => void;
  onDelete: (mother: Mother) => void;
}

export function MothersTable({
  mothers,
  isLoading,
  currentPage,
  totalPages,
  totalCount,
  rowsPerPage,
  onNextPage,
  onPreviousPage,
  onGoToPage,
  canEdit,
  onInfo,
  onAlert,
  onEdit,
  onDelete,
}: MothersTableProps) {
  const startIndex = (currentPage - 1) * rowsPerPage + 1;
  const endIndex = Math.min(currentPage * rowsPerPage, totalCount);

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-x-auto border border-gray-300 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b border-gray-300">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Phone</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Consent</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Village</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">District</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Facility</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Created by</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Created</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  Loading mothers...
                </td>
              </tr>
            ) : mothers.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  No mothers found
                </td>
              </tr>
            ) : (
              mothers.map((mother) => (
                <tr key={mother.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{mother.fullName}</td>
                  <td className="px-4 py-3 text-gray-900">{mother.phone}</td>
                  <td className="px-4 py-3 text-gray-900">
                    {getConsentDisplay(mother.consentAccepted)}
                  </td>
                  <td className="px-4 py-3 text-gray-900">{mother.village || '---'}</td>
                  <td className="px-4 py-3 text-gray-900">
                    {getDistrictDisplay(mother.district)}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {getFacilityDisplay(mother.facility)}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {getRegisteredByDisplay(mother.registeredBy)}
                  </td>
                  <td className="px-4 py-3 text-gray-900">{formatCreatedDate(mother.createdAt)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => onInfo(mother)}
                        title="View info"
                        disabled={isLoading}
                        className="p-1 rounded hover:bg-blue-100 text-blue-600 disabled:text-gray-300"
                      >
                        <Info className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => onAlert(mother)}
                        title="Send alert"
                        disabled={isLoading}
                        className="p-1 rounded hover:bg-orange-100 text-orange-600 disabled:text-gray-300"
                      >
                        <Bell className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => onEdit(mother)}
                        title="Edit"
                        disabled={isLoading || !canEdit}
                        className="p-1 rounded hover:bg-green-100 text-green-600 disabled:text-gray-300"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => onDelete(mother)}
                        title="Delete"
                        disabled={isLoading || !canEdit}
                        className="p-1 rounded hover:bg-red-100 text-red-600 disabled:text-gray-300"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
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
            Showing {startIndex} to {endIndex} of {totalCount} mothers
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
