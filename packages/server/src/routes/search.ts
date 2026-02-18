import { Router } from 'express';
import { cacheGet, cacheSet } from '../services/cache.js';
import { getRedis } from '../services/redis.js';
import { createRateLimit } from '../middleware/rateLimit.js';

const MB_API = 'https://musicbrainz.org/ws/2';
const CAA_URL = 'https://coverartarchive.org';
const USER_AGENT = 'Vynalize/0.1.0 (https://github.com/vynalize)';
const CACHE_TTL = 7 * 24 * 60 * 60; // 7 days

export const searchRouter = Router();

interface MBRelease {
  id: string;
  title: string;
  'release-group'?: { id: string; 'primary-type'?: string };
}

/** MusicBrainz global rate limiter — max 1 request per 1.1s across all instances */
async function acquireMbToken(): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    const result = await redis.set('ratelimit:mb:global', Date.now().toString(), 'PX', 1100, 'NX');
    return result === 'OK';
  }
  return true;
}

async function waitForMbToken(maxRetries = 5): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    if (await acquireMbToken()) return;
    await new Promise((r) => setTimeout(r, 300));
  }
}

searchRouter.get(
  '/',
  createRateLimit({ keyPrefix: 'search', windowMs: 60_000, maxRequests: 10 }),
  async (req, res) => {
    const { artist, title } = req.query;
    if (!artist || !title) {
      res.status(400).json({ error: 'artist and title required' });
      return;
    }

    const cacheKey = `cache:search:${artist}::${title}`;

    // Check cache first
    const cached = await cacheGet(cacheKey);
    if (cached) {
      console.log(`[search] Cache hit: ${artist} - ${title}`);
      res.json(JSON.parse(cached));
      return;
    }

    try {
      await waitForMbToken();

      const query = `recording:"${title}" AND artist:"${artist}"`;
      const params = new URLSearchParams({
        query,
        fmt: 'json',
        limit: '5',
      });

      const mbRes = await fetch(`${MB_API}/recording?${params}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });

      if (!mbRes.ok) {
        res.json({ title, artist, album: '', albumArtUrl: null });
        return;
      }

      const data = (await mbRes.json()) as {
        recordings?: Array<{
          id: string;
          title: string;
          'artist-credit'?: Array<{ name: string }>;
          releases?: MBRelease[];
          length?: number;
        }>;
      };

      const rec = data.recordings?.[0];
      if (!rec) {
        res.json({ title, artist, album: '', albumArtUrl: null });
        return;
      }

      const releases = rec.releases || [];
      const studioRelease = releases.find(
        (r) => r['release-group']?.['primary-type'] === 'Album',
      );
      const bestRelease = studioRelease || releases[0];

      const album = bestRelease?.title || '';
      const duration = rec.length ? Math.round(rec.length / 1000) : 0;

      // Try album art from Cover Art Archive
      let albumArtUrl: string | null = null;
      const releaseGroupIds = [
        ...new Set(
          releases
            .map((r) => r['release-group']?.id)
            .filter((id): id is string => !!id),
        ),
      ];

      for (const rgId of releaseGroupIds.slice(0, 3)) {
        try {
          const caaRes = await fetch(`${CAA_URL}/release-group/${rgId}`, {
            headers: { 'User-Agent': USER_AGENT },
          });
          if (caaRes.ok) {
            const caaData = (await caaRes.json()) as {
              images?: Array<{
                front: boolean;
                image: string;
                thumbnails?: Record<string, string>;
              }>;
            };
            const front = caaData.images?.find((img) => img.front);
            if (front) {
              albumArtUrl =
                front.thumbnails?.['250'] ||
                front.thumbnails?.small ||
                front.image;
              break;
            }
          }
        } catch {}
      }

      console.log(
        `[search] Found: "${rec.title}" by ${rec['artist-credit']?.map((a) => a.name).join(', ')}, album: ${album}, art: ${albumArtUrl ? 'yes' : 'no'}`,
      );

      const result = {
        title: rec.title,
        artist: rec['artist-credit']?.map((a) => a.name).join(', ') || artist,
        album,
        duration,
        musicbrainzId: rec.id,
        albumArtUrl,
      };

      // Cache the result
      await cacheSet(cacheKey, JSON.stringify(result), CACHE_TTL);

      res.json(result);
    } catch (err) {
      console.error('[search] Error:', err);
      res.json({ title, artist, album: '', albumArtUrl: null });
    }
  },
);
