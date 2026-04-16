import { LRUCache } from "lru-cache";
import { db } from "./db";
import { ServiceProvider } from "@prisma/client";

/**
 * Service provider with calculated distance in kilometers
 */
export interface ServiceProviderWithDistance extends ServiceProvider {
  distanceKm: number;
}

/**
 * LRU cache for storing provider query results
 * - Max 200 entries
 * - 10 minute TTL (600,000 ms)
 * - Key format: "{lat}|{lng}|{serviceQuery}"
 */
const cache = new LRUCache<string, ServiceProviderWithDistance[]>({
  max: 200,
  ttl: 1000 * 60 * 10, // 10 minutes in milliseconds
});

/**
 * Calculates the distance in kilometers between two GPS coordinates
 * using the Haversine formula.
 *
 * @param lat1 - Latitude of first point
 * @param lng1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lng2 - Longitude of second point
 * @returns Distance in kilometers
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const EARTH_RADIUS_KM = 6371; // Earth's radius in kilometers

  // Convert degrees to radians
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Queries ServiceProvider table for providers whose serviceMenu array
 * contains a case-insensitive match for serviceQuery.
 *
 * @param lat - Latitude for distance calculation
 * @param lng - Longitude for distance calculation
 * @param serviceQuery - Service name to search for (case-insensitive)
 * @param limit - Maximum number of results to return (default: 10)
 * @returns Providers sorted by distance ascending, limited to `limit` results
 *
 * Results are cached for 10 minutes per lat+lng+serviceQuery key using an
 * in-memory LRU cache (max 200 entries).
 */
export async function getNearestProviders(
  lat: number,
  lng: number,
  serviceQuery: string,
  limit: number = 10
): Promise<ServiceProviderWithDistance[]> {
  // Create cache key
  const cacheKey = `${lat}|${lng}|${serviceQuery.toLowerCase()}`;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Query all ServiceProvider records from database
  const providers = await db.serviceProvider.findMany();

  // Filter providers by serviceMenu match (case-insensitive)
  const filteredProviders = providers.filter((provider) => {
    if (!provider.serviceMenu) return false;

    try {
      // Parse serviceMenu JSON array
      const services = JSON.parse(provider.serviceMenu);

      // Check if any service matches the query (case-insensitive)
      if (Array.isArray(services)) {
        return services.some(
          (service) =>
            String(service).toLowerCase().includes(serviceQuery.toLowerCase())
        );
      }
      return false;
    } catch {
      // Invalid JSON - skip this provider
      return false;
    }
  });

  // Calculate distances and add to provider objects
  const providersWithDistance: ServiceProviderWithDistance[] =
    filteredProviders.map((provider) => ({
      ...provider,
      distanceKm: haversineDistanceKm(
        lat,
        lng,
        provider.lat || 0,
        provider.lng || 0
      ),
    }));

  // Sort by distance ascending
  providersWithDistance.sort((a, b) => a.distanceKm - b.distanceKm);

  // Limit results
  const results = providersWithDistance.slice(0, limit);

  // Cache the results
  cache.set(cacheKey, results);

  return results;
}
