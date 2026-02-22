import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env'), override: false });

import { createServer } from 'http';
import { networkInterfaces } from 'os';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import passport from 'passport';
import { identifyRouter } from './routes/identify.js';
import { videoRouter } from './routes/video.js';
import { searchRouter } from './routes/search.js';
import { settingsRouter } from './routes/settings.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { authRouter } from './routes/auth.js';
import { userRouter } from './routes/user.js';
import { attachWebSocket } from './wsRelay.js';
import { connectRedis, redisAvailable } from './services/redis.js';
import { initDb, dbAvailable } from './services/db.js';
import { runMigrations } from './services/migrations.js';
import { initPool, getQueueDepth, getPoolSize } from './services/identifyPool.js';
import { loadSettings, getSettings } from './services/settings.js';
import { configurePassport } from './services/passport.js';
import { createSessionMiddleware } from './services/sessionStore.js';
import { localOnly } from './middleware/localOnly.js';
import { createRateLimit } from './middleware/rateLimit.js';
import { isAuthEnabled } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for correct req.ip behind reverse proxies (Railway, nginx, etc.)
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : process.env.TRUST_PROXY);
}

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://www.youtube.com", "https://s.ytimg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://i.ytimg.com", "https://*.googleusercontent.com", "https://*.mzstatic.com", "https://coverartarchive.org", "https://*.archive.org"],
      frameSrc: ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com"],
      connectSrc: ["'self'", "ws:", "wss:", "https://lrclib.net", "https://accounts.google.com"],
      mediaSrc: ["'self'", "blob:"],
      workerSrc: ["'self'", "blob:"],
      upgradeInsecureRequests: null,
    },
  },
}));

// CORS — allow same-origin, localhost dev, mDNS, and LAN IPs
const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/\[::1\](:\d+)?$/,
  /^https?:\/\/vynalize\.local(:\d+)?$/,
  /^https?:\/\/(www\.)?vynalize\.com$/,
  // Private IPv4 ranges (LAN access)
  /^https?:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/,
];

app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (same-origin, curl, mobile apps)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(origin))) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

// Routes and remaining middleware are registered in start() to ensure
// session/passport middleware (when enabled) runs before route handlers.

async function start() {
  // Connect to Redis (no-op if REDIS_URL not set)
  await connectRedis();

  // Connect to PostgreSQL (no-op if DATABASE_URL not set)
  await initDb();

  // Run migrations (creates auth tables if db is available)
  if (dbAvailable) {
    await runMigrations();
  }

  // Load settings (settings.json overrides .env)
  await loadSettings();

  // Conditionally mount auth middleware when REQUIRE_AUTH=true
  if (isAuthEnabled()) {
    if (!dbAvailable) {
      console.error('[auth] REQUIRE_AUTH=true but DATABASE_URL is not configured');
      process.exit(1);
    }

    const sessionMiddleware = await createSessionMiddleware();
    app.use(sessionMiddleware);

    configurePassport();
    app.use(passport.initialize());
    app.use(passport.session());

    app.use('/api/auth', authRouter);
    app.use('/api/user', userRouter);
    console.log('[auth] Google OAuth enabled');
  }

  // API routes (registered after session/passport so req.user is available)
  app.use('/api/identify', identifyRouter);
  app.use('/api/video', videoRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/settings', localOnly, settingsRouter);
  app.use('/api/leaderboard', leaderboardRouter);

  const logRateLimit = createRateLimit({
    keyPrefix: 'log',
    windowMs: 60_000,
    maxRequests: 30,
  });

  app.post('/api/log', logRateLimit, (req, res) => {
    const { tag, msg } = req.body ?? {};
    if (typeof tag !== 'string' || typeof msg !== 'string') {
      res.sendStatus(400);
      return;
    }
    const safeTag = tag.slice(0, 50).replace(/[\r\n]/g, '');
    const safeMsg = msg.slice(0, 500).replace(/[\r\n]/g, '');
    if (safeTag && safeMsg) console.log(`[${safeTag}] ${safeMsg}`);
    res.sendStatus(204);
  });

  app.get('/api/config', (_req, res) => {
    let lanHost: string | undefined;
    for (const addrs of Object.values(networkInterfaces())) {
      const match = addrs?.find((a) => a.family === 'IPv4' && !a.internal);
      if (match) { lanHost = match.address; break; }
    }
    res.json({
      requireCode: getSettings().requireCode,
      requireAuth: isAuthEnabled(),
      ...(lanHost && { lanHost }),
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      redis: redisAvailable,
    });
  });

  app.get('/api/diag', localOnly, async (_req, res) => {
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

  // Start the identify worker thread pool
  await initPool();

  const server = createServer(app);
  attachWebSocket(server);

  server.listen(PORT, () => {
    const settings = getSettings();
    console.log(`[server] Vynalize backend running on port ${PORT} (pid: ${process.pid})`);
    console.log(`[server] Redis: ${redisAvailable ? 'connected' : 'not available (local-only mode)'}`);
    console.log(`[server] Database: ${dbAvailable ? 'connected (play tracking enabled)' : 'not available (play tracking disabled)'}`);
    if (isAuthEnabled()) {
      console.log('[server] Auth: required (hosted mode)');
    }
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
