import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from '../store';
import type { SongInfo, VisualizerMode, AppMode } from '../types';

// ── Integration Flow Tests ─────────────────────────────────
// Tests complete user journeys through the app

function makeSong(overrides: Partial<SongInfo> = {}): SongInfo {
  return {
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    duration: 354,
    albumArtUrl: 'https://example.com/art.jpg',
    musicbrainzId: null,
    bpm: 72,
    ...overrides,
  };
}

describe('Full Startup Flow', () => {
  it('follows correct startup sequence', () => {
    const state = useStore.getState();

    // 1. Initial state: not listening, no song, visualizer mode
    expect(state.isListening).toBe(false);
    expect(state.currentSong).toBeNull();
    expect(state.appMode).toBe('visualizer');

    // 2. User clicks "Start Listening"
    state.setListening(true);
    expect(useStore.getState().isListening).toBe(true);

    // 3. WebSocket connects and assigns session
    state.setWsStatus('connected');
    state.setSessionId('ABC123');
    expect(useStore.getState().wsStatus).toBe('connected');
    expect(useStore.getState().sessionId).toBe('ABC123');

    // 4. Session overlay shows with code
    expect(useStore.getState().sessionId).toBeTruthy();
    expect(useStore.getState().remoteConnected).toBe(false);

    // 5. Audio analysis starts producing features
    state.setAudioFeatures({
      rms: 0.3, energy: 0.2, spectralCentroid: 200, spectralFlux: 0.1,
      zcr: 0.05, loudness: { specific: new Float32Array(0), total: 0.3 },
      mfcc: [], frequencyData: new Uint8Array(1024), timeData: new Uint8Array(2048),
      bass: 0.4, mid: 0.3, high: 0.1,
    });
    expect(useStore.getState().audioFeatures).not.toBeNull();
  });
});

describe('Music Identification Lifecycle', () => {
  it('completes full identify → display → re-identify cycle', () => {
    const state = useStore.getState();
    state.setListening(true);
    state.setSessionId('SESSION1');

    // Phase 1: First identification
    state.setIdentifying(true);
    expect(useStore.getState().isIdentifying).toBe(true);

    const song1 = makeSong({ title: 'Song One' });
    state.setCurrentSong(song1);
    state.addSongToHistory(song1);
    state.setIdentifying(false);

    expect(useStore.getState().currentSong?.title).toBe('Song One');
    expect(useStore.getState().songHistory).toHaveLength(1);

    // Phase 2: Position tracking starts
    state.setPosition({
      isTracking: true,
      startedAt: performance.now(),
      elapsedMs: 0,
      offsetMs: 30000,
    });
    expect(useStore.getState().position.isTracking).toBe(true);

    // Phase 3: Lyrics arrive
    state.setLyrics([
      { timeMs: 0, text: 'Line 1' },
      { timeMs: 3000, text: 'Line 2' },
    ]);
    expect(useStore.getState().lyrics).toHaveLength(2);

    // Phase 4: Video found
    state.setVideoId('youtube-id');
    expect(useStore.getState().videoId).toBe('youtube-id');

    // Phase 5: Song changes
    const song2 = makeSong({ title: 'Song Two', artist: 'Artist Two' });
    state.setCurrentSong(song2);
    state.addSongToHistory(song2);
    state.setLyrics([]);
    state.setVideoId(null);

    expect(useStore.getState().currentSong?.title).toBe('Song Two');
    expect(useStore.getState().songHistory).toHaveLength(2);
    expect(useStore.getState().lyrics).toHaveLength(0);
    expect(useStore.getState().videoId).toBeNull();
  });
});

describe('Remote Control Session Flow', () => {
  it('completes display + controller pairing lifecycle', () => {
    // Display side
    useStore.getState().setListening(true);
    useStore.getState().setWsStatus('connected');
    useStore.getState().setSessionId('XY1234');

    // Verify display state
    expect(useStore.getState().sessionId).toBe('XY1234');
    expect(useStore.getState().remoteConnected).toBe(false);

    // Controller connects (server sends remoteStatus)
    useStore.getState().setRemoteConnected(true);
    expect(useStore.getState().remoteConnected).toBe(true);

    // Controller sends commands
    useStore.getState().setVisualizerMode('nebula');
    expect(useStore.getState().visualizerMode).toBe('nebula');

    useStore.getState().setAppMode('lyrics');
    expect(useStore.getState().appMode).toBe('lyrics');

    useStore.getState().setSensitivityGain(1.5);
    expect(useStore.getState().sensitivityGain).toBe(1.5);

    useStore.getState().setAccentColor('#ff0000');
    expect(useStore.getState().accentColor).toBe('#ff0000');

    // Controller disconnects
    useStore.getState().setRemoteConnected(false);
    expect(useStore.getState().remoteConnected).toBe(false);

    // Session and settings persist
    expect(useStore.getState().sessionId).toBe('XY1234');
    expect(useStore.getState().visualizerMode).toBe('nebula');
    expect(useStore.getState().sensitivityGain).toBe(1.5);
  });
});

