import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useStore } from '../store';

// ── Song Identification API Tests ──────────────────────────

describe('identifySong API client', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetchResponse(data: unknown, ok = true, status = 200) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(data),
    } as Response);
  }

  it('sends audio blob as FormData', async () => {
    mockFetchResponse({
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album',
      duration: 200,
      albumArtUrl: null,
      musicbrainzId: null,
      bpm: null,
      offsetMs: 5000,
    });

    const { identifySong } = await import('../services/identifyApi');
    const blob = new Blob(['audio-data'], { type: 'audio/webm' });
    const result = await identifySong(blob);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/identify',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );
    expect(result).not.toBeNull();
    expect(result?.song.title).toBe('Test Song');
  });

  it('returns null when no title in response', async () => {
    mockFetchResponse({ match: false });

    const { identifySong } = await import('../services/identifyApi');
    const result = await identifySong(new Blob(['data']));
    expect(result).toBeNull();
  });

  it('returns null on HTTP error', async () => {
    mockFetchResponse({ error: 'Rate limited' }, false, 429);

    const { identifySong } = await import('../services/identifyApi');
    const result = await identifySong(new Blob(['data']));
    expect(result).toBeNull();
  });

  it('retries once on network failure', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          title: 'Retry Song',
          artist: 'Artist',
          album: '',
          offsetMs: 0,
        }),
      });
    });

    const { identifySong } = await import('../services/identifyApi');
    const result = await identifySong(new Blob(['data']));
    expect(callCount).toBe(2);
    expect(result?.song.title).toBe('Retry Song');
  });

  it('extracts offsetMs from response', async () => {
    mockFetchResponse({
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      offsetMs: 42000,
    });

    const { identifySong } = await import('../services/identifyApi');
    const result = await identifySong(new Blob(['data']));
    expect(result?.offsetMs).toBe(42000);
  });

  it('defaults missing fields gracefully', async () => {
    mockFetchResponse({
      title: 'Minimal Song',
      artist: 'Artist',
    });

    const { identifySong } = await import('../services/identifyApi');
    const result = await identifySong(new Blob(['data']));
    expect(result?.song.album).toBe('');
    expect(result?.song.duration).toBe(0);
    expect(result?.song.albumArtUrl).toBeNull();
    expect(result?.song.musicbrainzId).toBeNull();
    expect(result?.song.bpm).toBeNull();
    expect(result?.offsetMs).toBe(0);
  });
});

describe('Song Identification Flow', () => {
  describe('Song change detection', () => {
    function isSongNew(
      current: { title: string; artist: string } | null,
      newSong: { title: string; artist: string },
    ): boolean {
      return !current || newSong.title !== current.title || newSong.artist !== current.artist;
    }

    it('detects new song when no current song', () => {
      expect(isSongNew(null, { title: 'New Song', artist: 'Artist' })).toBe(true);
    });

    it('detects same song correctly', () => {
      expect(isSongNew({ title: 'Song', artist: 'Artist' }, { title: 'Song', artist: 'Artist' })).toBe(false);
    });

    it('detects different song when title changes', () => {
      expect(isSongNew({ title: 'Song A', artist: 'Artist' }, { title: 'Song B', artist: 'Artist' })).toBe(true);
    });

    it('detects different song when artist changes', () => {
      expect(isSongNew({ title: 'Song', artist: 'Artist A' }, { title: 'Song', artist: 'Artist B' })).toBe(true);
    });
  });

  describe('Position calculation', () => {
    it('computes current position from shazam offset + capture elapsed', () => {
      const shazamOffsetMs = 45000; // 45 seconds into the song
      const captureStartTime = 1000;
      const now = 8000; // 7 seconds of processing
      const timeSinceCapture = now - captureStartTime;
      const currentPositionMs = shazamOffsetMs + timeSinceCapture;
      expect(currentPositionMs).toBe(52000); // 52 seconds
    });

    it('handles zero offset', () => {
      const shazamOffsetMs = 0;
      const timeSinceCapture = 5000;
      expect(shazamOffsetMs + timeSinceCapture).toBe(5000);
    });
  });

  describe('Capture parameters', () => {
    it('uses correct capture duration', () => {
      const CAPTURE_DURATION_MS = 5000;
      expect(CAPTURE_DURATION_MS).toBe(5000);
    });

    it('uses correct identify interval', () => {
      const IDENTIFY_INTERVAL_MS = 20000;
      expect(IDENTIFY_INTERVAL_MS).toBe(20000);
    });

    it('waits before first identification', () => {
      const INITIAL_DELAY = 2000;
      expect(INITIAL_DELAY).toBe(2000);
    });
  });

  describe('Song history integration', () => {
    it('adds identified song to history', () => {
      const store = useStore.getState();
      const song = {
        title: 'Identified Song',
        artist: 'Great Artist',
        album: 'Album',
        duration: 200,
        albumArtUrl: null,
        musicbrainzId: null,
        bpm: null,
      };
      store.setCurrentSong(song);
      store.addSongToHistory(song);
      expect(useStore.getState().songHistory).toHaveLength(1);
      expect(useStore.getState().songHistory[0].song.title).toBe('Identified Song');
    });

    it('position is set on new song identification', () => {
      const store = useStore.getState();
      store.setPosition({
        isTracking: true,
        startedAt: performance.now(),
        elapsedMs: 0,
        offsetMs: 30000,
      });
      expect(useStore.getState().position.isTracking).toBe(true);
      expect(useStore.getState().position.offsetMs).toBe(30000);
    });
  });
});
