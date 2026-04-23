/**
 * TEST ENDPOINT: Legacy Pattern (req/res handlers)
 * 
 * This endpoint demonstrates the legacy pattern for using requireRole middleware.
 * Allows: HOSPITAL_ADMIN only
 * 
 * To test:
 *   curl -H "Authorization: Bearer <valid_hospital_admin_token>" http://localhost:3000/api/test-rbac-legacy
 *   curl -H "Authorization: Bearer <valid_doctor_token>" http://localhost:3000/api/test-rbac-legacy  # Should return 403 (role mismatch)
 *   curl -H "Authorization: Bearer <invalid_token>" http://localhost:3000/api/test-rbac-legacy  # Should return 401
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getTenantScopingField } from '@/lib/rbac';

const handler = requireRole('HOSPITAL_ADMIN')(
  async (request: NextRequest) => {
    try {
      // At this point:
      // 1. Token has been verified
      // 2. User role is 'HOSPITAL_ADMIN'
      // 3. Tenant scope is valid (hospitalId exists)
      // 4. request.user is populated with decoded payload

      const user = (request as any).user;

      // Example: Get scoping field name for logging/debugging
      const scopingField = getTenantScopingField(user);

      return NextResponse.json({
        success: true,
        message: 'Access granted - legacy pattern test endpoint',
        user: {
          userId: user.userId,
          role: user.role,
          hospitalId: user.hospitalId,
          districtId: user.districtId,
          countryId: user.countryId,
        },
        scopingContext: {
          scopingField,
          scopingValue:
            scopingField === 'hospitalId'
              ? user.hospitalId
              : scopingField === 'districtId'
                ? user.districtId
                : scopingField === 'motherId'
                  ? user.motherId
                  : null,
          description: scopingField
            ? `This ${user.role} user is scoped to ${scopingField}: ${user[scopingField] || 'N/A'}`
            : 'SYSTEM_ADMIN has unrestricted access',
        },
      });
    } catch (error) {
      console.error('Test endpoint error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
        },
        { status: 500 }
      );
    }
  }
);

export const GET = handler;
export const POST = handler;
