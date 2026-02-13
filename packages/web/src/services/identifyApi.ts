import type { SongInfo } from '../types';

export interface IdentifyResult {
  song: SongInfo;
  offsetMs: number;
}

export async function identifySong(audioBlob: Blob): Promise<IdentifyResult | null> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'capture.wav');

  const res = await fetch('/api/identify', {
    method: 'POST',
    body: formData,
  });

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
}
