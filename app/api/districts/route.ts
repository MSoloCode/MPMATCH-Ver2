import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/districts
 * Retrieve all districts with their associated facilities
 * Used to populate district and facility dropdowns during registration
 *
 * Query Parameters:
 * - countryId (optional): Filter by country ID
 * - districtId (optional): Get specific district
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 1,
 *       "name": "Kampala",
 *       "facilities": [
 *         {
 *           "id": 1,
 *           "name": "Mulago National Hospital",
 *           "type": "HOSPITAL"
 *         }
 *       ]
 *     }
 *   ]
 * }
 *
 * Response on error (500):
 * {
 *   "success": false,
 *   "error": "Failed to fetch districts"
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const countryId = searchParams.get('countryId');
    const districtId = searchParams.get('districtId');

    // Build where clause
    const where: any = {};

    if (countryId) {
      where.countryId = parseInt(countryId, 10);
    }

    if (districtId) {
      where.id = parseInt(districtId, 10);
    }

    // Fetch districts with their facilities
    const districts = await db.district.findMany({
      where,
      select: {
        id: true,
        name: true,
        facilities: {
          select: {
            id: true,
            name: true,
            type: true,
          },
          orderBy: {
            name: 'asc',
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: districts,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching districts:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch districts',
      },
      { status: 500 }
    );
  }
}
