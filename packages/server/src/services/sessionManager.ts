import crypto from 'crypto';
import { getRedis } from './redis.js';

const SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds

// In-memory fallback when Redis is unavailable
const localSessions = new Map<string, { createdAt: number }>();
const localState = new Map<string, string>();

export function createSession(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 for readability
  const bytes = crypto.randomBytes(6);
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[bytes[i] % chars.length];

  const redis = getRedis();
  if (redis) {
    redis.hset(`ws:session:${id}`, 'createdAt', Date.now().toString());
    redis.expire(`ws:session:${id}`, SESSION_TTL);
  } else {
    localSessions.set(id, { createdAt: Date.now() });
  }

  return id;
}

export async function sessionExists(id: string): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    const exists = await redis.exists(`ws:session:${id}`);
    return exists === 1;
  }
  return localSessions.has(id);
}

export async function cacheState(
  sessionId: string,
  type: 'state' | 'song' | 'beat',
  data: string,
): Promise<void> {
  const redis = getRedis();
  const key = `ws:session:${sessionId}:${type}`;
  if (redis) {
    await redis.set(key, data, 'EX', SESSION_TTL);
  } else {
    localState.set(key, data);
  }
}

export async function getState(
  sessionId: string,
): Promise<{ state: string | null; song: string | null; beat: string | null }> {
  const redis = getRedis();
  if (redis) {
    const [state, song, beat] = await Promise.all([
      redis.get(`ws:session:${sessionId}:state`),
      redis.get(`ws:session:${sessionId}:song`),
      redis.get(`ws:session:${sessionId}:beat`),
    ]);
    return { state, song, beat };
  }
  return {
    state: localState.get(`ws:session:${sessionId}:state`) ?? null,
    song: localState.get(`ws:session:${sessionId}:song`) ?? null,
    beat: localState.get(`ws:session:${sessionId}:beat`) ?? null,
  };
}

export async function touchSession(sessionId: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    const keys = [
      `ws:session:${sessionId}`,
      `ws:session:${sessionId}:state`,
      `ws:session:${sessionId}:song`,
      `ws:session:${sessionId}:beat`,
    ];
    await Promise.all(keys.map((k) => redis.expire(k, SESSION_TTL)));
  }
}
