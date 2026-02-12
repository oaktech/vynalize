import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { identifyWithACRCloud } from '../services/acrcloud.js';
import { enrichMetadata } from '../services/musicbrainz.js';

const uploadDir = path.join(os.tmpdir(), 'vinyl-visions-uploads');

// Ensure upload directory exists
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const identifyRouter = Router();

identifyRouter.post('/', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No audio file provided' });
    return;
  }

  const audioPath = req.file.path;
  console.log(`[identify] Received file: ${req.file.size} bytes, mime: ${req.file.mimetype}`);

  try {
    const result = await identifyWithACRCloud(audioPath);

    if (!result) {
      res.json({ match: false });
      return;
    }

    // Try to get album art via MusicBrainz search
    let albumArtUrl: string | null = null;
    try {
      const mbSearch = await searchMusicBrainz(result.artist, result.title);
      if (mbSearch?.albumArtUrl) {
        albumArtUrl = mbSearch.albumArtUrl;
      }
    } catch (err) {
      console.warn('[identify] Album art lookup failed:', err);
    }

    res.json({
      match: true,
      title: result.title,
      artist: result.artist,
      album: result.album,
      duration: result.duration,
      albumArtUrl,
      bpm: null,
    });
  } catch (err) {
    console.error('[identify] Error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Identification failed',
    });
  } finally {
    // Clean up uploaded file
    try {
      await fs.promises.unlink(audioPath);
    } catch {}
  }
});

const MB_API = 'https://musicbrainz.org/ws/2';
const CAA_URL = 'https://coverartarchive.org';
const USER_AGENT = 'VinylVisions/0.1.0 (https://github.com/vinyl-visions)';

async function searchMusicBrainz(
  artist: string,
  title: string
): Promise<{ albumArtUrl: string | null } | null> {
  const query = `recording:"${title}" AND artist:"${artist}"`;
  const params = new URLSearchParams({ query, fmt: 'json', limit: '3' });

  const mbRes = await fetch(`${MB_API}/recording?${params}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });

  if (!mbRes.ok) return null;

  const data = (await mbRes.json()) as {
    recordings?: Array<{
      releases?: Array<{
        'release-group'?: { id: string };
      }>;
    }>;
  };

  const releases = data.recordings?.[0]?.releases || [];
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
          return {
            albumArtUrl:
              front.thumbnails?.['250'] ||
              front.thumbnails?.small ||
              front.image,
          };
        }
      }
    } catch {}
  }

  return null;
}
