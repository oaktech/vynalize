import { Router } from 'express';
import { cacheGet, cacheSet, cacheIncr } from '../services/cache.js';
import { createRateLimit } from '../middleware/rateLimit.js';
import { getSettings } from '../services/settings.js';

const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search';
const CACHE_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
const QUOTA_TTL = 48 * 60 * 60; // 48 hours in seconds
const QUOTA_LIMIT = 9000;

export const videoRouter = Router();

videoRouter.get(
  '/search',
  createRateLimit({ keyPrefix: 'video', windowMs: 60_000, maxRequests: 10 }),
  async (req, res) => {
    const { artist, title } = req.query;

    if (!artist || !title) {
      res.status(400).json({ error: 'artist and title query params required' });
      return;
    }

    const cacheKey = `cache:video:${artist}::${title}`;

    // Check Redis/local cache
    const cached = await cacheGet(cacheKey);
    if (cached !== null) {
      console.log(`[video] Cache hit: ${artist} - ${title}`);
      res.json({ videoId: cached });
      return;
    }

    const apiKey = getSettings().youtubeApiKey;
    if (!apiKey) {
      res.status(500).json({ error: 'YOUTUBE_API_KEY not configured' });
      return;
    }

    // Check YouTube quota before making API call
    const today = new Date().toISOString().slice(0, 10);
    const quotaCount = await cacheIncr(`quota:youtube:${today}`, QUOTA_TTL);
    if (quotaCount > QUOTA_LIMIT) {
      console.warn('[video] YouTube API daily quota exceeded');
      res.status(429).json({ error: 'YouTube API quota exceeded for today' });
      return;
    }

    try {
      const query = `${artist} ${title} official music video`;
      const params = new URLSearchParams({
        part: 'snippet',
        q: query,
        type: 'video',
        videoCategoryId: '10',
        maxResults: '1',
        key: apiKey,
      });

      console.log(`[video] Searching YouTube: "${query}"`);
      const ytRes = await fetch(`${YOUTUBE_API_URL}?${params}`);

      if (!ytRes.ok) {
        const err = await ytRes.json().catch(() => ({}));
        console.error('[video] YouTube API error:', err);
        res.status(502).json({ error: 'YouTube API error' });
        return;
      }

      const data = (await ytRes.json()) as {
        items?: Array<{ id: { videoId: string } }>;
      };
      const items = data.items || [];

      if (items.length === 0) {
        res.json({ videoId: null });
        return;
      }

      const videoId = items[0].id.videoId;
      console.log(`[video] Found: ${videoId}`);

      // Cache the result
      await cacheSet(cacheKey, videoId, CACHE_TTL);

      res.json({ videoId });
    } catch (err) {
      console.error('[video] Error:', err);
      res.status(500).json({ error: 'Video search failed' });
    }
  },
);
