'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { RoleGuard } from '@/components/RoleGuard';
import { ReportCard } from '@/components/ReportCard';
import { AncAttendanceReport } from '@/components/reports/AncAttendanceReport';
import { HighRiskPregnanciesReport } from '@/components/reports/HighRiskPregnanciesReport';
import { AlertResponseTimesReport } from '@/components/reports/AlertResponseTimesReport';
import { MissedAppointmentsReport } from '@/components/reports/MissedAppointmentsReport';
import { ChwActivityReport } from '@/components/reports/ChwActivityReport';
import { FacilityUtilisationReport } from '@/components/reports/FacilityUtilisationReport';
import { exportReportAsCSV } from '@/lib/reports';

interface Facility {
  id: number;
  name: string;
}

interface ReportState {
  ancAttendance: any[];
  highRiskPregnancies: any[];
  alertResponseTimes: any[];
  missedAppointments: any[];
  chwActivity: any[];
  facilityUtilisation: any[];
}

export default function ReportsPage() {
  const { isAuthenticated, isLoading, role, token } = useAuth();
  const router = useRouter();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [reportData, setReportData] = useState<ReportState>({
    ancAttendance: [],
    highRiskPregnancies: [],
    alertResponseTimes: [],
    missedAppointments: [],
    chwActivity: [],
    facilityUtilisation: [],
  });

  // Check authentication and role
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/sign-in');
    }
  }, [isAuthenticated, isLoading, router]);

  // Fetch user's facilities (optional - for future facility filtering)
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const fetchFacilities = async () => {
      try {
        const response = await fetch('/api/facilities', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setFacilities(result.data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch facilities:', error);
        // Continue without facility list - not critical
      }
    };

    fetchFacilities();
  }, [isAuthenticated, token]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full"></div>
        </div>
      </div>
    );
  }

  // Only allow clinical roles
  const allowedRoles = ['DOCTOR', 'MIDWIFE', 'NURSE', 'DHO', 'ORG_ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN'];
  if (role && !allowedRoles.includes(role)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You do not have permission to view reports.</p>
        </div>
      </div>
    );
  }

  return (
    <RoleGuard requiredRole={allowedRoles}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-full mx-auto px-6 py-8">
            <h1 className="text-3xl font-bold text-gray-900">Clinical Reports</h1>
            <p className="text-gray-600 mt-2">
              Comprehensive view of ANC attendance, pregnancies, alerts, appointments, and facility utilisation.
            </p>
          </div>
        </div>

        {/* Reports Container */}
        <div className="max-w-full mx-auto px-6 py-8">
          {/* ANC Attendance Report */}
          <ReportCard
            title="ANC Attendance"
            description="Percentage of mothers attending antenatal care on schedule per facility"
            reportKey="anc-attendance"
            facilities={facilities}
            exportData={reportData.ancAttendance}
            onExport={(filters, data) => {
              exportReportAsCSV('anc-attendance', filters, data);
            }}
          >
            {(filters) => (
              <AncAttendanceReport
                filters={filters}
                onDataLoaded={(data) => {
                  setReportData((prev) => ({ ...prev, ancAttendance: data }));
                }}
              />
            )}
          </ReportCard>

          {/* High-Risk Pregnancies Report */}
          <ReportCard
            title="High-Risk Pregnancies"
            description="All currently flagged high-risk pregnancies with recent alerts"
            reportKey="high-risk-pregnancies"
            facilities={facilities}
            exportData={reportData.highRiskPregnancies}
            onExport={(filters, data) => {
              exportReportAsCSV('high-risk-pregnancies', filters, data);
            }}
          >
            {(filters) => (
              <HighRiskPregnanciesReport
                filters={filters}
                onDataLoaded={(data) => {
                  setReportData((prev) => ({ ...prev, highRiskPregnancies: data }));
                }}
              />
            )}
          </ReportCard>

          {/* Alert Response Times Report */}
          <ReportCard
            title="Alert Response Times"
            description="Time from alert creation to closure, aggregated by alert type"
            reportKey="alert-response-times"
            facilities={facilities}
            exportData={reportData.alertResponseTimes}
            onExport={(filters, data) => {
              exportReportAsCSV('alert-response-times', filters, data);
            }}
          >
            {(filters) => (
              <AlertResponseTimesReport
                filters={filters}
                onDataLoaded={(data) => {
                  setReportData((prev) => ({ ...prev, alertResponseTimes: data }));
                }}
              />
            )}
          </ReportCard>

          {/* Missed Appointments Report */}
          <ReportCard
            title="Missed Appointments"
            description="Mothers who missed one or more appointments"
            reportKey="missed-appointments"
            facilities={facilities}
            exportData={reportData.missedAppointments}
            onExport={(filters, data) => {
              exportReportAsCSV('missed-appointments', filters, data);
            }}
          >
            {(filters) => (
              <MissedAppointmentsReport
                filters={filters}
                onDataLoaded={(data) => {
                  setReportData((prev) => ({ ...prev, missedAppointments: data }));
                }}
              />
            )}
          </ReportCard>

          {/* CHW Activity Report */}
          <ReportCard
            title="CHW Activity"
            description="Community health worker visit and appointment activity over time"
            reportKey="chw-activity"
            facilities={facilities}
            exportData={reportData.chwActivity}
            onExport={(filters, data) => {
              exportReportAsCSV('chw-activity', filters, data);
            }}
          >
            {(filters) => (
              <ChwActivityReport
                filters={filters}
                onDataLoaded={(data) => {
                  setReportData((prev) => ({ ...prev, chwActivity: data }));
                }}
              />
            )}
          </ReportCard>

          {/* Facility Utilisation Report */}
          <ReportCard
            title="Facility Utilisation"
            description="ANC visit counts per facility over time (by day, week, or month)"
            reportKey="facility-utilisation"
            facilities={facilities}
            exportData={reportData.facilityUtilisation}
            onExport={(filters, data) => {
              exportReportAsCSV('facility-utilisation', filters, data);
            }}
          >
            {(filters) => (
              <FacilityUtilisationReport
                filters={filters}
                onDataLoaded={(data) => {
                  setReportData((prev) => ({ ...prev, facilityUtilisation: data }));
                }}
              />
            )}
          </ReportCard>
        </div>
      </div>
    </RoleGuard>
  );
}
