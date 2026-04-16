/**
 * Rate Limiting Helper for API endpoints
 * Implements per-user rate limiting using in-memory tracking
 */

const RATE_LIMIT_MESSAGES_PER_HOUR = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour in milliseconds

interface RateLimitEntry {
  count: number;
  firstRequestTime: number;
}

// In-memory store for rate limit tracking
// Key: userId, Value: { count, firstRequestTime }
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Track a message from a user and check if they've exceeded the rate limit
 * 
 * @param userId - The ID of the user making the request
 * @returns Object with allowed (boolean), remaining (number), and resetTime (timestamp)
 */
export function trackMessage(userId: string): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (!entry) {
    // First request from this user
    rateLimitStore.set(userId, {
      count: 1,
      firstRequestTime: now,
    });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MESSAGES_PER_HOUR - 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  const timeSinceFirstRequest = now - entry.firstRequestTime;

  if (timeSinceFirstRequest > RATE_LIMIT_WINDOW_MS) {
    // Window has expired, reset the counter
    rateLimitStore.set(userId, {
      count: 1,
      firstRequestTime: now,
    });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MESSAGES_PER_HOUR - 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  // Within the same window
  if (entry.count >= RATE_LIMIT_MESSAGES_PER_HOUR) {
    // Rate limit exceeded
    const resetTime = entry.firstRequestTime + RATE_LIMIT_WINDOW_MS;
    return {
      allowed: false,
      remaining: 0,
      resetTime,
    };
  }

  // Increment the counter
  entry.count += 1;
  const resetTime = entry.firstRequestTime + RATE_LIMIT_WINDOW_MS;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MESSAGES_PER_HOUR - entry.count,
    resetTime,
  };
}

/**
 * Check if a user has exceeded the rate limit without incrementing the counter
 * 
 * @param userId - The ID of the user
 * @returns true if the user has exceeded the rate limit
 */
export function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (!entry) {
    return false;
  }

  const timeSinceFirstRequest = now - entry.firstRequestTime;

  if (timeSinceFirstRequest > RATE_LIMIT_WINDOW_MS) {
    return false;
  }

  return entry.count >= RATE_LIMIT_MESSAGES_PER_HOUR;
}

/**
 * Get the current rate limit status for a user
 * 
 * @param userId - The ID of the user
 * @returns Object with used (count), limit, and resetAt (timestamp)
 */
export function getRateLimitStatus(userId: string): {
  used: number;
  limit: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (!entry) {
    return {
      used: 0,
      limit: RATE_LIMIT_MESSAGES_PER_HOUR,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  const timeSinceFirstRequest = now - entry.firstRequestTime;

  if (timeSinceFirstRequest > RATE_LIMIT_WINDOW_MS) {
    return {
      used: 0,
      limit: RATE_LIMIT_MESSAGES_PER_HOUR,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  const resetAt = entry.firstRequestTime + RATE_LIMIT_WINDOW_MS;
  return {
    used: entry.count,
    limit: RATE_LIMIT_MESSAGES_PER_HOUR,
    resetAt,
  };
}

/**
 * Export the rate limit constant
 */
export { RATE_LIMIT_MESSAGES_PER_HOUR, RATE_LIMIT_WINDOW_MS };
