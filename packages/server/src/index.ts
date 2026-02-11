import express from 'express';
import cors from 'cors';
import { identifyRouter } from './routes/identify.js';
import { videoRouter } from './routes/video.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/identify', identifyRouter);
app.use('/api/video', videoRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
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
