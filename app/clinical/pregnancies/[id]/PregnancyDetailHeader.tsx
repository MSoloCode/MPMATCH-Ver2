'use client';

import { useState } from 'react';
import { AlertCircle, Plus, Flag, X } from 'lucide-react';

interface PregnancyDetailHeaderProps {
  motherName: string;
  pregnancyId: number;
  status: 'ACTIVE' | 'CLOSED' | 'DELIVERED';
  isHighRisk: boolean;
  onAddAncVisit: () => void;
  onClosePregnancy: () => void;
  onFlagHighRisk: (flag: boolean) => Promise<void>;
  onUpdateStatus: (status: 'ACTIVE' | 'CLOSED' | 'DELIVERED') => Promise<void>;
}

export function PregnancyDetailHeader({
  motherName,
  pregnancyId,
  status,
  isHighRisk,
  onAddAncVisit,
  onClosePregnancy,
  onFlagHighRisk,
  onUpdateStatus,
}: PregnancyDetailHeaderProps) {
  const [isUpdatingHighRisk, setIsUpdatingHighRisk] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const statusColorMap = {
    ACTIVE: 'bg-blue-100 text-blue-800',
    CLOSED: 'bg-gray-100 text-gray-800',
    DELIVERED: 'bg-green-100 text-green-800',
  };

  const handleFlagHighRisk = async () => {
    try {
      setIsUpdatingHighRisk(true);
      await onFlagHighRisk(!isHighRisk);
    } catch (error) {
      console.error('Failed to update high-risk flag:', error);
    } finally {
      setIsUpdatingHighRisk(false);
    }
  };

  const handleClosePregnancy = async () => {
    try {
      setIsClosing(true);
      await onUpdateStatus('CLOSED');
      setShowCloseConfirm(false);
      onClosePregnancy();
    } catch (error) {
      console.error('Failed to close pregnancy:', error);
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-start justify-between">
        {/* Left side: Title and Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">{motherName}</h1>
            <span className="text-sm font-medium text-gray-500">ID: {pregnancyId}</span>
          </div>

          {/* Status and Risk Badges */}
          <div className="flex items-center gap-3 mt-4">
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColorMap[status]}`}
            >
              {status}
            </span>

            {isHighRisk && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-800 text-sm font-semibold">
                <AlertCircle size={16} />
                High Risk
              </span>
            )}
          </div>
        </div>

        {/* Right side: Action Buttons */}
        <div className="flex flex-col gap-2 ml-6">
          <button
            onClick={onAddAncVisit}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            Add ANC Visit
          </button>

          <button
            onClick={handleFlagHighRisk}
            disabled={isUpdatingHighRisk}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isHighRisk
                ? 'bg-red-100 text-red-800 hover:bg-red-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${isUpdatingHighRisk ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Flag size={18} />
            {isHighRisk ? 'Unflag High Risk' : 'Flag High Risk'}
          </button>

          {status === 'ACTIVE' && (
            <>
              <button
                onClick={() => setShowCloseConfirm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                <X size={18} />
                Close Pregnancy
              </button>

              {/* Close Confirmation Modal */}
              {showCloseConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg shadow-lg p-6 max-w-md">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Close Pregnancy?</h3>
                    <p className="text-gray-600 mb-6">
                      Are you sure you want to close this pregnancy? This action can be undone later.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowCloseConfirm(false)}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleClosePregnancy}
                        disabled={isClosing}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {isClosing ? 'Closing...' : 'Close Pregnancy'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
