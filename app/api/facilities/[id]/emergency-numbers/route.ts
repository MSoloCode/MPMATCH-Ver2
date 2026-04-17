import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { EmergencyNumbers } from '@/types';

/**
 * GET /api/facilities/:id/emergency-numbers
 * Retrieve emergency contact numbers for a specific facility
 *
 * Path parameters:
 * - id: Facility ID
 *
 * Response on success:
 * {
 *   "success": true,
 *   "data": {
 *     "emergencyLine": "+256701234567",
 *     "ambulance": "+256701234568",
 *     "onCall": "+256701234569",
 *     "backup": "+256701234570"
 *   }
 * }
 *
 * Response on 404:
 * {
 *   "success": false,
 *   "error": "Facility not found"
 * }
 *
 * Response on error:
 * {
 *   "success": false,
 *   "error": "Error message"
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ========================================================================
    // 1. PARSE FACILITY ID FROM PATH
    // ========================================================================
    const resolvedParams = await params;
    const facilityId = parseInt(resolvedParams.id, 10);
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
    // 2. FETCH FACILITY EMERGENCY NUMBERS FROM DATABASE
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
    // 4. RETURN RESPONSE
    // ========================================================================
    const emergencyNumbers: EmergencyNumbers = {
      emergencyLine: facility.emergencyPhone || undefined,
      ambulance: facility.ambulancePhone || undefined,
      onCall: facility.onCallPhone || undefined,
      backup: facility.backupPhone || undefined,
    };

    return NextResponse.json(
      {
        success: true,
        data: emergencyNumbers,
      },
      { status: 200 }
    );
  } catch (error) {
    // Unexpected error
    console.error('Emergency numbers endpoint error:', error);

    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve emergency numbers',
        details: errorMsg,
      },
      { status: 500 }
    );
  }
}
