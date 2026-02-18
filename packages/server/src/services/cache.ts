import { getRedis } from './redis.js';

// In-memory LRU fallback when Redis is unavailable
const LRU_MAX = 500;
const localCache = new Map<string, { value: string; expiresAt: number }>();

function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of localCache) {
    if (entry.expiresAt <= now) localCache.delete(key);
  }
  // If still over limit, remove oldest entries
  if (localCache.size > LRU_MAX) {
    const excess = localCache.size - LRU_MAX;
    const iter = localCache.keys();
    for (let i = 0; i < excess; i++) {
      const { value } = iter.next();
      if (value) localCache.delete(value);
    }
  }
}

function normalizeKey(key: string): string {
  return key.toLowerCase().trim().replace(/\s+/g, ' ');
}

export async function cacheGet(key: string): Promise<string | null> {
  const nk = normalizeKey(key);
  const redis = getRedis();
  if (redis) {
    return redis.get(nk);
  }
  const entry = localCache.get(nk);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    localCache.delete(nk);
    return null;
  }
  return entry.value;
}

export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<void> {
  const nk = normalizeKey(key);
  const redis = getRedis();
  if (redis) {
    await redis.set(nk, value, 'EX', ttlSeconds);
    return;
  }
  evictExpired();
  localCache.set(nk, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function cacheIncr(
  key: string,
  ttlSeconds: number,
): Promise<number> {
  const nk = normalizeKey(key);
  const redis = getRedis();
  if (redis) {
    const val = await redis.incr(nk);
    if (val === 1) await redis.expire(nk, ttlSeconds);
    return val;
  }
  // In-memory fallback
  const entry = localCache.get(nk);
  const now = Date.now();
  if (!entry || entry.expiresAt <= now) {
    localCache.set(nk, { value: '1', expiresAt: now + ttlSeconds * 1000 });
    return 1;
  }
  const next = parseInt(entry.value, 10) + 1;
  entry.value = String(next);
  return next;
}
