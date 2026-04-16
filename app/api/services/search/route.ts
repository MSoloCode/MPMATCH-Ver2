import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/services/search
 * Search for healthcare service providers by service name, district, and location
 *
 * Query Parameters:
 * - service (required): Service name to search for (substring match, case-insensitive)
 * - districtId (optional): Filter by district ID (pass "all" to skip filtering)
 * - lat (optional): User's latitude for distance calculation
 * - lng (optional): User's longitude for distance calculation
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 1,
 *       "name": "Kampala Ultrasound Center",
 *       "services": ["Ultrasound", "Lab Tests"],
 *       "distance": 3.2,
 *       "address": "Kampala District",
 *       "phone": "+256701234567",
 *       "lat": 0.1234,
 *       "lng": 32.5678
 *     }
 *   ]
 * }
 *
 * Response on error (400/500):
 * {
 *   "success": false,
 *   "error": "Error message"
 * }
 */

// Haversine distance formula - calculates distance between two coordinates in km
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

// Parse JSON service menu safely
function parseServiceMenu(serviceMenuJson: string | null): string[] {
  if (!serviceMenuJson) return [];
  try {
    const parsed = JSON.parse(serviceMenuJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

// Check if service search term matches provider name or any service in serviceMenu
function matchesService(
  providerName: string,
  serviceMenuJson: string | null,
  searchTerm: string
): boolean {
  const searchLower = searchTerm.toLowerCase().trim();

  // Check provider name
  if (providerName.toLowerCase().includes(searchLower)) {
    return true;
  }

  // Check serviceMenu array
  const services = parseServiceMenu(serviceMenuJson);
  return services.some((service) => service.toLowerCase().includes(searchLower));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const service = searchParams.get('service');
    const districtId = searchParams.get('districtId');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    // Validate required parameter
    if (!service || !service.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Service parameter is required',
        },
        { status: 400 }
      );
    }

    // Parse and validate optional parameters
    let userLat: number | null = null;
    let userLng: number | null = null;
    let hasLocation = false;

    if (lat && lng) {
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);

      if (isNaN(parsedLat) || isNaN(parsedLng)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid latitude or longitude values',
          },
          { status: 400 }
        );
      }

      userLat = parsedLat;
      userLng = parsedLng;
      hasLocation = true;
    }

    // Build where clause for filtering
    const where: any = {};

    // If districtId is provided and not "all", filter by it
    if (districtId && districtId !== 'all' && districtId.trim()) {
      const parsedDistrictId = parseInt(districtId, 10);
      if (isNaN(parsedDistrictId)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid districtId',
          },
          { status: 400 }
        );
      }
      where.districtId = parsedDistrictId;
    }

    // Fetch all matching providers from database
    const providers = await db.serviceProvider.findMany({
      where,
      select: {
        id: true,
        name: true,
        districtId: true,
        address: true,
        phone: true,
        serviceMenu: true,
        lat: true,
        lng: true,
      },
    });

    // Filter by service name (substring match, case-insensitive)
    const filteredProviders = providers.filter((provider) =>
      matchesService(provider.name, provider.serviceMenu, service)
    );

    // Format response data
    const data = filteredProviders.map((provider) => {
      const services = parseServiceMenu(provider.serviceMenu);
      const result: any = {
        id: provider.id,
        name: provider.name,
        services: services.length > 0 ? services : [],
        address: provider.address || 'Not available',
        phone: provider.phone || 'Not available',
        lat: provider.lat,
        lng: provider.lng,
      };

      // Add distance if location provided
      if (hasLocation && provider.lat && provider.lng && userLat && userLng) {
        result.distance = calculateDistance(userLat, userLng, provider.lat, provider.lng);
      }

      return result;
    });

    return NextResponse.json(
      {
        success: true,
        data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error searching service providers:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search service providers',
      },
      { status: 500 }
    );
  }
}
