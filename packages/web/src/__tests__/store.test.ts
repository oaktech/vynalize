import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store';
import type { SongInfo, AudioFeatures, VisualizerMode } from '../types';

// ── Helpers ────────────────────────────────────────────────

function getState() {
  return useStore.getState();
}

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

function makeAudioFeatures(overrides: Partial<AudioFeatures> = {}): AudioFeatures {
  return {
    rms: 0.5,
    energy: 0.4,
    spectralCentroid: 0.3,
    spectralFlux: 0.2,
    zcr: 0.1,
    loudness: { specific: new Float32Array(0), total: 0.5 },
    mfcc: [],
    frequencyData: new Uint8Array(1024),
    timeData: new Uint8Array(2048),
    bass: 0.6,
    mid: 0.4,
    high: 0.2,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────

describe('Store', () => {
  describe('Initial state', () => {
    it('starts not listening', () => {
      expect(getState().isListening).toBe(false);
    });

    it('starts with no song', () => {
      expect(getState().currentSong).toBeNull();
    });

    it('starts in visualizer mode', () => {
      expect(getState().appMode).toBe('visualizer');
    });

    it('starts with spectrum visualizer', () => {
      expect(getState().visualizerMode).toBe('spectrum');
    });

    it('starts with default accent color', () => {
      expect(getState().accentColor).toBe('#8b5cf6');
    });

    it('starts with sensitivity gain 1', () => {
      expect(getState().sensitivityGain).toBe(1);
    });

    it('starts with no session', () => {
      expect(getState().sessionId).toBeNull();
    });

    it('starts online', () => {
      expect(getState().isOnline).toBe(true);
    });

    it('starts with empty song history', () => {
      expect(getState().songHistory).toEqual([]);
    });

    it('starts with no favorites', () => {
      expect(getState().favoriteVisualizers).toEqual([]);
    });

    it('starts with auto-cycle disabled', () => {
      expect(getState().autoCycleEnabled).toBe(false);
    });

    it('starts with 30s auto-cycle interval', () => {
      expect(getState().autoCycleIntervalSec).toBe(30);
    });

    it('starts with controls visible', () => {
      expect(getState().controlsVisible).toBe(true);
    });

    it('starts with no mic error', () => {
      expect(getState().micError).toBeNull();
    });

    it('starts with wsStatus disconnected', () => {
      expect(getState().wsStatus).toBe('disconnected');
    });

    it('starts with position not tracking', () => {
      expect(getState().position).toEqual({
        elapsedMs: 0,
        offsetMs: 0,
        isTracking: false,
        startedAt: null,
      });
    });
  });

  describe('Audio state', () => {
    it('sets listening state', () => {
      getState().setListening(true);
      expect(getState().isListening).toBe(true);
      getState().setListening(false);
      expect(getState().isListening).toBe(false);
    });

    it('stores audio features', () => {
      const features = makeAudioFeatures();
      getState().setAudioFeatures(features);
      expect(getState().audioFeatures).toBe(features);
    });

    it('replaces audio features on each update', () => {
      const f1 = makeAudioFeatures({ rms: 0.3 });
      const f2 = makeAudioFeatures({ rms: 0.7 });
      getState().setAudioFeatures(f1);
      getState().setAudioFeatures(f2);
      expect(getState().audioFeatures?.rms).toBe(0.7);
    });
  });

  describe('Song identification', () => {
    it('sets current song', () => {
      const song = makeSong();
      getState().setCurrentSong(song);
      expect(getState().currentSong).toBe(song);
    });

    it('clears current song', () => {
      getState().setCurrentSong(makeSong());
      getState().setCurrentSong(null);
      expect(getState().currentSong).toBeNull();
    });

    it('tracks identifying state', () => {
      getState().setIdentifying(true);
      expect(getState().isIdentifying).toBe(true);
      getState().setIdentifying(false);
      expect(getState().isIdentifying).toBe(false);
    });
  });

  describe('Beat detection', () => {
    it('triggers a beat', () => {
      const event = { timestamp: 1000, strength: 0.8 };
      getState().triggerBeat(event);
      expect(getState().isBeat).toBe(true);
      expect(getState().lastBeat).toEqual(event);
    });

    it('clears beat flag', () => {
      getState().triggerBeat({ timestamp: 1000, strength: 0.5 });
      getState().clearBeat();
      expect(getState().isBeat).toBe(false);
      // lastBeat should still be present after clear
      expect(getState().lastBeat).not.toBeNull();
    });

    it('sets BPM', () => {
      getState().setBpm(120);
      expect(getState().bpm).toBe(120);
    });

    it('clears BPM', () => {
      getState().setBpm(120);
      getState().setBpm(null);
      expect(getState().bpm).toBeNull();
    });
  });

  describe('Lyrics', () => {
    it('stores lyrics array', () => {
      const lines = [
        { timeMs: 0, text: 'Is this the real life?' },
        { timeMs: 3000, text: 'Is this just fantasy?' },
      ];
      getState().setLyrics(lines);
      expect(getState().lyrics).toHaveLength(2);
      expect(getState().lyrics[0].text).toBe('Is this the real life?');
    });

    it('replaces lyrics on re-set', () => {
      getState().setLyrics([{ timeMs: 0, text: 'hello' }]);
      getState().setLyrics([{ timeMs: 0, text: 'world' }]);
      expect(getState().lyrics).toHaveLength(1);
      expect(getState().lyrics[0].text).toBe('world');
    });
  });

  describe('Position tracking', () => {
    it('sets partial position', () => {
      getState().setPosition({ isTracking: true, startedAt: 5000 });
      expect(getState().position.isTracking).toBe(true);
      expect(getState().position.startedAt).toBe(5000);
      // Other fields unchanged
      expect(getState().position.elapsedMs).toBe(0);
      expect(getState().position.offsetMs).toBe(0);
    });

    it('resets position to defaults', () => {
      getState().setPosition({ isTracking: true, startedAt: 5000, offsetMs: 100 });
      getState().resetPosition();
      expect(getState().position).toEqual({
        elapsedMs: 0,
        offsetMs: 0,
        isTracking: false,
        startedAt: null,
      });
    });

    it('adjusts offset by delta', () => {
      getState().setPosition({ offsetMs: 500 });
      getState().adjustOffset(200);
      expect(getState().position.offsetMs).toBe(700);
      getState().adjustOffset(-1000);
      expect(getState().position.offsetMs).toBe(-300);
    });

    it('tap sync calculates correct offset', () => {
      getState().setPosition({ elapsedMs: 3000 });
      getState().tapSync(5000);
      // offsetMs = targetMs - elapsedMs = 5000 - 3000 = 2000
      expect(getState().position.offsetMs).toBe(2000);
    });
  });

  describe('Display modes', () => {
    it('switches app mode', () => {
      getState().setAppMode('lyrics');
      expect(getState().appMode).toBe('lyrics');
      getState().setAppMode('video');
      expect(getState().appMode).toBe('video');
      getState().setAppMode('ascii');
      expect(getState().appMode).toBe('ascii');
      getState().setAppMode('visualizer');
      expect(getState().appMode).toBe('visualizer');
    });

    it('switches visualizer mode', () => {
      getState().setVisualizerMode('radial');
      expect(getState().visualizerMode).toBe('radial');
      getState().setVisualizerMode('particles');
      expect(getState().visualizerMode).toBe('particles');
    });
  });

  describe('Visualizer cycling', () => {
    const allModes: VisualizerMode[] = [
      'spectrum', 'radial', 'particles', 'radical', 'nebula',
      'vitals', 'synthwave', 'spaceage', 'starrynight', 'guitarhero',
      'vynalize', 'beatsaber', 'pittsburgh',
    ];

    it('cycles to next visualizer', () => {
      expect(getState().visualizerMode).toBe('spectrum');
      getState().nextVisualizer();
      expect(getState().visualizerMode).toBe('radial');
      getState().nextVisualizer();
      expect(getState().visualizerMode).toBe('particles');
    });

    it('wraps around from last to first', () => {
      getState().setVisualizerMode('pittsburgh');
      getState().nextVisualizer();
      expect(getState().visualizerMode).toBe('spectrum');
    });

    it('cycles to previous visualizer', () => {
      getState().setVisualizerMode('radial');
      getState().prevVisualizer();
      expect(getState().visualizerMode).toBe('spectrum');
    });

    it('wraps around from first to last', () => {
      expect(getState().visualizerMode).toBe('spectrum');
      getState().prevVisualizer();
      expect(getState().visualizerMode).toBe('pittsburgh');
    });

    it('visits all 13 modes in a full cycle', () => {
      const visited: VisualizerMode[] = [getState().visualizerMode];
      for (let i = 0; i < 12; i++) {
        getState().nextVisualizer();
        visited.push(getState().visualizerMode);
      }
      expect(visited).toEqual(allModes);
    });

    it('next then prev returns to original', () => {
      getState().setVisualizerMode('nebula');
      getState().nextVisualizer();
      getState().prevVisualizer();
      expect(getState().visualizerMode).toBe('nebula');
    });
  });

  describe('UI state', () => {
    it('toggles fullscreen', () => {
      getState().setFullscreen(true);
      expect(getState().isFullscreen).toBe(true);
      getState().setFullscreen(false);
      expect(getState().isFullscreen).toBe(false);
    });

    it('toggles controls visibility', () => {
      getState().setControlsVisible(false);
      expect(getState().controlsVisible).toBe(false);
      getState().setControlsVisible(true);
      expect(getState().controlsVisible).toBe(true);
    });
  });

  describe('Video state', () => {
    it('sets video ID and clears checkpoint', () => {
      getState().setVideoCheckpoint({ timeSec: 30, at: Date.now() });
      getState().setVideoId('dQw4w9WgXcQ');
      expect(getState().videoId).toBe('dQw4w9WgXcQ');
      expect(getState().videoCheckpoint).toBeNull();
    });

    it('clears video ID', () => {
      getState().setVideoId('abc');
      getState().setVideoId(null);
      expect(getState().videoId).toBeNull();
    });

    it('tracks video searching state', () => {
      getState().setVideoSearching(true);
      expect(getState().videoSearching).toBe(true);
    });

    it('sets video offset', () => {
      getState().setVideoOffsetMs(500);
      expect(getState().videoOffsetMs).toBe(500);
    });

    it('adjusts video offset by delta', () => {
      getState().setVideoOffsetMs(1000);
      getState().adjustVideoOffset(200);
      expect(getState().videoOffsetMs).toBe(1200);
      getState().adjustVideoOffset(-500);
      expect(getState().videoOffsetMs).toBe(700);
    });
  });

  describe('Accent color', () => {
    it('sets accent color', () => {
      getState().setAccentColor('#ff0000');
      expect(getState().accentColor).toBe('#ff0000');
    });

    it('accepts any string value', () => {
      getState().setAccentColor('rgb(255,0,0)');
      expect(getState().accentColor).toBe('rgb(255,0,0)');
    });
  });

  describe('Audio device selection', () => {
    it('defaults to empty string (system default)', () => {
      expect(getState().audioInputDeviceId).toBe('');
    });

    it('sets device ID', () => {
      getState().setAudioInputDeviceId('device-123');
      expect(getState().audioInputDeviceId).toBe('device-123');
    });
  });

  describe('Sensitivity gain', () => {
    it('defaults to 1', () => {
      expect(getState().sensitivityGain).toBe(1);
    });

    it('sets gain value', () => {
      getState().setSensitivityGain(1.5);
      expect(getState().sensitivityGain).toBe(1.5);
    });

    it('allows values below 1', () => {
      getState().setSensitivityGain(0.1);
      expect(getState().sensitivityGain).toBe(0.1);
    });

    it('allows values above 1', () => {
      getState().setSensitivityGain(2.0);
      expect(getState().sensitivityGain).toBe(2.0);
    });
  });

  describe('Session and remote', () => {
    it('sets session ID', () => {
      getState().setSessionId('ABC123');
      expect(getState().sessionId).toBe('ABC123');
    });

    it('tracks remote connection', () => {
      getState().setRemoteConnected(true);
      expect(getState().remoteConnected).toBe(true);
    });

    it('tracks WebSocket status', () => {
      getState().setWsStatus('connecting');
      expect(getState().wsStatus).toBe('connecting');
      getState().setWsStatus('connected');
      expect(getState().wsStatus).toBe('connected');
      getState().setWsStatus('disconnected');
      expect(getState().wsStatus).toBe('disconnected');
    });
  });

  describe('Mic error', () => {
    it('sets and clears mic error', () => {
      getState().setMicError('Permission denied');
      expect(getState().micError).toBe('Permission denied');
      getState().setMicError(null);
      expect(getState().micError).toBeNull();
    });
  });

  describe('Network status', () => {
    it('tracks online status', () => {
      getState().setOnline(false);
      expect(getState().isOnline).toBe(false);
      getState().setOnline(true);
      expect(getState().isOnline).toBe(true);
    });
  });

  describe('Song history', () => {
    it('adds song to history', () => {
      const song = makeSong();
      getState().addSongToHistory(song);
      expect(getState().songHistory).toHaveLength(1);
      expect(getState().songHistory[0].song.title).toBe('Bohemian Rhapsody');
      expect(getState().songHistory[0].identifiedAt).toBeGreaterThan(0);
    });

    it('puts newest song first', () => {
      getState().addSongToHistory(makeSong({ title: 'Song A' }));
      getState().addSongToHistory(makeSong({ title: 'Song B' }));
      expect(getState().songHistory[0].song.title).toBe('Song B');
      expect(getState().songHistory[1].song.title).toBe('Song A');
    });

    it('deduplicates by title+artist', () => {
      getState().addSongToHistory(makeSong({ title: 'Same Song', artist: 'Same Artist' }));
      getState().addSongToHistory(makeSong({ title: 'Other Song', artist: 'Other' }));
      getState().addSongToHistory(makeSong({ title: 'Same Song', artist: 'Same Artist' }));
      expect(getState().songHistory).toHaveLength(2);
      // Deduplicated song should be at the top (most recent)
      expect(getState().songHistory[0].song.title).toBe('Same Song');
    });

    it('caps at 50 entries', () => {
      for (let i = 0; i < 55; i++) {
        getState().addSongToHistory(makeSong({ title: `Song ${i}`, artist: `Artist ${i}` }));
      }
      expect(getState().songHistory).toHaveLength(50);
    });

    it('different artists same title are separate entries', () => {
      getState().addSongToHistory(makeSong({ title: 'Song', artist: 'Artist A' }));
      getState().addSongToHistory(makeSong({ title: 'Song', artist: 'Artist B' }));
      expect(getState().songHistory).toHaveLength(2);
    });
  });

  describe('Favorite visualizers', () => {
    it('toggles a favorite on', () => {
      getState().toggleFavoriteVisualizer('nebula');
      expect(getState().favoriteVisualizers).toContain('nebula');
    });

    it('toggles a favorite off', () => {
      getState().toggleFavoriteVisualizer('nebula');
      getState().toggleFavoriteVisualizer('nebula');
      expect(getState().favoriteVisualizers).not.toContain('nebula');
    });

    it('supports multiple favorites', () => {
      getState().toggleFavoriteVisualizer('nebula');
      getState().toggleFavoriteVisualizer('synthwave');
      getState().toggleFavoriteVisualizer('vitals');
      expect(getState().favoriteVisualizers).toEqual(['nebula', 'synthwave', 'vitals']);
    });

    it('removes only the targeted favorite', () => {
      getState().toggleFavoriteVisualizer('nebula');
      getState().toggleFavoriteVisualizer('synthwave');
      getState().toggleFavoriteVisualizer('nebula');
      expect(getState().favoriteVisualizers).toEqual(['synthwave']);
    });
  });

  describe('Auto-cycle', () => {
    it('enables auto-cycle', () => {
      getState().setAutoCycleEnabled(true);
      expect(getState().autoCycleEnabled).toBe(true);
    });

    it('sets cycle interval', () => {
      getState().setAutoCycleIntervalSec(15);
      expect(getState().autoCycleIntervalSec).toBe(15);
    });
  });

  describe('Onboarding', () => {
    it('tracks tutorial seen', () => {
      expect(getState().tutorialSeen).toBe(false);
      getState().setTutorialSeen(true);
      expect(getState().tutorialSeen).toBe(true);
    });

    it('tracks install dismissed', () => {
      expect(getState().installDismissed).toBe(false);
      getState().setInstallDismissed(true);
      expect(getState().installDismissed).toBe(true);
    });
  });

  describe('Persistence configuration', () => {
    it('persists the correct subset of state keys', () => {
      // The store is configured with persist middleware.
      // Verify that persisted keys are correct by checking that
      // transient state (audio features, etc.) is NOT in localStorage
      // after a state update.
      getState().setAudioFeatures(makeAudioFeatures());
      getState().setVisualizerMode('nebula');
      getState().setSensitivityGain(1.5);
      getState().setCurrentSong(makeSong());

      const stored = localStorage.getItem('vynalize-store');
      if (stored) {
        const parsed = JSON.parse(stored);
        const state = parsed.state;
        // These should be persisted
        expect(state.visualizerMode).toBe('nebula');
        expect(state.sensitivityGain).toBe(1.5);
        // These should NOT be persisted (transient)
        expect(state.audioFeatures).toBeUndefined();
        expect(state.currentSong).toBeUndefined();
        expect(state.isListening).toBeUndefined();
        expect(state.bpm).toBeUndefined();
        expect(state.wsStatus).toBeUndefined();
      }
    });
  });
});
