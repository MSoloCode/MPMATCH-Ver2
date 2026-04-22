import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-helpers';

interface MissedAppointmentData {
  motherId: number;
  motherName: string;
  phone: string;
  lastMissedDate: string;
  missedCount: number;
  dates: Array<{
    date: string; // YYYY-MM-DD
    count: number;
  }>;
}

interface MissedAppointmentsResponse {
  success: boolean;
  data?: MissedAppointmentData[];
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<MissedAppointmentsResponse>> {
  try {
    // Verify authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return (authResult.response as NextResponse<MissedAppointmentsResponse>) || NextResponse.json(
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

    // Fetch missed appointments
    const missedAppointments = await db.appointment.findMany({
      where: {
        status: 'MISSED',
        appointmentDateTime: {
          gte: from,
          lte: to,
        },
        ...facilityFilter,
      },
      select: {
        id: true,
        appointmentDateTime: true,
        motherId: true,
        mother: {
          select: { id: true, fullName: true, phone: true },
        },
      },
      orderBy: { appointmentDateTime: 'desc' },
    });

    // Group by mother
    const byMother = new Map<
      number,
      {
        name: string;
        phone: string;
        missedDates: Date[];
      }
    >();

    missedAppointments.forEach((apt) => {
      const motherId = apt.motherId;

      if (!byMother.has(motherId)) {
        byMother.set(motherId, {
          name: apt.mother.fullName,
          phone: apt.mother.phone,
          missedDates: [],
        });
      }

      byMother.get(motherId)!.missedDates.push(apt.appointmentDateTime);
    });

    // Build response
    const result: MissedAppointmentData[] = Array.from(byMother.entries())
      .map(([motherId, { name, phone, missedDates }]) => {
        // Group by date
        const dateMap = new Map<string, number>();
        missedDates.forEach((date) => {
          const dateStr = date.toISOString().split('T')[0];
          dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
        });

        return {
          motherId,
          motherName: name,
          phone,
          lastMissedDate: missedDates.length > 0 ? missedDates[0].toISOString().split('T')[0] : '',
          missedCount: missedDates.length,
          dates: Array.from(dateMap.entries())
            .sort(([dateA], [dateB]) => dateB.localeCompare(dateA)) // Reverse sort: newest first
            .map(([date, count]) => ({ date, count })),
        };
      })
      .sort((a, b) => new Date(b.lastMissedDate).getTime() - new Date(a.lastMissedDate).getTime());

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Missed Appointments Report Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
