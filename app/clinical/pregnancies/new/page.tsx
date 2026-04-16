'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/RoleGuard';
import OpenPregnancyModal from '@/components/OpenPregnancyModal';

export default function NewPregnancyPage() {
  const router = useRouter();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleSuccess = (pregnancyId: number) => {
    setToast({
      message: 'Pregnancy created successfully!',
      type: 'success',
    });

    // Redirect to pregnancy detail page after a short delay
    setTimeout(() => {
      router.push(`/clinical/pregnancies/${pregnancyId}`);
    }, 1500);
  };

  const handleClose = () => {
    // Navigate back to pregnancies list
    router.push('/clinical/pregnancies');
  };

  return (
    <RoleGuard requiredRole="DOCTOR|NURSE|MIDWIFE">
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Open New Pregnancy</h1>
          <p className="text-gray-600 mt-1">Register a new pregnancy episode for a mother</p>
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

        {/* Modal - Always Open on this page */}
        <OpenPregnancyModal
          isOpen={true}
          onClose={handleClose}
          onSuccess={handleSuccess}
        />
      </div>
    </RoleGuard>
  );
}
