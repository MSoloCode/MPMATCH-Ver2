import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/facilities/:id/emergency-contacts
 * Retrieve emergency contact numbers for a specific facility (PUBLIC - no authentication required)
 *
 * Path parameters:
 * - id: Facility ID
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": {
 *     "emergencyLine": "+256414671234",
 *     "ambulance": "+256701111111",
 *     "onCall": "+256702222222",
 *     "backup": "+256703333333"
 *   }
 * }
 *
 * Response on facility not found (404):
 * {
 *   "success": false,
 *   "error": "Facility not found"
 * }
 *
 * Response on invalid ID (400):
 * {
 *   "success": false,
 *   "error": "Invalid facility ID - must be a number"
 * }
 *
 * Response on server error (500):
 * {
 *   "success": false,
 *   "error": "Failed to retrieve emergency contacts"
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ========================================================================
    // 1. PARSE & VALIDATE FACILITY ID FROM PATH
    // ========================================================================
    const facilityId = parseInt(params.id, 10);
    if (isNaN(facilityId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid facility ID - must be a number',
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // 2. FETCH FACILITY EMERGENCY CONTACTS FROM DATABASE
    // ========================================================================
    const facility = await db.facility.findUnique({
      where: { id: facilityId },
      select: {
        emergencyPhone: true,
        ambulancePhone: true,
        onCallPhone: true,
        backupPhone: true,
      },
    });

    // ========================================================================
    // 3. CHECK IF FACILITY EXISTS
    // ========================================================================
    if (!facility) {
      return NextResponse.json(
        {
          success: false,
          error: 'Facility not found',
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 4. RETURN EMERGENCY CONTACTS RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: {
          emergencyLine: facility.emergencyPhone || null,
          ambulance: facility.ambulancePhone || null,
          onCall: facility.onCallPhone || null,
          backup: facility.backupPhone || null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Emergency contacts endpoint error:', error);

    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve emergency contacts',
        details: errorMsg,
      },
      { status: 500 }
    );
  }
}
