'use client';

import React, { useState } from 'react';
import { X, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { SelectDropdown, Textarea } from './FormInputs';
import { Referral } from '@/types';

interface UpdateStatusModalProps {
  isOpen: boolean;
  referral: Referral | null;
  onClose: () => void;
  onSuccess: (updatedReferral: Referral) => void;
}

const VALID_STATUSES = ['PENDING', 'ACCEPTED', 'COMPLETED', 'DECLINED'];

const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['ACCEPTED', 'DECLINED'],
  ACCEPTED: ['COMPLETED', 'PENDING'],
  COMPLETED: [],
  DECLINED: ['PENDING'],
};

export default function UpdateStatusModal({
  isOpen,
  referral,
  onClose,
  onSuccess,
}: UpdateStatusModalProps) {
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleOpen = () => {
    if (referral) {
      setNewStatus('');
      setStatusNotes(referral.statusNotes || '');
      setErrorMessage('');
      setSuccessMessage('');
    }
  };

  const handleClose = () => {
    setNewStatus('');
    setStatusNotes('');
    setErrorMessage('');
    setSuccessMessage('');
    onClose();
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setNewStatus(e.target.value);
    setErrorMessage('');
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setStatusNotes(e.target.value);
  };

  const handleSubmit = async () => {
    if (!referral) return;

    if (!newStatus) {
      setErrorMessage('Please select a new status');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage('');
      setSuccessMessage('');

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/referrals/${referral.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          statusNotes: statusNotes || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update referral status');
      }

      setSuccessMessage('Referral status updated successfully!');
      onSuccess(result.data);

      // Close modal after success
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      console.error('Error updating referral status:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update status');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !referral) return null;

  const availableStatuses = STATUS_TRANSITIONS[referral.status] || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-lg font-bold text-neutral-900">Update Referral Status</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Referral Info */}
          <div className="bg-neutral-50 rounded-lg p-4 space-y-2 text-sm">
            <div>
              <p className="text-neutral-600 text-xs font-medium">Mother</p>
              <p className="text-neutral-900 font-semibold">{referral.mother.fullName}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-neutral-600 text-xs font-medium">From</p>
                <p className="text-neutral-900 font-semibold text-xs">
                  {referral.fromFacility.name}
                </p>
              </div>
              <div>
                <p className="text-neutral-600 text-xs font-medium">To</p>
                <p className="text-neutral-900 font-semibold text-xs">{referral.toFacility.name}</p>
              </div>
            </div>
            <div>
              <p className="text-neutral-600 text-xs font-medium">Current Status</p>
              <p className="text-neutral-900 font-semibold">{referral.status}</p>
            </div>
          </div>

          {/* Error/Success Messages */}
          {errorMessage && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={16} />
              <span className="text-red-700 text-sm">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
              <span className="text-green-700 text-sm">{successMessage}</span>
            </div>
          )}

          {/* Status Selection */}
          <SelectDropdown
            label="New Status"
            name="newStatus"
            value={newStatus}
            onChange={handleStatusChange}
            options={availableStatuses.map((status) => ({
              value: status,
              label: status,
            }))}
            placeholder={
              availableStatuses.length === 0
                ? 'No status transitions available'
                : 'Select new status'
            }
            disabled={availableStatuses.length === 0 || isLoading}
            required
          />

          {/* Status Notes */}
          <Textarea
            label="Status Notes (Optional)"
            name="statusNotes"
            value={statusNotes}
            onChange={handleNotesChange}
            placeholder="Add any notes related to this status change..."
            rows={3}
            disabled={isLoading}
          />
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-neutral-200">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg text-neutral-700 font-medium hover:bg-neutral-50 transition-colors disabled:opacity-50"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            disabled={isLoading || availableStatuses.length === 0 || !newStatus}
          >
            {isLoading && <Loader size={16} className="animate-spin" />}
            {isLoading ? 'Updating...' : 'Update Status'}
          </button>
        </div>
      </div>
    </div>
  );
}
