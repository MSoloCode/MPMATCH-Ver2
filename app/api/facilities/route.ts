import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { FacilityListItem } from '@/types';

/**
 * GET /api/facilities
 * Retrieve list of all facilities for dropdown/selection
 *
 * Query parameters:
 * - countryId (optional): Filter by country ID
 * - districtId (optional): Filter by district ID
 *
 * Response on success:
 * {
 *   "success": true,
 *   "data": [
 *     { "id": 1, "name": "Hospital A", "districtId": 5, "countryId": 1 },
 *     { "id": 2, "name": "Clinic B", "districtId": 6, "countryId": 1 }
 *   ]
 * }
 *
 * Response on failure:
 * {
 *   "success": false,
 *   "error": "Error message"
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // ========================================================================
    // 1. PARSE QUERY PARAMETERS
    // ========================================================================
    const searchParams = request.nextUrl.searchParams;
    const countryId = searchParams.get('countryId');
    const districtId = searchParams.get('districtId');

    // ========================================================================
    // 2. BUILD QUERY FILTER
    // ========================================================================
    const where: any = {};
    if (countryId) {
      where.countryId = parseInt(countryId, 10);
    }
    if (districtId) {
      where.districtId = parseInt(districtId, 10);
    }

    // ========================================================================
    // 3. FETCH FACILITIES FROM DATABASE
    // ========================================================================
    const facilities = await db.facility.findMany({
      where,
      select: {
        id: true,
        name: true,
        districtId: true,
        countryId: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // ========================================================================
    // 4. RETURN RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: facilities as FacilityListItem[],
      },
      { status: 200 }
    );
  } catch (error) {
    // Unexpected error
    console.error('Facilities endpoint error:', error);

    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve facilities',
        details: errorMsg,
      },
      { status: 500 }
    );
  }
}
