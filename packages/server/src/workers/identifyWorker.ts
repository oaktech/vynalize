import { parentPort } from 'worker_threads';
import fs from 'fs';
import { recognizeSong } from '../services/shazam.js';

if (!parentPort) {
  throw new Error('identifyWorker must be run as a worker thread');
}

parentPort.on('message', async (msg: { audioPath: string; requestId: string }) => {
  const { audioPath, requestId } = msg;
  try {
    const result = await recognizeSong(audioPath);
    parentPort!.postMessage({ requestId, result });
  } catch (err) {
    parentPort!.postMessage({
      requestId,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  } finally {
    // Clean up the uploaded temp file (worker owns cleanup now)
    try { await fs.promises.unlink(audioPath); } catch {}
  }
});
