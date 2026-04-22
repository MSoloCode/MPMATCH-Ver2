import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-helpers';

interface AncAttendanceData {
  facility: string;
  facilityId: number;
  visitCount: number;
  motherCount: number;
  attendancePercentage: number;
  dates: Array<{
    date: string; // YYYY-MM-DD
    visits: number;
  }>;
}

interface AncAttendanceResponse {
  success: boolean;
  data?: AncAttendanceData[];
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<AncAttendanceResponse>> {
  try {
    // Verify authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return (authResult.response as NextResponse<AncAttendanceResponse>) || NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { role, userId } = authResult.payload!;

    // Check authorization - allow clinical roles
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
    const facilityIdStr = searchParams.get('facilityId') || '';

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
          facility: {
            districtId: user.districtId,
          },
        };
      }
    }

    // Fetch ANC visits with mother data
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
        motherId: true,
        mother: {
          select: {
            id: true,
            facilityId: true,
            facility: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    // Group by facility
    const byFacility = new Map<number, { name: string; visits: Date[]; mothers: Set<number> }>();

    ancVisits.forEach((visit) => {
      const facilityId = visit.mother.facilityId;
      const facilityName = visit.mother.facility?.name || 'Unknown Facility';

      if (!byFacility.has(facilityId)) {
        byFacility.set(facilityId, { name: facilityName, visits: [], mothers: new Set() });
      }

      const data = byFacility.get(facilityId)!;
      data.visits.push(visit.visitDateTime);
      data.mothers.add(visit.motherId);
    });

    // Build response data
    const result: AncAttendanceData[] = Array.from(byFacility.entries()).map(
      ([facilityId, { name, visits, mothers }]) => {
        // Group visits by date
        const visitsByDate = new Map<string, number>();
        visits.forEach((visitDate) => {
          const dateStr = visitDate.toISOString().split('T')[0];
          visitsByDate.set(dateStr, (visitsByDate.get(dateStr) || 0) + 1);
        });

        // Calculate attendance percentage
        // Expected: mothers should have visits - simple percentage based on actual visits vs mothers
        const attendancePercentage = mothers.size > 0 ? (visits.length / mothers.size) * 100 : 0;

        return {
          facility: name,
          facilityId,
          visitCount: visits.length,
          motherCount: mothers.size,
          attendancePercentage: Math.round(attendancePercentage * 100) / 100,
          dates: Array.from(visitsByDate.entries())
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([date, visitCount]) => ({
              date,
              visits: visitCount,
            })),
        };
      }
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('ANC Attendance Report Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
