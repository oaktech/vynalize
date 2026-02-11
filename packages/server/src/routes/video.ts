import { Router } from 'express';

const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search';

export const videoRouter = Router();

// Simple in-memory cache for video searches
const videoCache = new Map<string, { videoId: string; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

videoRouter.get('/search', async (req, res) => {
  const { artist, title } = req.query;

  if (!artist || !title) {
    res.status(400).json({ error: 'artist and title query params required' });
    return;
  }

  const cacheKey = `${artist}::${title}`;

  // Check cache
  const cached = videoCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[video] Cache hit: ${cacheKey}`);
    res.json({ videoId: cached.videoId });
    return;
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'YOUTUBE_API_KEY not configured' });
    return;
  }

  try {
    const query = `${artist} ${title} official music video`;
    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      videoCategoryId: '10', // Music category
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
    videoCache.set(cacheKey, { videoId, timestamp: Date.now() });

    res.json({ videoId });
  } catch (err) {
    console.error('[video] Error:', err);
    res.status(500).json({ error: 'Video search failed' });
  }
});