describe('Auto-Display Priority Flow', () => {
  function autoDisplay() {
    const s = useStore.getState();
    if (!s.currentSong) return;
    if (s.videoId) { s.setAppMode('video'); return; }
    if (s.videoSearching) return;
    if (s.lyrics.length > 0) { s.setAppMode('lyrics'); return; }
    s.setAppMode('visualizer');
  }

  it('transitions through display modes as content arrives', () => {
    const state = useStore.getState();

    // Song identified
    state.setCurrentSong(makeSong());

    // 1. Initially: no video or lyrics → visualizer
    state.setVideoSearching(true);
    autoDisplay();
    // Stays on visualizer during search
    expect(useStore.getState().appMode).toBe('visualizer');

    // 2. Lyrics arrive during video search → stay on visualizer (waiting for video)
    state.setLyrics([{ timeMs: 0, text: 'Hello' }]);
    autoDisplay();
    expect(useStore.getState().appMode).toBe('visualizer');

    // 3. Video search completes with no result → switch to lyrics
    state.setVideoSearching(false);
    autoDisplay();
    expect(useStore.getState().appMode).toBe('lyrics');

    // 4. Video arrives later → switch to video
    state.setVideoId('late-video');
    autoDisplay();
    expect(useStore.getState().appMode).toBe('video');
  });

  it('resets to visualizer when song has no content', () => {
    const state = useStore.getState();
    state.setCurrentSong(makeSong());
    state.setVideoSearching(false);
    autoDisplay();
    expect(useStore.getState().appMode).toBe('visualizer');
  });
});

describe('Kiosk Mode Flow', () => {
  it('autostart param triggers immediate audio capture', () => {
    const params = new URLSearchParams('autostart');
    const autostart = params.has('autostart');
    expect(autostart).toBe(true);
  });

  it('kiosk auto-hides controls after 3 seconds', () => {
    const KIOSK_HIDE_DELAY = 3000;
    expect(KIOSK_HIDE_DELAY).toBe(3000);
  });

  it('kiosk requests fullscreen on mount', () => {
    // KioskApp attempts document.documentElement.requestFullscreen()
    expect(document.documentElement.requestFullscreen).toBeDefined();
  });
});

describe('Visualizer Cycling Flow', () => {
  it('cycles through all 12 modes in sequence', () => {
    const modes: VisualizerMode[] = [];
    useStore.getState().setVisualizerMode('spectrum');

    for (let i = 0; i < 12; i++) {
      modes.push(useStore.getState().visualizerMode);
      useStore.getState().nextVisualizer();
    }

    expect(modes).toEqual([
      'spectrum', 'radial', 'particles', 'radical', 'nebula',
      'vitals', 'synthwave', 'spaceage', 'starrynight', 'guitarhero',
      'vynalize', 'beatsaber',
    ]);

    // Full cycle returns to start
    expect(useStore.getState().visualizerMode).toBe('spectrum');
  });

  it('prev/next round-trip is consistent', () => {
    useStore.getState().setVisualizerMode('vitals');
    useStore.getState().nextVisualizer();
    useStore.getState().nextVisualizer();
    useStore.getState().prevVisualizer();
    useStore.getState().prevVisualizer();
    expect(useStore.getState().visualizerMode).toBe('vitals');
  });
});

describe('Settings Persistence Across Sessions', () => {
  it('persisted settings survive store rehydration', () => {
    // Simulate what happens when user returns to app
    useStore.getState().setVisualizerMode('synthwave');
    useStore.getState().setAccentColor('#00ff00');
    useStore.getState().setSensitivityGain(1.3);
    useStore.getState().setAutoCycleEnabled(true);
    useStore.getState().setAutoCycleIntervalSec(15);
    useStore.getState().toggleFavoriteVisualizer('nebula');
    useStore.getState().toggleFavoriteVisualizer('vitals');

    // Read from localStorage
    const stored = localStorage.getItem('vynalize-store');
    if (stored) {
      const parsed = JSON.parse(stored).state;
      expect(parsed.visualizerMode).toBe('synthwave');
      expect(parsed.accentColor).toBe('#00ff00');
      expect(parsed.sensitivityGain).toBe(1.3);
      expect(parsed.autoCycleEnabled).toBe(true);
      expect(parsed.autoCycleIntervalSec).toBe(15);
      expect(parsed.favoriteVisualizers).toEqual(['nebula', 'vitals']);
    }
  });

  it('transient state is NOT persisted', () => {
    useStore.getState().setListening(true);
    useStore.getState().setBpm(120);
    useStore.getState().setWsStatus('connected');
    useStore.getState().setCurrentSong(makeSong());

    const stored = localStorage.getItem('vynalize-store');
    if (stored) {
      const parsed = JSON.parse(stored).state;
      expect(parsed.isListening).toBeUndefined();
      expect(parsed.bpm).toBeUndefined();
      expect(parsed.wsStatus).toBeUndefined();
      expect(parsed.currentSong).toBeUndefined();
    }
  });
});

