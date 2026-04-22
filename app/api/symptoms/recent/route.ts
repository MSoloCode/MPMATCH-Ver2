import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  extractUser,
  assertValidTenantScope,
  getTenantScopingFilter,
  UnauthorizedError,
  ForbiddenError
} from '@/lib/rbac';

/**
 * GET /api/symptoms/recent
 * List recent symptom records in the user's scope (last 7 days).
 * 
 * Query params:
 *   - skip: Number of records to skip (default: 0)
 *   - take: Number of records to return (default: 20, max: 100)
 * 
 * Allowed roles: NURSE, MIDWIFE, DOCTOR, CHW, HOSPITAL_ADMIN, SYSTEM_ADMIN
 */
export async function GET(request: NextRequest) {
  try {
    // Step 1: Extract and validate user
    let user;
    try {
      user = extractUser(request);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 401 }
        );
      }
      throw error;
    }

    // Step 2: Check role permissions
    const allowedRoles = ['NURSE', 'MIDWIFE', 'DOCTOR', 'CHW', 'HOSPITAL_ADMIN', 'SYSTEM_ADMIN'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Step 3: Validate tenant scope
    try {
      assertValidTenantScope(user as any);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 403 }
        );
      }
      throw error;
    }

    // Step 4: Parse pagination parameters
    const { searchParams } = new URL(request.url);

    let skip = 0;
    const skipParam = searchParams.get('skip');
    if (skipParam) {
      skip = Math.max(0, parseInt(skipParam, 10));
      if (isNaN(skip)) skip = 0;
    }

    let take = 20;
    const takeParam = searchParams.get('take');
    if (takeParam) {
      take = Math.min(100, Math.max(1, parseInt(takeParam, 10)));
      if (isNaN(take)) take = 20;
    }

    // Step 5: Get tenant scope filter
    const scopeFilter = getTenantScopingFilter(user as any);

    // Step 6: Calculate date threshold (7 days ago)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Step 7: Build where clause with date filter
    const where = {
      ...scopeFilter,
      createdAt: {
        gte: sevenDaysAgo
      }
    };

    // Step 8: Execute queries in parallel
    const [symptoms, total] = await Promise.all([
      db.symptoms.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              role: true
            }
          }
        }
      }),
      db.symptoms.count({ where })
    ]);

    return NextResponse.json(
      {
        success: true,
        data: symptoms,
        pagination: {
          total,
          returned: symptoms.length,
          skip,
          take
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/symptoms/recent error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
