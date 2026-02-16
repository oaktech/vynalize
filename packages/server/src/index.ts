import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env'), override: false });

import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { identifyRouter } from './routes/identify.js';
import { videoRouter } from './routes/video.js';
import { searchRouter } from './routes/search.js';
import { attachWebSocket } from './wsRelay.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/identify', identifyRouter);
app.use('/api/video', videoRouter);
app.use('/api/search', searchRouter);

app.post('/api/log', (req, res) => {
  const { tag, msg } = req.body ?? {};
  if (tag && msg) console.log(`[${tag}] ${msg}`);
  res.sendStatus(204);
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/diag', async (_req, res) => {
  const checks: Record<string, string> = {};

  // 1. Shazam (no API key needed)
  checks.shazam = 'node-shazam (no API key required)';

  // 2. YouTube API key
  checks.youtube_key = process.env.YOUTUBE_API_KEY ? `set (${process.env.YOUTUBE_API_KEY.length} chars)` : 'MISSING';

  // 3. ffmpeg (needed for audio format conversion)
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const exec = promisify(execFile);
  try {
    const { stdout } = await exec('ffmpeg', ['-version']);
    checks.ffmpeg = stdout.split('\n')[0];
  } catch {
    checks.ffmpeg = 'NOT FOUND - install with: brew install ffmpeg';
  }

  res.json(checks);
});

// Serve the built frontend in production
const webDist = resolve(__dirname, '../../web/dist');
app.use(express.static(webDist));
app.get('*', (_req, res) => {
  res.sendFile(resolve(webDist, 'index.html'));
});

const server = createServer(app);
attachWebSocket(server);

server.listen(PORT, () => {
  console.log(`[server] Vynalize backend running on port ${PORT}`);

  if (!process.env.YOUTUBE_API_KEY) {
    console.warn('[server] WARNING: YOUTUBE_API_KEY not set - video search will not work');
  }
});