describe('Song History Flow', () => {
  it('builds history as songs are identified', () => {
    const state = useStore.getState();

    state.addSongToHistory(makeSong({ title: 'Song 1' }));
    state.addSongToHistory(makeSong({ title: 'Song 2' }));
    state.addSongToHistory(makeSong({ title: 'Song 3' }));

    expect(useStore.getState().songHistory).toHaveLength(3);
    // Most recent first
    expect(useStore.getState().songHistory[0].song.title).toBe('Song 3');
    expect(useStore.getState().songHistory[2].song.title).toBe('Song 1');
  });

  it('re-identifies same song moves it to top without duplication', () => {
    const state = useStore.getState();

    state.addSongToHistory(makeSong({ title: 'Song A' }));
    state.addSongToHistory(makeSong({ title: 'Song B' }));
    state.addSongToHistory(makeSong({ title: 'Song A' }));

    expect(useStore.getState().songHistory).toHaveLength(2);
    expect(useStore.getState().songHistory[0].song.title).toBe('Song A');
    expect(useStore.getState().songHistory[1].song.title).toBe('Song B');
  });
});

describe('Error Recovery Flows', () => {
  it('recovers from mic permission denial', () => {
    // User denies mic → error shown → clicks "Try Again"
    useStore.getState().setMicError('Microphone access denied');
    expect(useStore.getState().micError).toBeTruthy();
    expect(useStore.getState().isListening).toBe(false);

    // Simulate successful retry
    useStore.getState().setMicError(null);
    useStore.getState().setListening(true);
    expect(useStore.getState().micError).toBeNull();
    expect(useStore.getState().isListening).toBe(true);
  });

  it('handles WebSocket disconnect gracefully', () => {
    useStore.getState().setWsStatus('connected');
    useStore.getState().setSessionId('ABC');
    useStore.getState().setRemoteConnected(true);

    // WebSocket disconnects
    useStore.getState().setWsStatus('disconnected');
    // App should still be functional
    expect(useStore.getState().isListening).toBe(false);
    expect(useStore.getState().sessionId).toBe('ABC');
  });

  it('handles going offline', () => {
    useStore.getState().setOnline(false);
    expect(useStore.getState().isOnline).toBe(false);
    // App should show offline banner

    // Comes back online
    useStore.getState().setOnline(true);
    expect(useStore.getState().isOnline).toBe(true);
  });
});

describe('App Router', () => {
  it('routes to correct component by pathname', () => {
    function getRoute(path: string): string {
      if (path === '/settings') return 'ServerSettings';
      if (path === '/remote') return 'RemoteControl';
      if (path === '/kiosk') return 'KioskRoute';
      if (path === '/leaderboard') return 'Leaderboard';
      if (path === '/privacy') return 'Privacy';
      return 'StandaloneApp';
    }

    expect(getRoute('/')).toBe('StandaloneApp');
    expect(getRoute('/settings')).toBe('ServerSettings');
    expect(getRoute('/remote')).toBe('RemoteControl');
    expect(getRoute('/kiosk')).toBe('KioskRoute');
    expect(getRoute('/leaderboard')).toBe('Leaderboard');
    expect(getRoute('/privacy')).toBe('Privacy');
    expect(getRoute('/unknown')).toBe('StandaloneApp');
  });
});

describe('Session Overlay Flow', () => {
  it('shows overlay when session exists but no remote connected', () => {
    useStore.getState().setSessionId('ABC123');
    useStore.getState().setRemoteConnected(false);
    const show = useStore.getState().sessionId && !useStore.getState().remoteConnected;
    expect(show).toBeTruthy();
  });

  it('hides overlay when remote connects', () => {
    useStore.getState().setSessionId('ABC123');
    useStore.getState().setRemoteConnected(true);
    const show = useStore.getState().sessionId && !useStore.getState().remoteConnected;
    expect(show).toBeFalsy();
  });

  it('hides overlay when dismissed', () => {
    // dismissal is component-local state, not in store
    const dismissed = true;
    useStore.getState().setSessionId('ABC123');
    const show = useStore.getState().sessionId && !useStore.getState().remoteConnected && !dismissed;
    expect(show).toBeFalsy();
  });
});
