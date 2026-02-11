import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execFileAsync = promisify(execFile);

export interface FingerprintResult {
  duration: number;
  fingerprint: string;
}

export async function generateFingerprint(
  audioFilePath: string
): Promise<FingerprintResult> {
  // Try common fpcalc locations
  const fpcalcPaths = [
    'fpcalc',
    '/usr/local/bin/fpcalc',
    '/usr/bin/fpcalc',
    '/opt/homebrew/bin/fpcalc',
  ];

  let lastError: Error | null = null;

  for (const fpcalc of fpcalcPaths) {
    try {
      const { stdout } = await execFileAsync(fpcalc, [
        '-json',
        audioFilePath,
      ]);

      const result = JSON.parse(stdout);
      return {
        duration: Math.round(result.duration),
        fingerprint: result.fingerprint,
      };
    } catch (err) {
      lastError = err as Error;
      continue;
    }
  }

  throw new Error(
    `fpcalc not found or failed. Install Chromaprint: brew install chromaprint. Last error: ${lastError?.message}`
  );
}

export async function cleanupFile(path: string): Promise<void> {
  try {
    await fs.promises.unlink(path);
  } catch {}
}
