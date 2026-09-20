// ─────────────────────────────────────────────────────────
// Redis Client — ioredis (native TCP, sub-ms latency)
// ─────────────────────────────────────────────────────────
// Connects via native Redis protocol (not HTTP/REST).
// Works with local Redis, Docker Redis, or any Redis server.
//
// Env vars:
//   REDIS_HOST     — default "localhost"
//   REDIS_PORT     — default 6379
//   REDIS_PASSWORD — optional, for production
//
// Graceful fallback: if Redis is unreachable, all cache
// operations silently return null and the app falls through
// to MySQL. A Redis outage should NEVER break the app.

const Redis = require('ioredis');

let redis = null;
let isReady = false;

try {
  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT, 10) || 6379;
  const password = process.env.REDIS_PASSWORD || undefined;

  redis = new Redis({
    host,
    port,
    password,
    maxRetriesPerRequest: 1,          // fail fast, don't block the request
    retryStrategy(times) {
      if (times > 3) return null;     // stop retrying after 3 attempts
      return Math.min(times * 200, 2000);
    },
    lazyConnect: false,               // connect immediately
    enableOfflineQueue: false,        // don't queue commands when disconnected
  });

  redis.on('connect', () => {
    isReady = true;
    console.log(`[Redis] ✅ Connected to ${host}:${port}`);
  });

  redis.on('error', (err) => {
    if (isReady) {
      console.warn('[Redis] ⚠️  Connection error:', err.message);
    }
    isReady = false;
  });

  redis.on('close', () => {
    isReady = false;
  });

  redis.on('reconnecting', () => {
    console.log('[Redis] 🔄 Reconnecting...');
  });

} catch (err) {
  console.warn('[Redis] ⚠️  Failed to initialize Redis client:', err.message);
}

/**
 * Returns the Redis client, or null if Redis is unavailable.
 * All callers must handle null gracefully.
 */
function getRedis() {
  return isReady ? redis : null;
}

module.exports = { getRedis };
