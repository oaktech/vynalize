import { createHash } from 'crypto';
import geoip from 'geoip-lite';
import { dbAvailable, getPool } from './db.js';
import { cacheGet, cacheSet } from './cache.js';

interface SongData {
  title: string;
  artist: string;
  album?: string | null;
  albumArtUrl?: string | null;
}

export function recordPlay(ip: string, song: SongData): void {
  if (!dbAvailable) return;

  // Fire-and-forget — errors logged but never thrown
  doRecord(ip, song).catch((err) => {
    console.error('[plays] Failed to record play:', err);
  });
}

async function doRecord(ip: string, song: SongData): Promise<void> {
  const dedupKey = `play:${createHash('sha256').update(ip + song.title.toLowerCase() + song.artist.toLowerCase()).digest('hex')}`;

  const existing = await cacheGet(dedupKey);
  if (existing) return; // Already counted within the 5-minute window

  // Geolocate IP (returns null for private/localhost IPs)
  const geo = geoip.lookup(ip);
  const city = geo?.city || null;
  const region = geo?.region || null;
  const country = geo?.country || null;
  const countryCode = geo?.country || null;

  const pool = getPool();
  if (!pool) return;

  await pool.query(
    `INSERT INTO song_plays (title, artist, album, album_art_url, city, region, country, country_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [song.title, song.artist, song.album || null, song.albumArtUrl || null, city, region, country, countryCode],
  );

  await cacheSet(dedupKey, '1', 300); // 5-minute TTL
}
