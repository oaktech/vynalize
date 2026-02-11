import type { SongInfo } from '../types';

export async function identifySong(audioBlob: Blob): Promise<SongInfo | null> {
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
  if (!data.title) return null;

  return {
    title: data.title,
    artist: data.artist,
    album: data.album || '',
    duration: data.duration || 0,
    albumArtUrl: data.albumArtUrl || null,
    musicbrainzId: data.musicbrainzId || null,
    bpm: data.bpm || null,
  };
}
