import { Shazam } from 'node-shazam';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execFileAsync = promisify(execFile);
const shazam = new Shazam();

export interface ShazamResult {
  title: string;
  artist: string;
  album: string;
  genre: string | null;
  albumArtUrl: string | null;
  offsetMs: number;
}

/**
 * Convert browser-captured audio (webm/opus) to WAV via ffmpeg.
 * Minimal processing — Shazam's algorithm handles noisy/room audio natively.
 */
async function convertToWav(inputPath: string): Promise<string> {
  const wavPath = inputPath + '.wav';

  await execFileAsync('ffmpeg', [
    '-y',
    '-i', inputPath,
    '-ar', '44100',
    '-ac', '1',
    '-sample_fmt', 's16',
    wavPath,
  ]);

  const stat = await fs.promises.stat(wavPath);
  console.log(`[shazam] WAV file: ${(stat.size / 1024).toFixed(0)}KB`);

  return wavPath;
}

async function cleanupFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch {}
}

export async function recognizeSong(
  audioFilePath: string
): Promise<ShazamResult | null> {
  let wavPath: string | null = null;

  try {
    // Convert WebM/Opus to WAV for compatibility
    console.log('[shazam] Converting audio to WAV...');
    wavPath = await convertToWav(audioFilePath);
  } catch (err) {
    throw new Error(
      `ffmpeg conversion failed. Is ffmpeg installed? Error: ${(err as Error).message}`
    );
  }

  try {
    console.log('[shazam] Recognizing song...');
    const result = await shazam.recognise(wavPath, 'en-US') as any;

    if (!result || !result.track) {
      console.log('[shazam] No match found');
      return null;
    }

    const track = result.track;
    const title = track.title || 'Unknown Title';
    const artist = track.subtitle || 'Unknown Artist';

    // Extract album from SONG section metadata
    let album = '';
    if (track.sections) {
      const songSection = track.sections.find(
        (s: any) => s.type === 'SONG'
      );
      if (songSection?.metadata) {
        const albumMeta = songSection.metadata.find(
          (m: any) => m.title === 'Album'
        );
        if (albumMeta) album = albumMeta.text;
      }
    }

    // Get genre from track
    const genre: string | null = track.genres?.primary || null;

    // Get album art from track images
    const albumArtUrl = track.images?.coverart || track.images?.background || null;

    // Extract song offset from matches (seconds into the song)
    const offsetSec = result.matches?.[0]?.offset ?? 0;
    const offsetMs = Math.round(offsetSec * 1000);

    console.log(`[shazam] Match: "${title}" by ${artist} (album: ${album}, offset: ${offsetSec}s)`);

    return { title, artist, album, genre, albumArtUrl, offsetMs };
  } catch (err) {
    console.error('[shazam] Recognition error:', err);
    throw err;
  } finally {
    if (wavPath) await cleanupFile(wavPath);
  }
}
