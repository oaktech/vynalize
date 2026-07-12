import type { LyricLine } from '../types';

export function parseLRC(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/;

  for (const raw of lrc.split('\n')) {
    const match = raw.match(regex);
    if (!match) continue;

    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const centiseconds = match[3].length === 2
      ? parseInt(match[3], 10) * 10
      : parseInt(match[3], 10);
    const text = match[4].trim();

    if (!text) continue;

    lines.push({
      timeMs: minutes * 60000 + seconds * 1000 + centiseconds,
      text,
    });
  }

  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function linesFromLyricsPayload(data: { syncedLyrics?: string; plainLyrics?: string }): LyricLine[] {
  if (data.syncedLyrics) {
    return parseLRC(data.syncedLyrics);
  }
  if (data.plainLyrics) {
    return data.plainLyrics
      .split('\n')
      .filter((l: string) => l.trim())
      .map((text: string, i: number) => ({ timeMs: i * 4000, text }));
  }
  return [];
}

// Fuzzy fallback — /api/get requires an exact duration match, so it misses
// often. /api/search has no such requirement; take its best-scoring result.
async function searchLyrics(artist: string, title: string): Promise<LyricLine[]> {
  const params = new URLSearchParams({ artist_name: artist, track_name: title });
  const res = await fetchWithTimeout(`https://lrclib.net/api/search?${params}`);
  if (!res.ok) return [];

  const results = await res.json();
  if (!Array.isArray(results) || results.length === 0) return [];

  const best = results.find((r) => r.syncedLyrics) ?? results.find((r) => r.plainLyrics);
  return best ? linesFromLyricsPayload(best) : [];
}

export async function fetchLyrics(
  artist: string,
  title: string,
  album?: string,
  durationSec?: number,
): Promise<LyricLine[]> {
  const params = new URLSearchParams({
    artist_name: artist,
    track_name: title,
  });
  if (album) params.set('album_name', album);
  if (durationSec) params.set('duration', String(Math.round(durationSec)));

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(`https://lrclib.net/api/get?${params}`);

      if (res.ok) {
        const lines = linesFromLyricsPayload(await res.json());
        if (lines.length > 0) return lines;
      }

      // No exact match (or no lyrics on the exact match) — try fuzzy search.
      return await searchLyrics(artist, title);
    } catch (err) {
      lastError = err;
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  console.warn('[lyricsApi] Failed after retries:', lastError);
  return [];
}
