'use client';

import React, { useState, useEffect } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import AncVisitForm from '@/components/AncVisitForm';
import RecentAncVisitsTable from '@/components/RecentAncVisitsTable';
import AncVisitWorkflowBreadcrumb from '@/components/AncVisitWorkflowBreadcrumb';

interface AncVisit {
  id: number;
  visitNumber: number;
  visitType: string;
  visitDateTime: string;
  nextAppointment?: string | null;
  notes?: string | null;
  mother: {
    id: number;
    fullName: string;
  };
  createdBy: {
    id: number;
    name: string;
    role: string;
  };
}

export default function NurseAncVisitsPage() {
  const [visits, setVisits] = useState<AncVisit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [highlightedVisitId, setHighlightedVisitId] = useState<number | null>(null);

  // Fetch recent visits
  const fetchVisits = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/ancvisits?skip=0&take=20', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch visits');
      const data = await response.json();
      setVisits(data.data || []);
    } catch (error) {
      console.error('Error fetching visits:', error);
      setVisits([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVisits();
  }, []);

  const handleFormSuccess = (visitId: number) => {
    // Refresh visits and highlight the new one
    setHighlightedVisitId(visitId);
    fetchVisits();

    // Scroll to table after a short delay
    setTimeout(() => {
      const tableElement = document.getElementById('recent-visits-table');
      if (tableElement) {
        tableElement.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <RoleGuard requiredRole="NURSE">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">ANC Visits</h1>
          <p className="text-gray-600 mt-1">Create and manage antenatal care visits</p>
        </div>

        {/* Workflow Breadcrumb */}
        <AncVisitWorkflowBreadcrumb role="nurse" />

        {/* Create Visit Form */}
        <AncVisitForm onSuccess={handleFormSuccess} />

        {/* Recent Visits Table */}
        <div id="recent-visits-table">
          <RecentAncVisitsTable visits={visits} isLoading={isLoading} highlightedVisitId={highlightedVisitId} />
        </div>
      </div>
    </RoleGuard>
  );
}
