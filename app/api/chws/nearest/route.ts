import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-helpers';
import { haversineDistanceKm } from '@/lib/geo';

/**
 * GET /api/chws/nearest
 * Find the 3 nearest CHWs by facility proximity
 *
 * Query parameters:
 * - lat: number (required) - User's latitude
 * - lng: number (required) - User's longitude
 *
 * Authentication: Required (Bearer token in Authorization header)
 * Role: COMMUNITY_USER
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 5,
 *       "name": "John Okello",
 *       "phone": "0701234567",
 *       "facilityName": "Mulago Hospital",
 *       "distanceKm": 2.5
 *     }
 *   ]
 * }
 *
 * Response on unauthorized (401):
 * {
 *   "success": false,
 *   "error": "Unauthorized"
 * }
 *
 * Response on missing coordinates (400):
 * {
 *   "success": false,
 *   "error": "lat and lng query parameters are required"
 * }
 *
 * Response on server error (500):
 * {
 *   "success": false,
 *   "error": "Internal server error"
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // ========================================================================
    // 1. AUTHENTICATE REQUEST
    // ========================================================================
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return auth.response;
    }

    const { role } = auth.payload!;

    // ========================================================================
    // 2. VERIFY ROLE (should be COMMUNITY_USER)
    // ========================================================================
    if (role !== 'COMMUNITY_USER') {
      return NextResponse.json(
        {
          success: false,
          error: 'Access denied. Community users only.',
        },
        { status: 403 }
      );
    }

    // ========================================================================
    // 3. GET QUERY PARAMETERS (LAT/LNG)
    // ========================================================================
    const searchParams = request.nextUrl.searchParams;
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');

    if (!latParam || !lngParam) {
      return NextResponse.json(
        {
          success: false,
          error: 'lat and lng query parameters are required',
        },
        { status: 400 }
      );
    }

    const userLat = parseFloat(latParam);
    const userLng = parseFloat(lngParam);

    if (isNaN(userLat) || isNaN(userLng)) {
      return NextResponse.json(
        {
          success: false,
          error: 'lat and lng must be valid numbers',
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // 4. FETCH ALL CHWs WITH FACILITY INFORMATION
    // ========================================================================
    const chws = await db.user.findMany({
      where: {
        role: 'CHW',
        isActive: true,
        hospitalId: { not: null }, // Must have a hospital assigned
        district: {
          isNot: null, // Must have a district
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        hospitalId: true,
        hospital: {
          select: {
            id: true,
            name: true,
            facility: {
              select: {
                lat: true,
                lng: true,
              },
            },
          },
        },
      },
      take: 100, // Limit to first 100 CHWs for performance
    });

    // ========================================================================
    // 5. CALCULATE DISTANCES AND SORT
    // ========================================================================
    const chwsWithDistance = chws
      .filter((chw) => chw.hospital?.facility && chw.hospital.facility.lat && chw.hospital.facility.lng) // Must have location
      .map((chw) => ({
        id: chw.id,
        name: chw.name,
        phone: chw.phone,
        facilityName: chw.hospital!.name,
        distanceKm: haversineDistanceKm(
          userLat,
          userLng,
          chw.hospital!.facility!.lat!,
          chw.hospital!.facility!.lng!
        ),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 3); // Return top 3 nearest

    // ========================================================================
    // 6. RETURN RESULTS
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        data: chwsWithDistance,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/chws/nearest error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
