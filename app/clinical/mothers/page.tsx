'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { RoleGuard } from '@/components/RoleGuard';
import OpenPregnancyModal from '@/components/OpenPregnancyModal';
import { InstructionBanner } from './components/InstructionBanner';
import { MothersFilters } from './components/MothersFilters';
import { MothersTable } from './components/MothersTable';
import { MothersInfoDrawer } from './components/MothersInfoDrawer';
import { SendAlertModal } from './components/SendAlertModal';
import { MotherEditModal } from './components/MotherEditModal';
import { DeleteConfirmationDialog } from './components/DeleteConfirmationDialog';
import { RegisterMotherModal } from './components/RegisterMotherModal';
import { useMothersList, type Mother, type UseMotthersListOptions } from './hooks/useMothersList';

export default function MothersPage() {
  const { role, token } = useAuth();
  const [filterOptions, setFilterOptions] = useState<UseMotthersListOptions>({});
  
  // Modal states
  const [infoDrawerOpen, setInfoDrawerOpen] = useState(false);
  const [selectedMother, setSelectedMother] = useState<Mother | null>(null);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [pregnancyModalOpen, setPregnancyModalOpen] = useState(false);
  
  // Delete state
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch mothers list
  const {
    mothers,
    isLoading,
    error,
    currentPage,
    totalPages,
    totalCount,
    rowsPerPage,
    goToPage,
    nextPage,
    previousPage,
    refetch,
  } = useMothersList(filterOptions);

  // Check if user can perform actions (only HOSPITAL_ADMIN and SYSTEM_ADMIN)
  const canEdit = role === 'HOSPITAL_ADMIN' || role === 'SYSTEM_ADMIN';

  // Handler functions
  const handleSearchChange = useCallback((search: string) => {
    setFilterOptions((prev) => ({
      ...prev,
      searchQuery: search,
    }));
  }, []);

  const handleDistrictChange = useCallback((districtId: number | null) => {
    setFilterOptions((prev) => ({
      ...prev,
      districtFilter: districtId,
    }));
  }, []);

  const handleFacilityChange = useCallback((facilityId: number | null) => {
    setFilterOptions((prev) => ({
      ...prev,
      facilityFilter: facilityId,
    }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilterOptions({});
  }, []);

  const handleInfo = (mother: Mother) => {
    setSelectedMother(mother);
    setInfoDrawerOpen(true);
  };

  const handleAlert = (mother: Mother) => {
    setSelectedMother(mother);
    setAlertModalOpen(true);
  };

  const handleEdit = (mother: Mother) => {
    setSelectedMother(mother);
    setEditModalOpen(true);
  };

  const handleDelete = (mother: Mother) => {
    setSelectedMother(mother);
    setDeleteError(null);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedMother || !token) return;

    try {
      setIsDeleting(true);
      setDeleteError(null);

      const response = await fetch(`/api/mothers/${selectedMother.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete mother');
      }

      setDeleteDialogOpen(false);
      setSelectedMother(null);
      setToast({ message: 'Mother deleted successfully', type: 'success' });

      // Refetch the list
      setTimeout(() => {
        refetch();
      }, 500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      setDeleteError(errorMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditSave = (updatedMother: Mother) => {
    setEditModalOpen(false);
    setSelectedMother(null);
    setToast({ message: 'Mother updated successfully', type: 'success' });
    refetch();
  };

  const handleRegisterSuccess = () => {
    setRegisterModalOpen(false);
    setToast({ message: 'Mother registered successfully', type: 'success' });
    refetch();
  };

  const handleViewFullProfile = (mother: Mother) => {
    // TODO: Navigate to full profile page
    console.log('View full profile for:', mother);
    setInfoDrawerOpen(false);
  };

  const handleOpenPregnancy = (mother: Mother) => {
    setSelectedMother(mother);
    setPregnancyModalOpen(true);
    setInfoDrawerOpen(false);
  };

  const handlePregnancySuccess = (pregnancyId: number) => {
    setPregnancyModalOpen(false);
    setSelectedMother(null);
    setToast({ message: 'Pregnancy created successfully', type: 'success' });
  };

  return (
    <RoleGuard requiredRole="DOCTOR|NURSE|MIDWIFE">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mothers</h1>
            <p className="text-gray-600 mt-1">Manage and view registered mothers</p>
          </div>
          <button
            onClick={() => setRegisterModalOpen(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Register new mother
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

        {/* Instruction Banner */}
        <InstructionBanner />

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <MothersFilters
            onSearchChange={handleSearchChange}
            onDistrictChange={handleDistrictChange}
            onFacilityChange={handleFacilityChange}
            onClearFilters={handleClearFilters}
            isLoading={isLoading}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <MothersTable
            mothers={mothers}
            isLoading={isLoading}
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            rowsPerPage={rowsPerPage}
            onNextPage={nextPage}
            onPreviousPage={previousPage}
            onGoToPage={goToPage}
            canEdit={canEdit}
            onInfo={handleInfo}
            onAlert={handleAlert}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {/* Modals & Drawers */}
      <MothersInfoDrawer
        mother={selectedMother}
        isOpen={infoDrawerOpen}
        onClose={() => setInfoDrawerOpen(false)}
        onViewFullProfile={handleViewFullProfile}
        onOpenPregnancy={handleOpenPregnancy}
      />

      <SendAlertModal
        mother={selectedMother}
        isOpen={alertModalOpen}
        onClose={() => setAlertModalOpen(false)}
        token={token}
      />

      <MotherEditModal
        mother={selectedMother}
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={handleEditSave}
        token={token}
      />

      <DeleteConfirmationDialog
        mother={selectedMother}
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
        error={deleteError}
      />

      <RegisterMotherModal
        isOpen={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
        onSuccess={handleRegisterSuccess}
        token={token}
      />

      <OpenPregnancyModal
        isOpen={pregnancyModalOpen}
        onClose={() => setPregnancyModalOpen(false)}
        motherId={selectedMother?.id}
        onSuccess={handlePregnancySuccess}
      />
    </RoleGuard>
  );
}
