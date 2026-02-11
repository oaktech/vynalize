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

export async function fetchLyrics(
  artist: string,
  title: string
): Promise<LyricLine[]> {
  const params = new URLSearchParams({
    artist_name: artist,
    track_name: title,
  });

  const res = await fetch(`https://lrclib.net/api/get?${params}`, {
    headers: { 'User-Agent': 'VinylVisions/0.1.0' },
  });

  if (!res.ok) return [];

  const data = await res.json();
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
