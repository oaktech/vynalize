import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

import express from 'express';
import cors from 'cors';
import { identifyRouter } from './routes/identify.js';
import { videoRouter } from './routes/video.js';
import { searchRouter } from './routes/search.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/identify', identifyRouter);
app.use('/api/video', videoRouter);
app.use('/api/search', searchRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/diag', async (_req, res) => {
  const checks: Record<string, string> = {};

  // 1. API keys
  checks.acoustid_key = process.env.ACOUSTID_API_KEY ? `set (${process.env.ACOUSTID_API_KEY.length} chars)` : 'MISSING';
  checks.youtube_key = process.env.YOUTUBE_API_KEY ? `set (${process.env.YOUTUBE_API_KEY.length} chars)` : 'MISSING';

  // 2. fpcalc
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const exec = promisify(execFile);
  try {
    const { stdout } = await exec('fpcalc', ['-version']);
    checks.fpcalc = stdout.trim();
  } catch {
    checks.fpcalc = 'NOT FOUND - install with: brew install chromaprint';
  }

  // 3. ffmpeg
  try {
    const { stdout } = await exec('ffmpeg', ['-version']);
    checks.ffmpeg = stdout.split('\n')[0];
  } catch {
    checks.ffmpeg = 'NOT FOUND - install with: brew install ffmpeg';
  }

  // 4. AcoustID connectivity
  try {
    const r = await fetch(`https://api.acoustid.org/v2/lookup?client=${process.env.ACOUSTID_API_KEY}&duration=10&fingerprint=test&meta=recordings`);
    const d = (await r.json()) as { status: string; error?: { message: string } };
    checks.acoustid_api = d.status === 'error' && d.error?.message === 'invalid fingerprint'
      ? 'reachable, key valid'
      : `status: ${d.status}, ${d.error?.message || 'ok'}`;
  } catch (e) {
    checks.acoustid_api = `unreachable: ${(e as Error).message}`;
  }

  res.json(checks);
});

app.listen(PORT, () => {
  console.log(`[server] Vinyl Visions backend running on port ${PORT}`);

  // Check for required env vars
  if (!process.env.ACOUSTID_API_KEY) {
    console.warn('[server] WARNING: ACOUSTID_API_KEY not set - song identification will not work');
  }
  if (!process.env.YOUTUBE_API_KEY) {
    console.warn('[server] WARNING: YOUTUBE_API_KEY not set - video search will not work');
  }
});
