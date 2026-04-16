'use client';

import { AlertTriangle } from 'lucide-react';

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

interface AncVisitWithSymptoms {
  id: number;
  visitNumber: number;
  visitDateTime: string;
  symptoms: Symptom[];
}

interface SymptomsLogTableProps {
  visits: AncVisitWithSymptoms[];
}

const DANGER_SIGNS = ['bleeding', 'severeHeadache', 'blurredVision', 'reducedFetalMovement'];
const SYMPTOM_LABELS: Record<string, string> = {
  bleeding: 'Vaginal Bleeding',
  severeHeadache: 'Severe Headache',
  blurredVision: 'Blurred Vision',
  swelling: 'Swelling (Edema)',
  fever: 'Fever',
  abdominalPain: 'Abdominal Pain',
  reducedFetalMovement: 'Reduced Fetal Movement',
};

export function SymptomsLogTable({ visits }: SymptomsLogTableProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-UG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Flatten symptoms with visit info for easier table rendering
  const symptomsData = visits
    .flatMap(visit =>
      visit.symptoms.flatMap(symptom => ({
        visitId: visit.id,
        visitNumber: visit.visitNumber,
        visitDate: visit.visitDateTime,
        symptomId: symptom.id,
        ...symptom,
      }))
    )
    .filter(item => {
      // Only include rows where at least one symptom is true
      return (
        item.bleeding ||
        item.severeHeadache ||
        item.blurredVision ||
        item.swelling ||
        item.fever ||
        item.abdominalPain ||
        item.reducedFetalMovement ||
        item.other
      );
    });

  if (symptomsData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Symptoms Log</h2>
        <p className="text-gray-600">No symptoms recorded during ANC visits.</p>
      </div>
    );
  }

  // Group by visit for better readability
  const groupedByVisit = visits.filter(visit => {
    const hasSymptoms = visit.symptoms.some(s => 
      s.bleeding || s.severeHeadache || s.blurredVision || s.swelling || 
      s.fever || s.abdominalPain || s.reducedFetalMovement || s.other
    );
    return hasSymptoms;
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Symptoms Log</h2>

      <div className="space-y-6">
        {groupedByVisit.map(visit => {
          const symptomCount = visit.symptoms.filter(s => 
            s.bleeding || s.severeHeadache || s.blurredVision || s.swelling || 
            s.fever || s.abdominalPain || s.reducedFetalMovement || s.other
          ).length;

          if (symptomCount === 0) return null;

          return (
            <div key={visit.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-gray-900">Visit #{visit.visitNumber}</p>
                  <p className="text-sm text-gray-600">{formatDate(visit.visitDateTime)}</p>
                </div>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                  {symptomCount} symptom{symptomCount !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-2">
                {visit.symptoms.map(symptom => {
                  const recordedSymptoms = Object.entries({
                    bleeding: symptom.bleeding,
                    severeHeadache: symptom.severeHeadache,
                    blurredVision: symptom.blurredVision,
                    swelling: symptom.swelling,
                    fever: symptom.fever,
                    abdominalPain: symptom.abdominalPain,
                    reducedFetalMovement: symptom.reducedFetalMovement,
                  }).filter(([_, value]) => value);

                  if (recordedSymptoms.length === 0 && !symptom.other) return null;

                  return (
                    <div key={symptom.id}>
                      {recordedSymptoms.map(([key, _]) => {
                        const isDangerSign = DANGER_SIGNS.includes(key);
                        return (
                          <div
                            key={`${symptom.id}-${key}`}
                            className={`flex items-center gap-3 p-3 rounded-lg ${
                              isDangerSign
                                ? 'bg-red-50 border border-red-200'
                                : 'bg-yellow-50 border border-yellow-200'
                            }`}
                          >
                            {isDangerSign && <AlertTriangle size={18} className="text-red-600 flex-shrink-0" />}
                            <div className="flex-1">
                              <p className={`font-medium ${isDangerSign ? 'text-red-900' : 'text-yellow-900'}`}>
                                {SYMPTOM_LABELS[key]}
                              </p>
                              {isDangerSign && (
                                <p className="text-xs text-red-700 mt-1">⚠️ DANGER SIGN - Requires immediate attention</p>
                              )}
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              isDangerSign
                                ? 'bg-red-200 text-red-800'
                                : 'bg-yellow-200 text-yellow-800'
                            }`}>
                              {isDangerSign ? 'CRITICAL' : 'MODERATE'}
                            </span>
                          </div>
                        );
                      })}

                      {symptom.other && (
                        <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
                          <p className="font-medium text-gray-900">Other Notes:</p>
                          <p className="text-sm text-gray-700 mt-1">{symptom.other}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Danger Signs Legend */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle size={18} className="text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-900 text-sm">Danger Signs (Require immediate referral):</p>
            <p className="text-sm text-red-800 mt-1">
              Vaginal bleeding, Severe headache, Blurred vision, Reduced fetal movement
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
