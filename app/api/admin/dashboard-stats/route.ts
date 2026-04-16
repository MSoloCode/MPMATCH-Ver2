import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-helpers';

/**
 * GET /api/admin/dashboard-stats
 * Fetch KPI statistics for the admin dashboard
 *
 * Authentication: Required (Bearer token in Authorization header)
 * Authorization: SYSTEM_ADMIN (sees all records globally) or HOSPITAL_ADMIN (sees own hospital only)
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": {
 *     "countries": 2,
 *     "facilities": 45,
 *     "openAlerts": 12,
 *     "emergencyOpen": 3,
 *     "mothers": 234,
 *     "activePregnancies": 156,
 *     "highRiskPregnancies": 23,
 *     "upcomingAppointments": 89,
 *     "users": 42,
 *     "alertsTrend": [
 *       { "date": "2026-04-03", "count": 5 },
 *       { "date": "2026-04-04", "count": 8 }
 *     ],
 *     "appointmentsNextWeek": [
 *       { "date": "2026-04-16", "count": 12 },
 *       { "date": "2026-04-17", "count": 10 }
 *     ],
 *     "facilitiesByDistrict": [
 *       { "district": "Central", "count": 15 },
 *       { "district": "North", "count": 12 }
 *     ],
 *     "recentAlerts": [
 *       { "id": 1, "motherName": "Jane Doe", "type": "MANUAL_EMERGENCY", "status": "OPEN", "createdAt": "2026-04-16T10:30:45Z" }
 *     ]
 *   }
 * }
 */

