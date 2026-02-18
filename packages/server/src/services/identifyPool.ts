import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import fs from 'fs';
import type { ShazamResult } from './shazam.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const POOL_SIZE = parseInt(process.env.IDENTIFY_WORKERS || '', 10) || Math.max(2, os.cpus().length - 1);
const MAX_QUEUE = 50;

interface PendingJob {
  resolve: (result: ShazamResult | null) => void;
  reject: (error: Error) => void;
}

const workers: Worker[] = [];
const pending = new Map<string, PendingJob>();
let nextWorker = 0;
let queueDepth = 0;

// Detect dev mode: in dev, __dirname is in src/; in production it's in dist/
const isDev = import.meta.url.includes('/src/');

// Direct-execution fallback for dev (tsx can't fully resolve worker imports)
let directRecognize: ((audioPath: string) => Promise<ShazamResult | null>) | null = null;

function createWorker(): Worker {
  const workerPath = path.resolve(__dirname, '../workers/identifyWorker.js');
  const worker = new Worker(workerPath);

  worker.on('message', (msg: { requestId: string; result?: ShazamResult | null; error?: string }) => {
    queueDepth--;
    const job = pending.get(msg.requestId);
    if (!job) return;
    pending.delete(msg.requestId);

    if (msg.error) {
      job.reject(new Error(msg.error));
    } else {
      job.resolve(msg.result ?? null);
    }
  });

  worker.on('error', (err) => {
    console.error('[identify-pool] Worker error:', err.message);
  });

  return worker;
}

export async function initPool(): Promise<void> {
  if (isDev) {
    // In dev mode, run identify directly on main thread (single user, no scale concern)
    const shazam = await import('./shazam.js');
    directRecognize = shazam.recognizeSong;
    console.log('[identify-pool] Dev mode — using direct execution (no worker threads)');
    return;
  }

  for (let i = 0; i < POOL_SIZE; i++) {
    workers.push(createWorker());
  }
  console.log(`[identify-pool] Started ${POOL_SIZE} workers`);
}

export async function submitJob(audioPath: string): Promise<ShazamResult | null> {
  // Dev mode: direct execution
  if (directRecognize) {
    try {
      return await directRecognize(audioPath);
    } finally {
      try { await fs.promises.unlink(audioPath); } catch {}
    }
  }

  // Production: worker pool
  if (queueDepth >= MAX_QUEUE) {
    throw new Error('Server overloaded');
  }

  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    pending.set(requestId, { resolve, reject });
    queueDepth++;

    const worker = workers[nextWorker % workers.length];
    nextWorker++;
    worker.postMessage({ audioPath, requestId });
  });
}

export function getQueueDepth(): number {
  return queueDepth;
}

export function getPoolSize(): number {
  return isDev ? 0 : workers.length;
}
