import { createHash } from 'crypto';
import geoip from 'geoip-lite';
import { dbAvailable, getPool } from './db.js';
import { cacheGet, cacheSet } from './cache.js';

interface SongData {
  title: string;
  artist: string;
  album?: string | null;
  genre?: string | null;
  albumArtUrl?: string | null;
}

export function recordPlay(ip: string, headers: Record<string, string | string[] | undefined>, song: SongData): void {
  if (!dbAvailable) return;

  // Fire-and-forget — errors logged but never thrown
  doRecord(ip, headers, song).catch((err) => {
    console.error('[plays] Failed to record play:', err);
  });
}

/** Best-effort client IP for geo lookup (not security-sensitive) */
function clientIp(ip: string, headers: Record<string, string | string[] | undefined>): string {
  // Cloudflare sets this to the true client IP — most reliable behind CF
  const cfIp = headers['cf-connecting-ip'];
  if (cfIp) {
    const val = Array.isArray(cfIp) ? cfIp[0] : cfIp;
    if (val) return val.trim();
  }

  const xff = headers['x-forwarded-for'];
  if (xff) {
    const first = (Array.isArray(xff) ? xff[0] : xff).split(',')[0].trim();
    if (first) return first;
  }
  return ip;
}

async function doRecord(ip: string, headers: Record<string, string | string[] | undefined>, song: SongData): Promise<void> {
  const dedupKey = `play:${createHash('sha256').update(ip + song.title.toLowerCase() + song.artist.toLowerCase()).digest('hex')}`;

  const existing = await cacheGet(dedupKey);
  if (existing) return; // Already counted within the 5-minute window

  const realIp = clientIp(ip, headers);
  const geo = geoip.lookup(realIp);
  const country = geo?.country || null;

  const pool = getPool();
  if (!pool) return;

  await pool.query(
    `INSERT INTO song_plays (title, artist, album, genre, album_art_url, country)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [song.title, song.artist, song.album || null, song.genre || null, song.albumArtUrl || null, country],
  );

  await cacheSet(dedupKey, '1', 300); // 5-minute TTL
}
