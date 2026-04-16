'use client';

import { X } from 'lucide-react';
import { Mother } from '../hooks/useMothersList';
import { formatDate } from '../utils/formatting';

interface MothersInfoDrawerProps {
  mother: Mother | null;
  isOpen: boolean;
  onClose: () => void;
  onViewFullProfile: (mother: Mother) => void;
}

export function MothersInfoDrawer({
  mother,
  isOpen,
  onClose,
  onViewFullProfile,
}: MothersInfoDrawerProps) {
  if (!mother) return null;

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-96 bg-white shadow-lg transform transition-transform duration-300 z-50 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } overflow-y-auto`}
      >
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-gray-200 pb-4">
            <h2 className="text-xl font-bold text-gray-900">Mother Information</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Personal Information */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Personal Information
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Name</label>
                <p className="text-gray-900 font-medium">{mother.fullName}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Phone</label>
                <p className="text-gray-900">{mother.phone}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Date of Birth</label>
                <p className="text-gray-900">
                  {mother.dob ? formatDate(mother.dob) : '---'}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Village</label>
                <p className="text-gray-900">{mother.village || '---'}</p>
              </div>
            </div>
          </section>

          {/* Location Information */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Location
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">District</label>
                <p className="text-gray-900">{mother.district?.name || '---'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Facility</label>
                <p className="text-gray-900">{mother.facility?.name || '---'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Assigned CHW</label>
                <p className="text-gray-900">{mother.chw?.username || mother.chw?.name || '---'}</p>
              </div>
            </div>
          </section>

          {/* Consent Information */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Consent
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Status</label>
                <p className="text-gray-900 font-medium">
                  {mother.consentAccepted ? 'ACCEPTED' : 'NOT ACCEPTED'}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Date</label>
                <p className="text-gray-900">
                  {mother.consentDate ? formatDate(mother.consentDate) : '---'}
                </p>
              </div>
            </div>
          </section>

          {/* Registration Information */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Registration
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Registered By</label>
                <p className="text-gray-900">{mother.registeredBy?.username || '---'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Registration Date</label>
                <p className="text-gray-900">{formatDate(mother.createdAt)}</p>
              </div>
            </div>
          </section>

          {/* Clinical Information */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Clinical
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Number of Pregnancies</label>
                <p className="text-gray-900">{mother._count?.pregnancies || 0}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Open Alerts</label>
                <p className="text-gray-900">{mother._count?.alerts || 0}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Last ANC Visit</label>
                <p className="text-gray-900">---</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">High Risk Status</label>
                <p className="text-gray-900">---</p>
              </div>
            </div>
          </section>

          {/* View Full Profile Button */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={() => onViewFullProfile(mother)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              View full profile
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
