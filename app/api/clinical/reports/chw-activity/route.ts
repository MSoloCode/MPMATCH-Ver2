import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-helpers';

interface ChwActivityData {
  chwId: number;
  chwName: string;
  chwPhone: string;
  dates: Array<{
    date: string; // YYYY-MM-DD
    attended: number;
    scheduled: number;
    missed: number;
  }>;
  totals: {
    attended: number;
    scheduled: number;
    missed: number;
  };
}

interface ChwActivityResponse {
  success: boolean;
  data?: ChwActivityData[];
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<ChwActivityResponse>> {
  try {
    // Verify authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return (authResult.response as NextResponse<ChwActivityResponse>) || NextResponse.json(
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

    const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toStr ? new Date(toStr) : new Date();

    // Get user's facility/district based on role
    let facilityFilter: any = {};
    let districtId: number | null = null;

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
        districtId = user.districtId;
        facilityFilter = {
          mother: {
            facility: {
              districtId: user.districtId,
            },
          },
        };
      }
    }

    // Fetch appointments assigned to CHWs in date range
    const appointments = await db.appointment.findMany({
      where: {
        appointmentDateTime: {
          gte: from,
          lte: to,
        },
        assignedCHWId: { not: null },
        ...facilityFilter,
      },
      select: {
        id: true,
        appointmentDateTime: true,
        status: true,
        assignedCHWId: true,
        assignedCHW: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    // Group by CHW
    const byCHW = new Map<
      number,
      {
        name: string;
        phone: string;
        appointments: Array<{
          date: string;
          status: string;
        }>;
      }
    >();

    appointments.forEach((apt) => {
      const chwId = apt.assignedCHWId;

      if (chwId === null) return; // Skip appointments without assigned CHW

      if (!byCHW.has(chwId)) {
        byCHW.set(chwId, {
          name: apt.assignedCHW?.name || 'Unknown CHW',
          phone: apt.assignedCHW?.phone || '',
          appointments: [],
        });
      }

      byCHW.get(chwId)!.appointments.push({
        date: apt.appointmentDateTime.toISOString().split('T')[0],
        status: apt.status,
      });
    });

    // Build response
    const result: ChwActivityData[] = Array.from(byCHW.entries()).map(
      ([chwId, { name, phone, appointments }]) => {
        // Group by date and status
        const dateMap = new Map<
          string,
          {
            attended: number;
            scheduled: number;
            missed: number;
          }
        >();

        appointments.forEach(({ date, status }) => {
          if (!dateMap.has(date)) {
            dateMap.set(date, { attended: 0, scheduled: 0, missed: 0 });
          }

          const dayData = dateMap.get(date)!;
          if (status === 'ATTENDED') dayData.attended++;
          else if (status === 'SCHEDULED' || status === 'CONFIRMED') dayData.scheduled++;
          else if (status === 'MISSED') dayData.missed++;
        });

        // Calculate totals
        const totals = { attended: 0, scheduled: 0, missed: 0 };
        appointments.forEach(({ status }) => {
          if (status === 'ATTENDED') totals.attended++;
          else if (status === 'SCHEDULED' || status === 'CONFIRMED') totals.scheduled++;
          else if (status === 'MISSED') totals.missed++;
        });

        return {
          chwId,
          chwName: name,
          chwPhone: phone,
          dates: Array.from(dateMap.entries())
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([date, counts]) => ({
              date,
              ...counts,
            })),
          totals,
        };
      }
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('CHW Activity Report Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
