import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import { generateFingerprint, cleanupFile } from '../services/fingerprint.js';
import { lookupFingerprint } from '../services/acoustid.js';
import { enrichMetadata } from '../services/musicbrainz.js';

const upload = multer({
  dest: path.join(os.tmpdir(), 'vinyl-visions-uploads'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
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
    // Step 1: Generate fingerprint with fpcalc
    console.log('[identify] Generating fingerprint...');
    const { duration, fingerprint } = await generateFingerprint(audioPath);
    console.log(`[identify] Fingerprint generated (duration: ${duration}s)`);

    // Step 2: Lookup on AcoustID
    console.log('[identify] Looking up on AcoustID...');
    const lookup = await lookupFingerprint(fingerprint, duration);

    if (!lookup) {
      console.log('[identify] No match found');
      res.json({ match: false });
      return;
    }

    console.log(`[identify] Match: "${lookup.title}" by ${lookup.artist}`);

    // Step 3: Enrich with MusicBrainz + Cover Art
    let albumArtUrl: string | null = null;
    let bpm: number | null = null;

    if (lookup.musicbrainzId) {
      try {
        const enriched = await enrichMetadata(
          lookup.musicbrainzId,
          lookup.releaseGroupId
        );
        albumArtUrl = enriched.albumArtUrl;
        bpm = enriched.bpm;
      } catch (err) {
        console.warn('[identify] Enrichment failed:', err);
      }
    }

    res.json({
      match: true,
      title: lookup.title,
      artist: lookup.artist,
      album: lookup.album,
      duration: lookup.duration,
      musicbrainzId: lookup.musicbrainzId,
      albumArtUrl,
      bpm,
    });
  } catch (err) {
    console.error('[identify] Error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Identification failed',
    });
  } finally {
    await cleanupFile(audioPath);
  }
});
