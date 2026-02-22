import type { SongInfo } from '../types';

export interface IdentifyResult {
  song: SongInfo;
  offsetMs: number;
}

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export async function identifySong(audioBlob: Blob): Promise<IdentifyResult | null> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'capture.wav');

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout('/api/identify', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      }, 15000);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.warn('Identify failed:', err);
        return null;
      }

      const data = await res.json();
      console.log('[identifyApi] Server response:', data);
      if (!data.title) return null;

      return {
        song: {
          title: data.title,
          artist: data.artist,
          album: data.album || '',
          duration: data.duration || 0,
          albumArtUrl: data.albumArtUrl || null,
          musicbrainzId: data.musicbrainzId || null,
          bpm: data.bpm || null,
        },
        offsetMs: data.offsetMs || 0,
      };
    } catch (err) {
      lastError = err;
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  console.error('[identifyApi] Failed after retries:', lastError);
  return null;
}
