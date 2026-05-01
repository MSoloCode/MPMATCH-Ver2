/**
 * GET /api/dashboard/overview
 *
 * Provides role-specific dashboard overview data
 * Automatically filters all data based on user's role and assigned scope
 *
 * No query parameters - all filtering happens server-side based on JWT token
 *
 * Response includes:
 * - User context (role, name, hospital/district)
 * - Statistics (counts relevant to user's role)
 * - Recent alerts (filtered by user's scope)
 * - Upcoming appointments (filtered by user's scope)
 * - High-risk pregnancies (if visible to user)
 * - Staff info (if user is admin/clinical)
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": {
 *     "user": {
 *       "userId": 5,
 *       "role": "DOCTOR",
 *       "displayName": "Dr. John",
 *       "hospitalId": 1,
 *       "hospitalName": "City Hospital"
 *     },
 *     "stats": {
 *       "totalMothers": 45,
 *       "activePregnancies": 38,
 *       "highRiskPregnancies": 5,
 *       "openAlerts": 3,
 *       "upcomingAppointments": 12
 *     },
 *     "recentAlerts": [
 *       { "id": 1, "type": "HIGH_RISK_BP", "motherName": "Jane", "createdAt": "..." }
 *     ],
 *     "upcomingAppointments": [
 *       { "id": 1, "motherName": "Jane", "appointmentDateTime": "..." }
 *     ],
 *     "highRiskMothers": [
 *       { "id": 1, "name": "Jane", "pregnancyId": 1, "risk": "High BP" }
 *     ]
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractUser, ForbiddenError } from '@/lib/rbac';
import {
  extractDashboardContext,
  getDataVisibilityRules,
  getMothersFilter,
  getAppointmentsFilter,
  getAlertsFilter,
} from '@/lib/dashboard-helpers';

export async function GET(request: NextRequest) {
  try {
    // ========================================================================
    // 1. AUTHENTICATE REQUEST
    // ========================================================================
    let user;
    try {
      user = extractUser(request);
    } catch (error) {
      if (error instanceof ForbiddenError || error instanceof Error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 401 }
        );
      }
      throw error;
    }

    // ========================================================================
    // 2. BUILD DASHBOARD CONTEXT
    // ========================================================================
    const context = extractDashboardContext(user);
    const visibility = getDataVisibilityRules(context.role);

    // ========================================================================
    // 3. BUILD ROLE-SPECIFIC FILTERS
    // ========================================================================
    const mothersFilter = getMothersFilter(context);
    const appointmentsFilter = getAppointmentsFilter(context);
    const alertsFilter = getAlertsFilter(context);

    // ========================================================================
    // 4. FETCH STATISTICS
    // ========================================================================
    const stats = {
      totalMothers: 0,
      activePregnancies: 0,
      highRiskPregnancies: 0,
      openAlerts: 0,
      upcomingAppointments: 0,
    };

    // Only fetch if visible to this role
    if (visibility.canSeeMothers !== 'own' || context.role === 'COMMUNITY_USER') {
      // For mothers, get count if role can see them
      if (visibility.canSeeMothers !== 'own') {
        stats.totalMothers = await db.mother.count({
          where: mothersFilter,
        });
      } else if (context.role === 'COMMUNITY_USER') {
        // Community user can only see themselves
        stats.totalMothers = 1; // They themselves
      }
    }

    // Get active pregnancies
    stats.activePregnancies = await db.pregnancy.count({
      where: {
        ...mothersFilter,
        status: 'ACTIVE',
      },
    });

    // Get high-risk pregnancies
    stats.highRiskPregnancies = await db.pregnancy.count({
      where: {
        ...mothersFilter,
        isHighRisk: true,
        status: 'ACTIVE',
      },
    });

    // Get open alerts
    if (visibility.canSeeAlerts) {
      stats.openAlerts = await db.alert.count({
        where: {
          ...alertsFilter,
          status: 'OPEN',
        },
      });
    }

    // Get upcoming appointments (next 7 days)
    if (visibility.canSeeAppointments) {
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      stats.upcomingAppointments = await db.appointment.count({
        where: {
          ...appointmentsFilter,
          appointmentDateTime: {
            gte: now,
            lte: sevenDaysFromNow,
          },
          status: {
            in: ['SCHEDULED', 'CONFIRMED'],
          },
        },
      });
    }

    // ========================================================================
    // 5. FETCH RECENT ALERTS (max 5)
    // ========================================================================
    const recentAlerts =
      visibility.canSeeAlerts && context.role !== 'COMMUNITY_USER'
        ? await db.alert.findMany({
            where: {
              ...alertsFilter,
              status: 'OPEN',
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
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          })
        : [];

    // ========================================================================
    // 6. FETCH UPCOMING APPOINTMENTS (next 7 days, max 5)
    // ========================================================================
    const upcomingAppointments =
      visibility.canSeeAppointments && context.role !== 'COMMUNITY_USER'
        ? await db.appointment.findMany({
            where: {
              ...appointmentsFilter,
              appointmentDateTime: {
                gte: new Date(),
                lte: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000),
              },
              status: {
                in: ['SCHEDULED', 'CONFIRMED'],
              },
            },
            select: {
              id: true,
              appointmentDateTime: true,
              status: true,
              mother: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
            orderBy: { appointmentDateTime: 'asc' },
            take: 5,
          })
        : [];

    // ========================================================================
    // 7. FETCH HIGH-RISK PREGNANCIES (max 5)
    // ========================================================================
    const highRiskMothers =
      visibility.canSeeMothers && context.role !== 'COMMUNITY_USER'
        ? await db.pregnancy.findMany({
            where: {
              ...mothersFilter,
              isHighRisk: true,
              status: 'ACTIVE',
            },
            select: {
              id: true,
              mother: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
              riskFactors: true,
              antenatalStatus: true,
            },
            orderBy: { updatedAt: 'desc' },
            take: 5,
          })
        : [];

    // ========================================================================
    // 8. GET HOSPITAL/DISTRICT INFO IF AVAILABLE
    // ========================================================================
    let facilityInfo: { name: string; id: number } | null = null;

    if (context.hospitalId && context.role !== 'COMMUNITY_USER') {
      const hospital = await db.hospital.findUnique({
        where: { id: context.hospitalId },
        select: { id: true, name: true },
      });
      facilityInfo = hospital;
    }

    if (context.districtId && !facilityInfo && context.role !== 'COMMUNITY_USER') {
      const district = await db.district.findUnique({
        where: { id: context.districtId },
        select: { id: true, name: true },
      });
      facilityInfo = district;
    }

    // For COMMUNITY_USER, fetch their own facility
    if (context.role === 'COMMUNITY_USER' && context.motherId) {
      const mother = await db.mother.findUnique({
        where: { id: context.motherId },
        select: {
          facility: {
            select: { id: true, name: true, district: { select: { name: true } } },
          },
        },
      });
      if (mother?.facility) {
        facilityInfo = {
          id: mother.facility.id,
          name: `${mother.facility.name} (${mother.facility.district?.name})`,
        };
      }
    }

    // ========================================================================
    // 9. BUILD RESPONSE
    // ========================================================================
    return NextResponse.json({
      success: true,
      data: {
        user: {
          userId: context.userId,
          motherId: context.motherId,
          role: context.role,
          displayName: context.displayName,
          facilityInfo: facilityInfo,
        },
        stats,
        recentAlerts: recentAlerts.map((alert) => ({
          id: alert.id,
          type: alert.type,
          status: alert.status,
          motherName: alert.mother?.fullName || 'Unknown',
          createdAt: alert.createdAt,
        })),
        upcomingAppointments: upcomingAppointments.map((apt) => ({
          id: apt.id,
          appointmentDateTime: apt.appointmentDateTime,
          status: apt.status,
          motherName: apt.mother?.fullName || 'Unknown',
        })),
        highRiskMothers: highRiskMothers.map((pregnancy) => ({
          pregnancyId: pregnancy.id,
          motherName: pregnancy.mother?.fullName || 'Unknown',
          riskFactors: pregnancy.riskFactors
            ? JSON.parse(pregnancy.riskFactors as string)
            : [],
          antenatalStatus: pregnancy.antenatalStatus,
        })),
        visibility,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
