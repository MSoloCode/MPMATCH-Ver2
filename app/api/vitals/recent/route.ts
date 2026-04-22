import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractUser, getTenantScopingFilter, assertValidTenantScope } from '@/lib/rbac';
import { writeAuditLog, extractAuditContext } from '@/lib/audit';

const ALLOWED_ROLES = ['NURSE', 'MIDWIFE', 'DOCTOR', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'ADMIN'];

/**
 * GET /api/vitals/recent
 * Fetch recent vitals recorded in the last 7 days within user's scope
 * Used for the recent vitals table in dashboards
 */
export async function GET(request: NextRequest) {
  try {
    // Extract and validate user authorization
    let user;
    try {
      user = extractUser(request);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check role permission
    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: insufficient permissions' },
        { status: 403 }
      );
    }

    // Validate tenant scope
    try {
      assertValidTenantScope(user as any);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: invalid tenant scope' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const skip = parseInt(searchParams.get('skip') || '0', 10);
    const take = Math.min(parseInt(searchParams.get('take') || '50', 10), 100);

    // Calculate date range for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get tenant scoping filter
    const tenantFilter = getTenantScopingFilter(user as any);

    // Build WHERE clause with tenant filtering and time range
    const whereClause = {
      createdAt: {
        gte: sevenDaysAgo,
      },
      pregnancy: {
        AND: tenantFilter,
      },
    };

    // Fetch recent vitals with pagination
    const vitals = await db.vitals.findMany({
      where: whereClause,
      include: {
        mother: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            dob: true,
          },
        },
        pregnancy: {
          select: {
            id: true,
            lmpDate: true,
            edd: true,
            status: true,
            isHighRisk: true,
          },
        },
        ancVisit: {
          select: {
            id: true,
            visitType: true,
            visitDateTime: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });

    // Get total count
    const total = await db.vitals.count({
      where: whereClause,
    });

    // Audit log
    const auditContext = extractAuditContext(request);
    writeAuditLog({
      actorId: user.userId,
      actorRole: user.role,
      action: 'READ_SENSITIVE',
      resource: 'vitals',
      resourceId: 0,
      changesSummary: {
        query: 'recent_vitals_7days',
        total,
        skip,
        take,
        dateRange: { from: sevenDaysAgo, to: new Date() },
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch((err) => {
      console.error('Audit log failed:', err);
    });

    return NextResponse.json(
      {
        success: true,
        data: vitals,
        pagination: {
          total,
          returned: vitals.length,
          skip,
          take,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/vitals/recent error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
