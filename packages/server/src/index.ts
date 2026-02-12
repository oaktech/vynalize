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

  checks.acrcloud_host = process.env.ACRCLOUD_HOST || 'MISSING';
  checks.acrcloud_key = process.env.ACRCLOUD_ACCESS_KEY
    ? `set (${process.env.ACRCLOUD_ACCESS_KEY.length} chars)`
    : 'MISSING';
  checks.acrcloud_secret = process.env.ACRCLOUD_ACCESS_SECRET
    ? `set (${process.env.ACRCLOUD_ACCESS_SECRET.length} chars)`
    : 'MISSING';
  checks.youtube_key = process.env.YOUTUBE_API_KEY
    ? `set (${process.env.YOUTUBE_API_KEY.length} chars)`
    : 'MISSING';

  // Test ACRCloud connectivity
  if (process.env.ACRCLOUD_HOST) {
    try {
      const r = await fetch(`https://${process.env.ACRCLOUD_HOST}/v1/identify`, {
        method: 'POST',
      });
      checks.acrcloud_api = r.status === 400 ? 'reachable' : `status: ${r.status}`;
    } catch (e) {
      checks.acrcloud_api = `unreachable: ${(e as Error).message}`;
    }
  }

  res.json(checks);
});

app.listen(PORT, () => {
  console.log(`[server] Vinyl Visions backend running on port ${PORT}`);

  if (!process.env.ACRCLOUD_ACCESS_KEY) {
    console.warn('[server] WARNING: ACRCLOUD_ACCESS_KEY not set - song identification will not work');
  }
  if (!process.env.YOUTUBE_API_KEY) {
    console.warn('[server] WARNING: YOUTUBE_API_KEY not set - video search will not work');
  }
});
