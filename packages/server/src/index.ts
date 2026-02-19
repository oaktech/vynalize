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
import { settingsRouter } from './routes/settings.js';
import { attachWebSocket } from './wsRelay.js';
import { connectRedis, redisAvailable } from './services/redis.js';
import { initPool, getQueueDepth, getPoolSize } from './services/identifyPool.js';
import { loadSettings, getSettings } from './services/settings.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/identify', identifyRouter);
app.use('/api/video', videoRouter);
app.use('/api/search', searchRouter);
app.use('/api/settings', settingsRouter);

app.post('/api/log', (req, res) => {
  const { tag, msg } = req.body ?? {};
  if (tag && msg) console.log(`[${tag}] ${msg}`);
  res.sendStatus(204);
});

app.get('/api/config', (_req, res) => {
  res.json({
    requireCode: getSettings().requireCode,
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    redis: redisAvailable,
  });
});

app.get('/api/diag', async (_req, res) => {
  const checks: Record<string, string | number | boolean> = {};

  checks.shazam = 'node-shazam (no API key required)';
  const ytKey = getSettings().youtubeApiKey;
  checks.youtube_key = ytKey ? `set (${ytKey.length} chars)` : 'MISSING';

  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const exec = promisify(execFile);
  try {
    const { stdout } = await exec('ffmpeg', ['-version']);
    checks.ffmpeg = stdout.split('\n')[0];
  } catch {
    checks.ffmpeg = 'NOT FOUND - install with: brew install ffmpeg';
  }

  checks.redis = redisAvailable;
  checks.workerPoolSize = getPoolSize();
  checks.identifyQueueDepth = getQueueDepth();
  checks.pid = process.pid;

  res.json(checks);
});

// Serve the built frontend in production
const webDist = resolve(__dirname, '../../web/dist');
app.use(express.static(webDist));
app.get('*', (_req, res) => {
  res.sendFile(resolve(webDist, 'index.html'));
});

async function start() {
  // Connect to Redis (no-op if REDIS_URL not set)
  await connectRedis();

  // Load settings (settings.json overrides .env)
  await loadSettings();

  // Start the identify worker thread pool
  await initPool();

  const server = createServer(app);
  attachWebSocket(server);

  server.listen(PORT, () => {
    const settings = getSettings();
    console.log(`[server] Vynalize backend running on port ${PORT} (pid: ${process.pid})`);
    console.log(`[server] Redis: ${redisAvailable ? 'connected' : 'not available (local-only mode)'}`);
    if (!settings.requireCode) {
      console.log('[server] Session codes DISABLED (open mode) — remote connects without a code');
    }

    if (!settings.youtubeApiKey) {
      console.warn('[server] WARNING: YOUTUBE_API_KEY not set - video search will not work');
    }
  });
}

start().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
