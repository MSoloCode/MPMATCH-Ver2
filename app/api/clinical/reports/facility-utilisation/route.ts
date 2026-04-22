import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-helpers';

interface FacilityUtilisationData {
  facility: string;
  facilityId: number;
  dates: Array<{
    period: string; // YYYY-MM-DD or YYYY-MM or YYYY-Www depending on granularity
    visitCount: number;
  }>;
  total: number;
}

interface FacilityUtilisationResponse {
  success: boolean;
  data?: FacilityUtilisationData[];
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<FacilityUtilisationResponse>> {
  try {
    // Verify authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return (authResult.response as NextResponse<FacilityUtilisationResponse>) || NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { role, userId } = authResult.payload!;

    // Check authorization
    const allowedRoles = ['DOCTOR', 'MIDWIFE', 'NURSE', 'DHO', 'ORG_ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN'];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const fromStr = searchParams.get('from') || '';
    const toStr = searchParams.get('to') || '';
    const period = searchParams.get('period') || 'day'; // day | week | month

    const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toStr ? new Date(toStr) : new Date();

    // Get user's facility based on role
    let facilityFilter: any = {};
    if (role === 'DOCTOR' || role === 'MIDWIFE' || role === 'NURSE') {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { hospitalId: true },
      });
      if (user?.hospitalId) {
        const hospital = await db.hospital.findUnique({
          where: { id: user.hospitalId },
          select: { facilityId: true },
        });
        if (hospital?.facilityId) {
          facilityFilter = { facilityId: hospital.facilityId };
        }
      }
    } else if (role === 'DHO' || role === 'ORG_ADMIN') {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { districtId: true },
      });
      if (user?.districtId) {
        facilityFilter = {
          mother: {
            facility: {
              districtId: user.districtId,
            },
          },
        };
      }
    }

    // Fetch ANC visits in date range
    const ancVisits = await db.ancVisit.findMany({
      where: {
        visitDateTime: {
          gte: from,
          lte: to,
        },
        ...facilityFilter,
      },
      select: {
        id: true,
        visitDateTime: true,
        mother: {
          select: {
            facilityId: true,
            facility: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    // Helper function to get period key
    const getPeriodKey = (date: Date, periodType: string): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      if (periodType === 'day') {
        return `${year}-${month}-${day}`;
      } else if (periodType === 'week') {
        // ISO week number
        const d = new Date(Date.UTC(year, date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
        const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
        return `${year}-W${String(weekNum).padStart(2, '0')}`;
      } else if (periodType === 'month') {
        return `${year}-${month}`;
      }
      return '';
    };

    // Group by facility and period
    const byFacility = new Map<
      number,
      {
        name: string;
        periods: Map<string, number>;
      }
    >();

    ancVisits.forEach((visit) => {
      const facilityId = visit.mother.facilityId;
      const facilityName = visit.mother.facility?.name || 'Unknown Facility';
      const periodKey = getPeriodKey(visit.visitDateTime, period);

      if (!byFacility.has(facilityId)) {
        byFacility.set(facilityId, { name: facilityName, periods: new Map() });
      }

      const data = byFacility.get(facilityId)!;
      data.periods.set(periodKey, (data.periods.get(periodKey) || 0) + 1);
    });

    // Build response
    const result: FacilityUtilisationData[] = Array.from(byFacility.entries())
      .map(([facilityId, { name, periods }]) => {
        const total = Array.from(periods.values()).reduce((a, b) => a + b, 0);
        return {
          facility: name,
          facilityId,
          dates: Array.from(periods.entries())
            .sort(([periodA], [periodB]) => periodA.localeCompare(periodB))
            .map(([period, visitCount]) => ({
              period,
              visitCount,
            })),
          total,
        };
      })
      .sort((a, b) => b.total - a.total); // Sort by total visits descending

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Facility Utilisation Report Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