// Helper: Format date to YYYY-MM-DD
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function GET(request: NextRequest) {
  try {
    // ========================================================================
    // 1. AUTHENTICATE REQUEST
    // ========================================================================
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return auth.response;
    }

    const { role, userId } = auth.payload!;

    // ========================================================================
    // 2. AUTHORIZE ROLE (SYSTEM_ADMIN or HOSPITAL_ADMIN)
    // ========================================================================
    if (role !== 'SYSTEM_ADMIN' && role !== 'HOSPITAL_ADMIN') {
      return NextResponse.json(
        {
          success: false,
          error: 'Access denied. System or Hospital administrators only.',
        },
        { status: 403 }
      );
    }

    // Get user's hospital if HOSPITAL_ADMIN
    let userHospitalId: number | undefined;
    if (role === 'HOSPITAL_ADMIN' && userId) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { hospitalId: true },
      });
      userHospitalId = user?.hospitalId || undefined;
    }

    // Build hospital filter - only for HOSPITAL_ADMIN scoped queries
    const hasHospitalScope = role === 'HOSPITAL_ADMIN' && userHospitalId;
    const hospitalFilterForMother = hasHospitalScope
      ? {
          facility: {
            hospitals: {
              some: {
                id: userHospitalId,
              },
            },
          },
        }
      : {};

    const hospitalFilterForPregnancy = hasHospitalScope
      ? {
          mother: {
            facility: {
              hospitals: {
                some: {
                  id: userHospitalId,
                },
              },
            },
          },
        }
      : {};

    const hospitalFilterForAppointment = hasHospitalScope
      ? {
          mother: {
            facility: {
              hospitals: {
                some: {
                  id: userHospitalId,
                },
              },
            },
          },
        }
      : {};

    const hospitalFilterForAlert = hasHospitalScope
      ? {
          mother: {
            facility: {
              hospitals: {
                some: {
                  id: userHospitalId,
                },
              },
            },
          },
        }
      : {};

    // ========================================================================
    // 3. FETCH ALL METRICS IN PARALLEL
    // ========================================================================

    const [
      countries,
      facilities,
      openAlerts,
      emergencyOpen,
      mothers,
      activePregnancies,
      highRiskPregnancies,
      upcomingAppointments,
      users,
      alertsTrendRaw,
      appointmentsNextWeekRaw,
      facilitiesByDistrictRaw,
      recentAlertsRaw,
    ] = await Promise.all([
      // Global counts (no scoping)
      db.country.count(),
      db.facility.count(),

      // Open alerts (hospital-scoped for HOSPITAL_ADMIN)
      db.alert.count({
        where: {
          status: 'OPEN',
          ...hospitalFilterForAlert,
        },
      }),

      // Emergency open alerts (high-risk + MANUAL_EMERGENCY)
      db.alert.count({
        where: {
          type: 'MANUAL_EMERGENCY',
          status: 'OPEN',
          pregnancy: {
            isHighRisk: true,
          },
          ...hospitalFilterForAlert,
        },
      }),

      // Mothers (hospital-scoped for HOSPITAL_ADMIN)
      db.mother.count({
        where: hospitalFilterForMother,
      }),

      // Active pregnancies (ACTIVE or CLOSED status)
      db.pregnancy.count({
        where: {
          status: {
            in: ['ACTIVE', 'CLOSED'],
          },
          ...hospitalFilterForPregnancy,
        },
      }),

      // High-risk pregnancies
      db.pregnancy.count({
        where: {
          isHighRisk: true,
          status: 'ACTIVE',
          ...hospitalFilterForPregnancy,
        },
      }),

      // Upcoming appointments (next 7 days)
      db.appointment.count({
        where: {
          status: {
            in: ['SCHEDULED', 'CONFIRMED'],
          },
          appointmentDateTime: {
            gte: new Date(),
            lt: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000),
          },
          ...hospitalFilterForAppointment,
        },
      }),

      // Active staff users (not COMMUNITY_USER)
      db.user.count({
        where: {
          role: {
            not: 'COMMUNITY_USER',
          },
          isActive: true,
          ...(role === 'HOSPITAL_ADMIN' && userHospitalId
            ? { hospitalId: userHospitalId }
            : {}),
        },
      }),

      // Alerts trend - last 14 days (fetch all and group in memory)
      db.alert.findMany({
        where: {
          createdAt: {
            gte: new Date(new Date().getTime() - 14 * 24 * 60 * 60 * 1000),
          },
          ...hospitalFilterForAlert,
        },
        select: {
          createdAt: true,
        },
      }),

      // Appointments trend - next 7 days (fetch all and group in memory)
      db.appointment.findMany({
        where: {
          appointmentDateTime: {
            gte: new Date(),
            lt: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000),
          },
          ...hospitalFilterForAppointment,
        },
        select: {
          appointmentDateTime: true,
        },
      }),

      // Facilities by district - top 5 (using raw groupBy, global view)
      db.$queryRaw<Array<{ districtId: number; count: number }>>`
        SELECT districtId, COUNT(*) as count
        FROM facilities
        GROUP BY districtId
        ORDER BY count DESC
        LIMIT 5
      `,

      // Recent alerts - last 10 (hospital-scoped for HOSPITAL_ADMIN)
      db.alert.findMany({
        where: hospitalFilterForAlert,
        select: {
          id: true,
          type: true,
          status: true,
          createdAt: true,
          mother: {
            select: {
              fullName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      }),
    ]);

    // ========================================================================
    // 4. PROCESS TREND DATA
    // ========================================================================

    // Transform alerts trend to date-grouped format
    const alertsTrendMap = new Map<string, number>();
    alertsTrendRaw.forEach((item: any) => {
      const date = formatDate(new Date(item.createdAt));
      alertsTrendMap.set(date, (alertsTrendMap.get(date) || 0) + 1);
    });

    const alertsTrend = Array.from(alertsTrendMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Transform appointments trend to date-grouped format
    const appointmentsTrendMap = new Map<string, number>();
    appointmentsNextWeekRaw.forEach((item: any) => {
      const date = formatDate(new Date(item.appointmentDateTime));
      appointmentsTrendMap.set(date, (appointmentsTrendMap.get(date) || 0) + 1);
    });

    const appointmentsNextWeek = Array.from(appointmentsTrendMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ========================================================================
    // 5. PROCESS FACILITIES BY DISTRICT
    // ========================================================================

    // Fetch district names for top 5
    const facilitiesByDistrictWithNames = await Promise.all(
      facilitiesByDistrictRaw.map(async (item: any) => {
        const district = await db.district.findUnique({
          where: { id: item.districtId },
          select: { name: true },
        });
        return {
          district: district?.name || `District ${item.districtId}`,
          count: item.count,
        };
      })
    );

    // ========================================================================
    // 6. PROCESS RECENT ALERTS
    // ========================================================================

    const recentAlerts = recentAlertsRaw.map((alert: any) => ({
      id: alert.id,
      motherName: alert.mother?.fullName || 'Unknown',
      type: alert.type,
      status: alert.status,
      createdAt: alert.createdAt.toISOString(),
    }));

    // ========================================================================
    // 7. RETURN RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: {
          countries,
          facilities,
          openAlerts,
          emergencyOpen,
          mothers,
          activePregnancies,
          highRiskPregnancies,
          upcomingAppointments,
          users,
          alertsTrend,
          appointmentsNextWeek,
          facilitiesByDistrict: facilitiesByDistrictWithNames,
          recentAlerts,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching admin dashboard stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
