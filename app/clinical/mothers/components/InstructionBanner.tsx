'use client';

import { Info } from 'lucide-react';

export function InstructionBanner() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
      <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-blue-900">
        <p className="font-medium">Actions — Select a mother row and click the edit icon.</p>
        <p>Then you can open a pregnancy episode and capture ANC visits, vitals, and symptoms.</p>
      </div>
    </div>
  );
}
