import type { Request, Response, NextFunction } from 'express';
import { getRedis } from '../services/redis.js';

// In-memory fallback sliding window
const localWindows = new Map<string, number[]>();
const MAX_LOCAL_KEYS = 10_000;

// Periodic cleanup of expired in-memory entries
let cleanupScheduled = false;
function scheduleCleanup(windowMs: number) {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of localWindows) {
      // Remove expired entries
      while (timestamps.length > 0 && timestamps[0] <= now - windowMs) {
        timestamps.shift();
      }
      // Remove empty keys
      if (timestamps.length === 0) {
        localWindows.delete(key);
      }
    }
  }, 60_000);
}

interface RateLimitOptions {
  keyPrefix: string;
  windowMs: number;
  maxRequests: number;
  keyExtractor?: (req: Request) => string;
}

export function createRateLimit(opts: RateLimitOptions) {
  const { keyPrefix, windowMs, maxRequests, keyExtractor } = opts;
  const extractKey = keyExtractor ?? ((req: Request) => req.ip ?? 'unknown');

  scheduleCleanup(windowMs);

  return async (req: Request, res: Response, next: NextFunction) => {
    const clientKey = extractKey(req);
    const fullKey = `ratelimit:${keyPrefix}:${clientKey}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    const redis = getRedis();
    if (redis) {
      try {
        const pipeline = redis.pipeline();
        pipeline.zremrangebyscore(fullKey, 0, windowStart);
        pipeline.zadd(fullKey, now, `${now}:${Math.random()}`);
        pipeline.zcard(fullKey);
        pipeline.pexpire(fullKey, windowMs);
        const results = await pipeline.exec();

        const count = results?.[2]?.[1] as number;
        if (count > maxRequests) {
          const retryAfter = Math.ceil(windowMs / 1000);
          res.set('Retry-After', String(retryAfter));
          res.status(429).json({ error: 'Too many requests' });
          return;
        }

        next();
        return;
      } catch {
        // Fall through to in-memory on Redis error
      }
    }

    // Evict oldest entries if map is too large
    if (localWindows.size >= MAX_LOCAL_KEYS && !localWindows.has(fullKey)) {
      const oldest = localWindows.keys().next().value;
      if (oldest) localWindows.delete(oldest);
    }

    // In-memory fallback
    let timestamps = localWindows.get(fullKey);
    if (!timestamps) {
      timestamps = [];
      localWindows.set(fullKey, timestamps);
    }
    // Remove expired entries
    while (timestamps.length > 0 && timestamps[0] <= windowStart) {
      timestamps.shift();
    }
    timestamps.push(now);

    if (timestamps.length > maxRequests) {
      const retryAfter = Math.ceil(windowMs / 1000);
      res.set('Retry-After', String(retryAfter));
      res.status(429).json({ error: 'Too many requests' });
      return;
    }

    next();
  };
}
