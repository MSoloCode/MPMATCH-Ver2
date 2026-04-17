'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface AncVisitWorkflowBreadcrumbProps {
  role: 'doctor' | 'nurse' | 'midwife';
}

export default function AncVisitWorkflowBreadcrumb({ role }: AncVisitWorkflowBreadcrumbProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <h3 className="text-sm font-semibold text-blue-900 mb-3">Workflow</h3>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {/* Step 1: Create Pregnancy */}
        <Link
          href={`/clinical/${role}/pregnancies`}
          className="inline-flex items-center gap-1 px-3 py-2 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 text-blue-700 font-medium transition-colors"
        >
          <span>Create a Pregnancy</span>
        </Link>

        <ChevronRight className="w-4 h-4 text-blue-600" />

        {/* Step 2: Create ANC Visit (Current) */}
        <div className="inline-flex items-center gap-1 px-3 py-2 bg-blue-100 border border-blue-300 rounded-lg text-blue-900 font-medium">
          <span className="w-5 h-5 inline-flex items-center justify-center bg-blue-600 text-white rounded-full text-xs font-bold">
            ✓
          </span>
          <span>Create an ANC Visit</span>
        </div>

        <ChevronRight className="w-4 h-4 text-blue-600" />

        {/* Step 3: Add Vitals and Symptoms */}
        <Link
          href={`/clinical/${role}/vitals`}
          className="inline-flex items-center gap-1 px-3 py-2 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 text-blue-700 font-medium transition-colors"
        >
          <span>Add Vitals & Symptoms</span>
        </Link>
      </div>
    </div>
  );
}
