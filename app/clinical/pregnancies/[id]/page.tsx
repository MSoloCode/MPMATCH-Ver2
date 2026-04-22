'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { RoleGuard } from '@/components/RoleGuard';
import { PregnancyDetailHeader } from './PregnancyDetailHeader';
import { PregnancySummary } from './PregnancySummary';
import { RiskFactorsSection } from './RiskFactorsSection';
import { PastObstetricHistoryTable } from './PastObstetricHistoryTable';
import { AncVisitsSection } from './AncVisitsSection';
import { VitalsTimelineChart } from './VitalsTimelineChart';
import { SymptomsLogTable } from './SymptomsLogTable';
import { ClinicalArchiveSection } from './ClinicalArchiveSection';

interface Vital {
  id: number;
  systolicBP?: number;
  diastolicBP?: number;
  bpNotTaken?: boolean;
  temperatureC?: number;
  weightKg?: number;
  pulseBpm?: number;
  respRate?: number;
  oxygenSatPct?: number;
  createdAt: string;
}

interface Symptom {
  id: number;
  bleeding: boolean;
  severeHeadache: boolean;
  blurredVision: boolean;
  swelling: boolean;
  fever: boolean;
  abdominalPain: boolean;
  reducedFetalMovement: boolean;
  other?: string;
  createdAt: string;
}

interface AncVisit {
  id: number;
  visitNumber: number;
  visitType: string;
  purposeOther?: string;
  visitDateTime: string;
  nextAppointment?: string;
  notes?: string;
  createdAt: string;
  vitals: Vital[];
  symptoms: Symptom[];
}

interface ObstetricHistory {
  id: number;
  year: number;
  outcome: string;
  deliveryMode?: string;
  complications?: string[];
  createdAt: string;
}

interface ClinicalArchive {
  id: number;
  type: 'TEST_RESULT' | 'IMAGING' | 'MEDICATION' | 'PROCEDURE' | 'OTHER';
  title: string;
  datePerformed: string | null;
  notes: string | null;
  fileUrl: string;
  uploadedById: number;
  createdAt: string;
  uploadedBy?: {
    id: number;
    name: string;
  };
}

interface PregnancyDetail {
  id: number;
  motherId: number;
  lmpDate: string;
  edd: string;
  gravida: number;
  parity: number;
  multiplePregnancy: string;
  riskFactors: string[];
  isHighRisk: boolean;
  antenatalStatus: string;
  status: 'ACTIVE' | 'CLOSED' | 'DELIVERED';
  deliveryDate?: string;
  deliveryOutcome?: string;
  deliveryMode?: string;
  babyWeightKg?: number;
  complications?: string[];
  ancCardUrl?: string;
  createdAt: string;
  updatedAt: string;
  mother?: {
    id: number;
    fullName: string;
    phone: string;
    village?: string;
    facility?: {
      id: number;
      name: string;
      districtId: number;
    };
  };
  ancVisits: AncVisit[];
  obstetricHistory: ObstetricHistory[];
  clinicalArchives: ClinicalArchive[];
}

