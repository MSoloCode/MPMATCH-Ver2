import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-helpers';

interface HighRiskPregnancyData {
  pregnancyId: number;
  motherId: number;
  motherName: string;
  phone: string;
  lmpDate: string | null;
  edd: string | null;
  riskFactors: string[];
  lastAlertDate: string | null;
  alerts: Array<{
    id: number;
    type: string;
    status: string;
    createdAt: string;
  }>;
}

interface HighRiskPregnanciesResponse {
  success: boolean;
  data?: HighRiskPregnancyData[];
  total?: number;
  page?: number;
  pageSize?: number;
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<HighRiskPregnanciesResponse>> {
  try {
    // Verify authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return (authResult.response as NextResponse<HighRiskPregnanciesResponse>) || NextResponse.json(
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
    const pageStr = searchParams.get('page') || '1';
    const pageSizeStr = searchParams.get('pageSize') || '50';
    const page = Math.max(1, parseInt(pageStr, 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeStr, 10)));

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

    // Fetch high-risk pregnancies (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Find pregnancies marked as high-risk OR with recent danger signs/alerts
    const highRiskPregnancies = await db.pregnancy.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { isHighRisk: true },
          {
            alerts: {
              some: {
                createdAt: {
                  gte: sevenDaysAgo,
                },
              },
            },
          },
        ],
        ...facilityFilter,
      },
      select: {
        id: true,
        motherId: true,
        lmpDate: true,
        edd: true,
        riskFactors: true,
        mother: {
          select: { id: true, fullName: true, phone: true },
        },
        alerts: {
          where: {
            createdAt: {
              gte: sevenDaysAgo,
            },
          },
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Count total
    const total = await db.pregnancy.count({
      where: {
        status: 'ACTIVE',
        OR: [
          { isHighRisk: true },
          {
            alerts: {
              some: {
                createdAt: {
                  gte: sevenDaysAgo,
                },
              },
            },
          },
        ],
        ...facilityFilter,
      },
    });

    // Format response
    const data: HighRiskPregnancyData[] = highRiskPregnancies.map((preg) => ({
      pregnancyId: preg.id,
      motherId: preg.mother.id,
      motherName: preg.mother.fullName,
      phone: preg.mother.phone,
      lmpDate: preg.lmpDate ? preg.lmpDate.toISOString().split('T')[0] : null,
      edd: preg.edd ? preg.edd.toISOString().split('T')[0] : null,
      riskFactors: preg.riskFactors ? JSON.parse(preg.riskFactors) : [],
      lastAlertDate: preg.alerts.length > 0 ? preg.alerts[0].createdAt.toISOString() : null,
      alerts: preg.alerts.map((alert) => ({
        id: alert.id,
        type: alert.type,
        status: alert.status,
        createdAt: alert.createdAt.toISOString(),
      })),
    }));

    return NextResponse.json({
      success: true,
      data,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('High-risk Pregnancies Report Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
