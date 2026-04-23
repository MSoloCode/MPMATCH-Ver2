/**
 * TEST ENDPOINT: Modern Pattern (NextRequest/NextResponse)
 * 
 * This endpoint demonstrates the modern pattern for using requireRole middleware.
 * Allows: DOCTOR, NURSE, MIDWIFE
 * 
 * To test:
 *   curl -H "Authorization: Bearer <valid_doctor_token>" http://localhost:3000/api/test-rbac-modern
 *   curl -H "Authorization: Bearer <valid_nurse_token>" http://localhost:3000/api/test-rbac-modern
 *   curl -H "Authorization: Bearer <invalid_token>" http://localhost:3000/api/test-rbac-modern  # Should return 401
 *   curl http://localhost:3000/api/test-rbac-modern  # Should return 401 (no token)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getTenantScopingFilter } from '@/lib/rbac';

const handler = requireRole('DOCTOR', 'NURSE', 'MIDWIFE')(
  async (request: NextRequest) => {
    try {
      // At this point:
      // 1. Token has been verified
      // 2. User role is in ['DOCTOR', 'NURSE', 'MIDWIFE']
      // 3. Tenant scope is valid (hospitalId exists for these roles)
      // 4. request.user is populated with decoded payload

      const user = (request as any).user;

      // Example: Get tenant scoping filter for this user
      const scopeFilter = getTenantScopingFilter(user);

      // Example: You would normally use this in a Prisma query
      // const pregnancies = await db.pregnancy.findMany({
      //   where: {
      //     ...scopeFilter,  // Automatically applies { hospitalId: user.hospitalId }
      //   },
      // });

      return NextResponse.json({
        success: true,
        message: 'Access granted - modern pattern test endpoint',
        user: {
          userId: user.userId,
          role: user.role,
          hospitalId: user.hospitalId,
          districtId: user.districtId,
          countryId: user.countryId,
        },
        scopingContext: {
          appliedFilter: scopeFilter,
          filterDescription:
            user.role === 'SYSTEM_ADMIN'
              ? 'No filtering (unrestricted)'
              : `Filtered by hospitalId: ${user.hospitalId}`,
        },
      });
    } catch (error) {
      console.error('Test endpoint error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
);

export const GET = handler;
export const POST = handler;