export default function PregnancyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { token } = useAuth();
  const pregnancyId = params.id as string;

  const [pregnancy, setPregnancy] = useState<PregnancyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const fetchPregnancy = async () => {
      if (!pregnancyId || !token) return;

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/pregnancies/${pregnancyId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch pregnancy details');
        }

        const result = await response.json();
        if (result.success) {
          setPregnancy(result.data);
        } else {
          throw new Error(result.error || 'Failed to load pregnancy');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPregnancy();
  }, [pregnancyId, token]);

  const calculateGestationalAge = (lmpDate: string): number => {
    const lmp = new Date(lmpDate);
    const today = new Date();
    const weekInMs = 7 * 24 * 60 * 60 * 1000;
    return Math.floor((today.getTime() - lmp.getTime()) / weekInMs);
  };

  const handleAddAncVisit = () => {
    // TODO: Navigate to add ANC visit form or open modal
    router.push(`/clinical/pregnancies/${pregnancyId}/add-visit`);
  };

  const handleClosePregnancy = () => {
    // This is called after successful closure
    if (pregnancy) {
      setPregnancy({ ...pregnancy, status: 'CLOSED' });
    }
  };

  const handleFlagHighRisk = async (isFlagged: boolean) => {
    if (!token || !pregnancy) return;

    try {
      setIsUpdating(true);
      const response = await fetch(`/api/pregnancies/${pregnancyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isHighRisk: isFlagged,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update high-risk flag');
      }

      const result = await response.json();
      if (result.success) {
        setPregnancy(result.data);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateStatus = async (newStatus: 'ACTIVE' | 'CLOSED' | 'DELIVERED') => {
    if (!token || !pregnancy) return;

    try {
      setIsUpdating(true);
      const response = await fetch(`/api/pregnancies/${pregnancyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      const result = await response.json();
      if (result.success) {
        setPregnancy(result.data);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUploadArchive = async (file: File, data: any) => {
    if (!token) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('pregnancyId', pregnancyId);
      formData.append('motherId', pregnancy?.motherId.toString() || '');
      formData.append('title', data.title);
      formData.append('type', data.type);
      formData.append('datePerformed', data.datePerformed);
      formData.append('notes', data.notes);

      const response = await fetch('/api/clinical-archives', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload archive');
      }

      // Refresh pregnancy data to get updated archives
      const refreshResponse = await fetch(`/api/pregnancies/${pregnancyId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await refreshResponse.json();
      if (result.success) {
        setPregnancy(result.data);
      }
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const handleDeleteArchive = async (archiveId: number) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/clinical-archives/${archiveId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete archive');
      }

      // Remove from local state
      if (pregnancy) {
        setPregnancy({
          ...pregnancy,
          clinicalArchives: pregnancy.clinicalArchives.filter(a => a.id !== archiveId),
        });
      }
    } catch (error) {
      console.error('Delete error:', error);
      throw error;
    }
  }

  if (isLoading) {
    return (
      <RoleGuard requiredRole="DOCTOR|NURSE|MIDWIFE">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading pregnancy details...</p>
          </div>
        </div>
      </RoleGuard>
    );
  }

  if (error || !pregnancy) {
    return (
      <RoleGuard requiredRole="DOCTOR|NURSE|MIDWIFE">
        <div className="space-y-6">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back
          </button>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
            <h3 className="font-semibold mb-2">Error Loading Pregnancy</h3>
            <p>{error || 'Pregnancy not found'}</p>
            <button
              onClick={() => router.push('/clinical/pregnancies')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
            >
              Back to Pregnancies
            </button>
          </div>
        </div>
      </RoleGuard>
    );
  }

  const gestationalAge = calculateGestationalAge(pregnancy.lmpDate);

  return (
    <RoleGuard requiredRole="DOCTOR|NURSE|MIDWIFE">
      <div className="space-y-6">
        {/* Header */}
        <PregnancyDetailHeader
          motherName={pregnancy.mother?.fullName || 'Unknown Mother'}
          pregnancyId={pregnancy.id}
          status={pregnancy.status}
          isHighRisk={pregnancy.isHighRisk}
          onAddAncVisit={handleAddAncVisit}
          onClosePregnancy={handleClosePregnancy}
          onFlagHighRisk={handleFlagHighRisk}
          onUpdateStatus={handleUpdateStatus}
        />

        {/* Summary */}
        <PregnancySummary
          lmpDate={pregnancy.lmpDate}
          edd={pregnancy.edd}
          gestationalAgeWeeks={gestationalAge}
          gravida={pregnancy.gravida}
          parity={pregnancy.parity}
          multiplePregnancy={pregnancy.multiplePregnancy}
          antenatalStatus={pregnancy.antenatalStatus}
          ancCardUrl={pregnancy.ancCardUrl}
        />

        {/* Risk Factors */}
        {pregnancy.riskFactors && pregnancy.riskFactors.length > 0 && (
          <RiskFactorsSection riskFactors={pregnancy.riskFactors} />
        )}

        {/* Past Obstetric History */}
        {pregnancy.obstetricHistory && pregnancy.obstetricHistory.length > 0 && (
          <PastObstetricHistoryTable history={pregnancy.obstetricHistory} />
        )}

        {/* ANC Visits */}
        {pregnancy.ancVisits && (
          <AncVisitsSection visits={pregnancy.ancVisits} onAddVisit={handleAddAncVisit} />
        )}

        {/* Vitals Timeline */}
        {pregnancy.ancVisits && pregnancy.ancVisits.length > 0 && (
          <VitalsTimelineChart visits={pregnancy.ancVisits} />
        )}

        {/* Symptoms Log */}
        {pregnancy.ancVisits && pregnancy.ancVisits.length > 0 && (
          <SymptomsLogTable visits={pregnancy.ancVisits} />
        )}

        {/* Clinical Archives */}
        {pregnancy.clinicalArchives !== undefined && (
          <ClinicalArchiveSection
            archives={pregnancy.clinicalArchives}
            pregnancyId={pregnancy.id}
            motherId={pregnancy.motherId}
            onUpload={handleUploadArchive}
            onDelete={handleDeleteArchive}
          />
        )}
      </div>
    </RoleGuard>
  );
}
