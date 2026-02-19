import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import { submitJob } from '../services/identifyPool.js';
import { createRateLimit } from '../middleware/rateLimit.js';
import { recordPlay } from '../services/plays.js';

const ALLOWED_AUDIO_MIMES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/wav',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-wav',
  'audio/wave',
]);

const upload = multer({
  dest: path.join(os.tmpdir(), 'vynalize-uploads'),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_AUDIO_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only audio files are accepted.`));
    }
  },
});

export const identifyRouter = Router();

identifyRouter.post(
  '/',
  createRateLimit({ keyPrefix: 'identify', windowMs: 60_000, maxRequests: 5 }),
  (req, res, next) => {
    upload.single('audio')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: 'File too large. Maximum size is 3MB.' });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No audio file provided' });
      return;
    }

    // Worker owns temp file cleanup now
    const audioPath = req.file.path;
    console.log(`[identify] Received file: ${req.file.size} bytes, mime: ${req.file.mimetype}`);

    try {
      const result = await submitJob(audioPath);

      if (!result) {
        console.log('[identify] No match found');
        res.json({ match: false });
        return;
      }

      console.log(`[identify] Match: "${result.title}" by ${result.artist}`);

      recordPlay(req.ip ?? '127.0.0.1', {
        title: result.title,
        artist: result.artist,
        album: result.album,
        albumArtUrl: result.albumArtUrl,
      });

      res.json({
        match: true,
        title: result.title,
        artist: result.artist,
        album: result.album,
        duration: 0,
        musicbrainzId: null,
        albumArtUrl: result.albumArtUrl,
        bpm: null,
        offsetMs: result.offsetMs,
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'Server overloaded') {
        res.status(503).json({ error: 'Server overloaded, try again shortly' });
        return;
      }
      console.error('[identify] Error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Identification failed',
      });
    }
  },
);
