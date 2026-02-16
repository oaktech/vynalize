import { Router } from 'express';

const MB_API = 'https://musicbrainz.org/ws/2';
const CAA_URL = 'https://coverartarchive.org';
const USER_AGENT = 'Vynalize/0.1.0 (https://github.com/vynalize)';

export const searchRouter = Router();

interface MBRelease {
  id: string;
  title: string;
  'release-group'?: { id: string; 'primary-type'?: string };
}

searchRouter.get('/', async (req, res) => {
  const { artist, title } = req.query;
  if (!artist || !title) {
    res.status(400).json({ error: 'artist and title required' });
    return;
  }

  try {
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

    // Prefer studio album releases over live/compilation
    const releases = rec.releases || [];
    const studioRelease = releases.find(
      (r) => r['release-group']?.['primary-type'] === 'Album'
    );
    const bestRelease = studioRelease || releases[0];

    const album = bestRelease?.title || '';
    const releaseGroupId = bestRelease?.['release-group']?.id;
    const duration = rec.length ? Math.round(rec.length / 1000) : 0;

    // Try album art from Cover Art Archive — try multiple release groups
    let albumArtUrl: string | null = null;
    const releaseGroupIds = [
      ...new Set(
        releases
          .map((r) => r['release-group']?.id)
          .filter((id): id is string => !!id)
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

    console.log(`[search] Found: "${rec.title}" by ${rec['artist-credit']?.map((a) => a.name).join(', ')}, album: ${album}, art: ${albumArtUrl ? 'yes' : 'no'}`);

    res.json({
      title: rec.title,
      artist: rec['artist-credit']?.map((a) => a.name).join(', ') || artist,
      album,
      duration,
      musicbrainzId: rec.id,
      albumArtUrl,
    });
  } catch (err) {
    console.error('[search] Error:', err);
    res.json({ title, artist, album: '', albumArtUrl: null });
  }
});
