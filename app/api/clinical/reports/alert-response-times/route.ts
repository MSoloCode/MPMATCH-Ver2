import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-helpers';

interface AlertResponseData {
  type: string;
  count: number;
  avgResponseHours: number;
  minResponseHours: number;
  maxResponseHours: number;
  dates: Array<{
    date: string; // YYYY-MM-DD
    avgResponse: number;
    count: number;
  }>;
}

interface AlertResponseTimesResponse {
  success: boolean;
  data?: AlertResponseData[];
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<AlertResponseTimesResponse>> {
  try {
    // Verify authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return (authResult.response as NextResponse<AlertResponseTimesResponse>) || NextResponse.json(
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
          facilityFilter = {
            mother: {
              facilityId: hospital.facilityId,
            },
          };
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

    // Fetch closed alerts with response times
    const closedAlerts = await db.alert.findMany({
      where: {
        status: 'CLOSED',
        closedAt: {
          gte: from,
          lte: to,
        },
        createdAt: {
          lte: to,
        },
        ...facilityFilter,
      },
      select: {
        id: true,
        type: true,
        createdAt: true,
        closedAt: true,
      },
    });

    // Group by alert type and calculate response times
    const byType = new Map<
      string,
      {
        alerts: Array<{ responseHours: number; createdAt: Date }>;
      }
    >();

    closedAlerts.forEach((alert) => {
      const responseMs = (alert.closedAt!.getTime() - alert.createdAt.getTime());
      const responseHours = responseMs / (1000 * 60 * 60);

      if (!byType.has(alert.type)) {
        byType.set(alert.type, { alerts: [] });
      }

      byType.get(alert.type)!.alerts.push({
        responseHours,
        createdAt: alert.createdAt,
      });
    });

    // Build response
    const result: AlertResponseData[] = Array.from(byType.entries()).map(
      ([type, { alerts }]) => {
        // Group by date for date series
        const alertsByDate = new Map<
          string,
          { responseHours: number[] }
        >();

        alerts.forEach(({ responseHours, createdAt }) => {
          const dateStr = createdAt.toISOString().split('T')[0];
          if (!alertsByDate.has(dateStr)) {
            alertsByDate.set(dateStr, { responseHours: [] });
          }
          alertsByDate.get(dateStr)!.responseHours.push(responseHours);
        });

        // Calculate aggregates
        const allResponseHours = alerts.map((a) => a.responseHours);
        const avgResponseHours =
          allResponseHours.length > 0
            ? allResponseHours.reduce((a, b) => a + b, 0) / allResponseHours.length
            : 0;

        const dates = Array.from(alertsByDate.entries())
          .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
          .map(([date, { responseHours }]) => ({
            date,
            avgResponse: Math.round((responseHours.reduce((a, b) => a + b) / responseHours.length) * 100) / 100,
            count: responseHours.length,
          }));

        return {
          type,
          count: alerts.length,
          avgResponseHours: Math.round(avgResponseHours * 100) / 100,
          minResponseHours: Math.round(Math.min(...allResponseHours) * 100) / 100,
          maxResponseHours: Math.round(Math.max(...allResponseHours) * 100) / 100,
          dates,
        };
      }
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Alert Response Times Report Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
