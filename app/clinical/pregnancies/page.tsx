'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { RoleGuard } from '@/components/RoleGuard';
import { PregnanciesFilters } from './components/PregnanciesFilters';
import { PregnanciesTable } from './components/PregnanciesTable';
import { usePregnanciesList, type UsePregnanciesListOptions } from './hooks/usePregnanciesList';

export default function PregnanciesPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [filterOptions, setFilterOptions] = useState<UsePregnanciesListOptions>({});

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch pregnancies list
  const {
    pregnancies,
    isLoading,
    error,
    currentPage,
    totalPages,
    totalCount,
    rowsPerPage,
    goToPage,
    nextPage,
    previousPage,
  } = usePregnanciesList(filterOptions);

  // Handler functions
  const handleMotherChange = useCallback((motherId: number | null) => {
    setFilterOptions((prev) => ({
      ...prev,
      motherId: motherId,
    }));
  }, []);

  const handleOpenPregnancy = () => {
    router.push('/clinical/pregnancies/new');
  };

  return (
    <RoleGuard requiredRole="DOCTOR|NURSE|MIDWIFE">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pregnancies</h1>
            <p className="text-gray-600 mt-1">Track and manage pregnancies</p>
          </div>
          <button
            onClick={handleOpenPregnancy}
            className="px-6 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Open pregnancy
          </button>
        </div>

        {/* Toast Notifications */}
        {toast && (
          <div
            className={`p-4 rounded-lg ${
              toast.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {toast.message}
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-white rounded-lg shadow p-4">
          <PregnanciesFilters onMotherChange={handleMotherChange} isLoading={isLoading} />
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            <p className="font-medium">{error}</p>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg shadow">
          <PregnanciesTable
            pregnancies={pregnancies}
            isLoading={isLoading}
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            rowsPerPage={rowsPerPage}
            onNextPage={nextPage}
            onPreviousPage={previousPage}
            onGoToPage={goToPage}
          />
        </div>
      </div>
    </RoleGuard>
  );
}
