// ─────────────────────────────────────────────────────────
// Vehicle Cache — cache-aside layer for vehicle search
// ─────────────────────────────────────────────────────────
// All functions are safe to call even when Redis is down —
// they return null/void and let the caller fall through to MySQL.
//
// Uses ioredis (native TCP), NOT @upstash/redis (HTTP REST).
// ioredis does NOT auto-serialize objects, so we JSON.stringify
// before SET and JSON.parse after GET.

const { getRedis } = require('../config/redis');

const CACHE_PREFIX = 'vehicles';
const DEFAULT_TTL = 90; // seconds

/**
 * Build a deterministic cache key from query parameters.
 *
 * Key format: vehicles:status=AVAILABLE:category=ALL:page=1:limit=10
 *
 * Every parameter that affects the result set is encoded.
 * Missing category → "ALL" (not "undefined").
 */
function buildCacheKey({ status = 'AVAILABLE', category, page = 1, limit = 10 }) {
  const cat = category || 'ALL';
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  return `${CACHE_PREFIX}:status=${status}:category=${cat}:page=${p}:limit=${l}`;
}

/**
 * Try to get cached vehicle data.
 * Returns parsed JSON on hit, null on miss or Redis error.
 */
async function getCachedVehicles(key) {
  try {
    const redis = getRedis();
    if (!redis) return null;

    const cached = await redis.get(key);
    if (!cached) return null;

    // ioredis returns raw strings — we must parse manually
    return JSON.parse(cached);
  } catch (err) {
    console.warn('[VehicleCache] ⚠️  Redis GET failed:', err.message);
    return null;
  }
}

/**
 * Cache vehicle search results with a TTL.
 * Silently fails if Redis is down.
 */
async function setCachedVehicles(key, data, ttl = DEFAULT_TTL) {
  try {
    const redis = getRedis();
    if (!redis) return;

    // ioredis requires string values — serialize to JSON
    await redis.set(key, JSON.stringify(data), 'EX', ttl);
  } catch (err) {
    console.warn('[VehicleCache] ⚠️  Redis SET failed:', err.message);
  }
}

/**
 * Invalidate all cached vehicle search results.
 *
 * Called after vehicle create/update/delete.
 * Uses SCAN + DEL (not KEYS) for safety, but with our
 * small key space (~50-100 keys max) this is instant.
 */
async function invalidateVehicleCache() {
  try {
    const redis = getRedis();
    if (!redis) return;

    // ioredis scan: redis.scan(cursor, 'MATCH', pattern, 'COUNT', count)
    // returns [nextCursor, keys] where nextCursor is a string
    let cursor = '0';
    let totalDeleted = 0;

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH', `${CACHE_PREFIX}:*`,
        'COUNT', 100
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
        totalDeleted += keys.length;
      }
    } while (cursor !== '0');

    if (totalDeleted > 0) {
      console.log(`[VehicleCache] 🗑️  Invalidated ${totalDeleted} cached key(s)`);
    }
  } catch (err) {
    console.warn('[VehicleCache] ⚠️  Cache invalidation failed:', err.message);
  }
}

module.exports = {
  buildCacheKey,
  getCachedVehicles,
  setCachedVehicles,
  invalidateVehicleCache,
};
