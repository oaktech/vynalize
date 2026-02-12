import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { recognizeSong } from '../services/shazam.js';

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
    const result = await recognizeSong(audioPath);

    if (!result) {
      console.log('[identify] No match found');
      res.json({ match: false });
      return;
    }

    console.log(`[identify] Match: "${result.title}" by ${result.artist}`);

    res.json({
      match: true,
      title: result.title,
      artist: result.artist,
      album: result.album,
      duration: 0,
      musicbrainzId: null,
      albumArtUrl: result.albumArtUrl,
      bpm: null,
    });
  } catch (err) {
    console.error('[identify] Error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Identification failed',
    });
  } finally {
    try {
      await fs.promises.unlink(audioPath);
    } catch {}
  }
});
