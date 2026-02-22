import session from 'express-session';
import type { RequestHandler } from 'express';
import { getRedis } from './redis.js';
import { getPool } from './db.js';

export async function createSessionMiddleware(): Promise<RequestHandler> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    console.error('[auth] SESSION_SECRET must be at least 32 characters');
    process.exit(1);
  }

  const isProd = process.env.NODE_ENV === 'production';

  const opts: session.SessionOptions = {
    secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  };

  // Try Redis first, then PostgreSQL, then memory
  const redis = getRedis();
  if (redis) {
    const { RedisStore } = await import('connect-redis');
    opts.store = new RedisStore({ client: redis as any, prefix: 'sess:' });
    console.log('[session] Using Redis session store');
  } else {
    const pool = getPool();
    if (pool) {
      const pgSimple = await import('connect-pg-simple');
      const PgSession = pgSimple.default(session);
      opts.store = new PgSession({ pool, tableName: 'session' });
      console.log('[session] Using PostgreSQL session store');
    } else {
      console.warn('[session] Using in-memory session store (not suitable for production)');
    }
  }

  return session(opts);
}
