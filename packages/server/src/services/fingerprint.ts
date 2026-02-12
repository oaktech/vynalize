import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execFileAsync = promisify(execFile);

export interface FingerprintResult {
  duration: number;
  fingerprint: string;
}

/**
 * Convert browser-captured audio (webm/opus) to WAV via ffmpeg.
 * Apply a high-pass filter to remove low-frequency room rumble,
 * and normalize volume to improve fingerprint quality from mic capture.
 */
async function convertToWav(inputPath: string): Promise<string> {
  const wavPath = inputPath + '.wav';

  await execFileAsync('ffmpeg', [
    '-y',
    '-i', inputPath,
    '-af', 'highpass=f=100,loudnorm',  // cut room rumble, normalize levels
    '-ar', '44100',
    '-ac', '1',
    '-sample_fmt', 's16',
    wavPath,
  ]);

  // Log file size to verify we got real audio
  const stat = await fs.promises.stat(wavPath);
  console.log(`[fingerprint] WAV file: ${(stat.size / 1024).toFixed(0)}KB`);

  return wavPath;
}

export async function generateFingerprint(
  audioFilePath: string
): Promise<FingerprintResult> {
  let wavPath: string | null = null;

  try {
    wavPath = await convertToWav(audioFilePath);
  } catch (err) {
    throw new Error(
      `ffmpeg conversion failed. Is ffmpeg installed? Error: ${(err as Error).message}`
    );
  }

  const fpcalcPaths = [
    'fpcalc',
    '/usr/local/bin/fpcalc',
    '/usr/bin/fpcalc',
    '/opt/homebrew/bin/fpcalc',
  ];

  let lastError: Error | null = null;

  for (const fpcalc of fpcalcPaths) {
    try {
      const { stdout } = await execFileAsync(fpcalc, ['-json', wavPath]);

      const result = JSON.parse(stdout);
      console.log(`[fingerprint] Duration: ${result.duration}s, fingerprint length: ${result.fingerprint.length} chars`);

      await cleanupFile(wavPath);

      return {
        duration: Math.round(result.duration),
        fingerprint: result.fingerprint,
      };
    } catch (err) {
      lastError = err as Error;
      continue;
    }
  }

  await cleanupFile(wavPath);

  throw new Error(
    `fpcalc not found or failed. Install Chromaprint: brew install chromaprint. Last error: ${lastError?.message}`
  );
}

export async function cleanupFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch {}
}
