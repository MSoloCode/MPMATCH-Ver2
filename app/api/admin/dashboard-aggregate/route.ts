import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-helpers';

interface AlertTrendDay {
  date: string; // MM-DD format
  count: number;
}

interface AppointmentTrendDay {
  date: string; // MM-DD format
  total: number;
  SCHEDULED: number;
  CONFIRMED: number;
  MISSED: number;
  CANCELLED: number;
  ATTENDED: number;
}

interface FacilityByDistrict {
  districtName: string;
  districtId: number;
  facilityCount: number;
  alertCount: number;
}

interface RecentAlert {
  id: number;
  type: string;
  status: string;
  createdAt: string;
  mother?: {
    id: number;
    fullName: string;
  } | null;
  pregnancy?: {
    id: number;
    isHighRisk: boolean;
  } | null;
}

interface DashboardAggregateResponse {
  success: boolean;
  data: {
    alertsTrendData: AlertTrendDay[];
    appointmentsTrendData: AppointmentTrendDay[];
    topFacilitiesByDistrict: FacilityByDistrict[];
    recentAlerts: RecentAlert[];
    timestamp: string;
  };
}

export async function GET(request: NextRequest): Promise<NextResponse<DashboardAggregateResponse>> {
  try {
    // Verify authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, data: { alertsTrendData: [], appointmentsTrendData: [], topFacilitiesByDistrict: [], recentAlerts: [], timestamp: new Date().toISOString() } },
        { status: 401 }
      );
    }

    // Get current date and calculate date ranges
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Alert trend: last 14 days
    const alertsTrendStart = new Date(today);
    alertsTrendStart.setDate(alertsTrendStart.getDate() - 13); // -13 to include today (14 days total)
    
    // Appointments trend: next 7 days
    const appointmentsTrendStart = new Date(today);
    const appointmentsTrendEnd = new Date(today);
    appointmentsTrendEnd.setDate(appointmentsTrendEnd.getDate() + 7);

    // Fetch all alerts in the 14-day range
    const alertsInRange = await db.alert.findMany({
      where: {
        createdAt: {
          gte: alertsTrendStart,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000), // Include today
        },
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    // Group alerts by date
    const alertsByDate = new Map<string, number>();
    alertsInRange.forEach((alert) => {
      const alertDate = new Date(alert.createdAt);
      const dateStr = `${String(alertDate.getMonth() + 1).padStart(2, '0')}-${String(alertDate.getDate()).padStart(2, '0')}`;
      alertsByDate.set(dateStr, (alertsByDate.get(dateStr) || 0) + 1);
    });

    // Build 14-day trend data
    const alertsTrendData: AlertTrendDay[] = [];
    const dateIterator = new Date(alertsTrendStart);
    for (let i = 0; i < 14; i++) {
      const dateStr = `${String(dateIterator.getMonth() + 1).padStart(2, '0')}-${String(dateIterator.getDate()).padStart(2, '0')}`;
      alertsTrendData.push({
        date: dateStr,
        count: alertsByDate.get(dateStr) || 0,
      });
      dateIterator.setDate(dateIterator.getDate() + 1);
    }

    // Fetch appointments in next 7 days
    const appointmentsInRange = await db.appointment.findMany({
      where: {
        appointmentDateTime: {
          gte: appointmentsTrendStart,
          lt: appointmentsTrendEnd,
        },
      },
      select: {
        id: true,
        appointmentDateTime: true,
        status: true,
      },
    });

    // Group appointments by date and status
    const appointmentsByDay = new Map<string, Map<string, number>>();
    appointmentsInRange.forEach((appt) => {
      const apptDate = new Date(appt.appointmentDateTime);
      const dateStr = `${String(apptDate.getMonth() + 1).padStart(2, '0')}-${String(apptDate.getDate()).padStart(2, '0')}`;
      
      if (!appointmentsByDay.has(dateStr)) {
        appointmentsByDay.set(dateStr, new Map());
      }
      
      const dayMap = appointmentsByDay.get(dateStr)!;
      const status = appt.status as string;
      dayMap.set(status, (dayMap.get(status) || 0) + 1);
    });

    // Build 7-day appointments trend data
    const appointmentsTrendData: AppointmentTrendDay[] = [];
    const apptIterator = new Date(appointmentsTrendStart);
    for (let i = 0; i < 7; i++) {
      const dateStr = `${String(apptIterator.getMonth() + 1).padStart(2, '0')}-${String(apptIterator.getDate()).padStart(2, '0')}`;
      const dayMap = appointmentsByDay.get(dateStr) || new Map();
      
      const statusCounts = {
        SCHEDULED: dayMap.get('SCHEDULED') || 0,
        CONFIRMED: dayMap.get('CONFIRMED') || 0,
        MISSED: dayMap.get('MISSED') || 0,
        CANCELLED: dayMap.get('CANCELLED') || 0,
        ATTENDED: dayMap.get('ATTENDED') || 0,
      };

      const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

      appointmentsTrendData.push({
        date: dateStr,
        total,
        ...statusCounts,
      });
      apptIterator.setDate(apptIterator.getDate() + 1);
    }

    // Fetch facilities by district with alert counts
    const facilities = await db.facility.findMany({
      select: {
        id: true,
        districtId: true,
      },
    });

    const districts = await db.district.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    const mothers = await db.mother.findMany({
      select: {
        id: true,
        districtId: true,
      },
    });

    const alerts = await db.alert.findMany({
      select: {
        id: true,
        pregnancyId: true,
      },
    });

    // Map pregnancies to mothers
    const pregnancies = await db.pregnancy.findMany({
      select: {
        id: true,
        motherId: true,
      },
    });

    const pregnancyToMother = new Map<number, number>();
    pregnancies.forEach((p) => {
      pregnancyToMother.set(p.id, p.motherId);
    });

    // Count alerts by district
    const alertsByDistrict = new Map<number, Set<number>>();
    alerts.forEach((alert) => {
      if (alert.pregnancyId) {
        const motherId = pregnancyToMother.get(alert.pregnancyId);
        if (motherId) {
          const mother = mothers.find((m) => m.id === motherId);
          if (mother) {
            const districtId = mother.districtId;
            if (!alertsByDistrict.has(districtId)) {
              alertsByDistrict.set(districtId, new Set());
            }
            alertsByDistrict.get(districtId)!.add(alert.id);
          }
        }
      }
    });

    // Count facilities by district
    const facilitiesByDistrict = new Map<number, number>();
    facilities.forEach((f) => {
      facilitiesByDistrict.set(f.districtId, (facilitiesByDistrict.get(f.districtId) || 0) + 1);
    });

    // Build top 5 facilities by district
    const topFacilitiesByDistrict: FacilityByDistrict[] = Array.from(
      new Map(
        districts.map((d) => [
          d.id,
          {
            districtId: d.id,
            districtName: d.name,
            facilityCount: facilitiesByDistrict.get(d.id) || 0,
            alertCount: alertsByDistrict.get(d.id)?.size || 0,
          },
        ])
      ).values()
    )
      .sort((a, b) => b.alertCount - a.alertCount)
      .slice(0, 5);

    // Fetch recent 10 alerts
    const recentAlertsRaw = await db.alert.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
        mother: {
          select: {
            id: true,
            fullName: true,
          },
        },
        pregnancy: {
          select: {
            id: true,
            isHighRisk: true,
          },
        },
      },
    });

    const recentAlerts: RecentAlert[] = recentAlertsRaw.map((alert) => ({
      id: alert.id,
      type: alert.type,
      status: alert.status,
      createdAt: alert.createdAt.toISOString(),
      mother: alert.mother,
      pregnancy: alert.pregnancy,
    }));

    return NextResponse.json({
      success: true,
      data: {
        alertsTrendData,
        appointmentsTrendData,
        topFacilitiesByDistrict,
        recentAlerts,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard aggregate data:', error);
    return NextResponse.json(
      {
        success: false,
        data: {
          alertsTrendData: [],
          appointmentsTrendData: [],
          topFacilitiesByDistrict: [],
          recentAlerts: [],
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
