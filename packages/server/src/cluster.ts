import cluster from 'cluster';
import os from 'os';

const WEB_CONCURRENCY = parseInt(process.env.WEB_CONCURRENCY || '', 10) || os.cpus().length;

if (cluster.isPrimary) {
  console.log(`[cluster] Primary ${process.pid} forking ${WEB_CONCURRENCY} workers`);

  // Track crash timestamps for backoff
  const crashTimestamps: number[] = [];
  let backoffMs = 1000;
  const MAX_BACKOFF = 30_000;
  const CRASH_WINDOW = 60_000;
  const MAX_CRASHES_IN_WINDOW = 5;

  for (let i = 0; i < WEB_CONCURRENCY; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    const now = Date.now();
    console.warn(`[cluster] Worker ${worker.process.pid} died (code=${code}, signal=${signal})`);

    // Clean old crash timestamps outside the window
    while (crashTimestamps.length > 0 && crashTimestamps[0] < now - CRASH_WINDOW) {
      crashTimestamps.shift();
    }
    crashTimestamps.push(now);

    // Check for crash loop
    if (crashTimestamps.length >= MAX_CRASHES_IN_WINDOW) {
      console.error(`[cluster] CRITICAL: ${crashTimestamps.length} crashes in ${CRASH_WINDOW / 1000}s — stopping respawn`);
      return;
    }

    console.log(`[cluster] Restarting worker in ${backoffMs}ms...`);
    setTimeout(() => {
      const w = cluster.fork();

      // Reset backoff after 60s of stable running
      const stableTimer = setTimeout(() => {
        backoffMs = 1000;
      }, CRASH_WINDOW);

      w.on('exit', () => clearTimeout(stableTimer));
    }, backoffMs);

    // Exponential backoff
    backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF);
  });
} else {
  // Workers run the regular server
  import('./index.js');
}
