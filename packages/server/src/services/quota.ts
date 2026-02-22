import { getPool } from './db.js';
import { cacheGet, cacheSet } from './cache.js';

const DEFAULT_DAILY_LIMIT = 50;
const CACHE_TTL = 300; // 5 minutes

export async function checkAndIncrementQuota(
  userId: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const limit = DEFAULT_DAILY_LIMIT;

  // Fast path: check cache first
  const cacheKey = `quota:user:${userId}:${today()}`;
  const cached = await cacheGet(cacheKey);
  if (cached !== null) {
    const count = parseInt(cached, 10);
    if (count >= limit) {
      return { allowed: false, remaining: 0 };
    }
  }

  // Persist to database
  const pool = getPool()!;
  const { rows } = await pool.query(
    `INSERT INTO user_quota (user_id, quota_date, search_count)
     VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (user_id, quota_date) DO UPDATE SET
       search_count = user_quota.search_count + 1
     RETURNING search_count`,
    [userId],
  );

  const count = rows[0].search_count as number;
  const remaining = Math.max(0, limit - count);

  // Update cache
  await cacheSet(cacheKey, String(count), CACHE_TTL);

  return { allowed: count <= limit, remaining };
}

export async function getQuotaUsage(
  userId: number,
): Promise<{ used: number; limit: number }> {
  const pool = getPool();
  if (!pool) return { used: 0, limit: DEFAULT_DAILY_LIMIT };

  const { rows } = await pool.query(
    'SELECT search_count FROM user_quota WHERE user_id = $1 AND quota_date = CURRENT_DATE',
    [userId],
  );

  const used = rows.length > 0 ? (rows[0].search_count as number) : 0;
  return { used, limit: DEFAULT_DAILY_LIMIT };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
