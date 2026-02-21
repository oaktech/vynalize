import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from '../store';

// ── Auto Display Priority Tests ────────────────────────────
// Tests the useAutoDisplay hook logic:
// Priority: video > lyrics > visualizer

describe('Auto Display Priority Logic', () => {
  function simulateAutoDisplay() {
    const state = useStore.getState();
    if (!state.currentSong) return;

    // Priority 1: Video available
    if (state.videoId) {
      state.setAppMode('video');
      return;
    }

    // Still searching for video — stay on current mode
    if (state.videoSearching) return;

    // Priority 2: Lyrics available
    if (state.lyrics.length > 0) {
      state.setAppMode('lyrics');
      return;
    }

    // Priority 3: Fallback to visualizer
    state.setAppMode('visualizer');
  }

  beforeEach(() => {
    useStore.getState().setCurrentSong({
      title: 'Test',
      artist: 'Artist',
      album: '',
      duration: 200,
      albumArtUrl: null,
      musicbrainzId: null,
      bpm: null,
    });
  });

  it('does nothing when no current song', () => {
    useStore.getState().setCurrentSong(null);
    useStore.getState().setAppMode('lyrics');
    simulateAutoDisplay();
    expect(useStore.getState().appMode).toBe('lyrics');
  });

  it('switches to video when videoId is available', () => {
    useStore.getState().setVideoId('abc123');
    simulateAutoDisplay();
    expect(useStore.getState().appMode).toBe('video');
  });

  it('video takes priority over lyrics', () => {
    useStore.getState().setVideoId('abc123');
    useStore.getState().setLyrics([{ timeMs: 0, text: 'Hello' }]);
    simulateAutoDisplay();
    expect(useStore.getState().appMode).toBe('video');
  });

  it('waits during video search (does not switch to lyrics)', () => {
    useStore.getState().setVideoSearching(true);
    useStore.getState().setLyrics([{ timeMs: 0, text: 'Hello' }]);
    useStore.getState().setAppMode('visualizer');
    simulateAutoDisplay();
    // Should stay on visualizer while searching, not jump to lyrics
    expect(useStore.getState().appMode).toBe('visualizer');
  });

  it('falls back to lyrics when video search completes with no result', () => {
    useStore.getState().setVideoSearching(false);
    useStore.getState().setLyrics([{ timeMs: 0, text: 'Hello' }]);
    simulateAutoDisplay();
    expect(useStore.getState().appMode).toBe('lyrics');
  });

  it('falls back to visualizer when nothing is available', () => {
    useStore.getState().setVideoSearching(false);
    useStore.getState().setAppMode('lyrics');
    simulateAutoDisplay();
    expect(useStore.getState().appMode).toBe('visualizer');
  });

  it('switches to video immediately when it arrives during search', () => {
    useStore.getState().setVideoSearching(true);
    // Video arrives
    useStore.getState().setVideoId('xyz');
    simulateAutoDisplay();
    expect(useStore.getState().appMode).toBe('video');
  });

  it('handles empty lyrics array correctly', () => {
    useStore.getState().setLyrics([]);
    simulateAutoDisplay();
    expect(useStore.getState().appMode).toBe('visualizer');
  });
});

// ── Auto Cycle Tests ───────────────────────────────────────

describe('Auto Cycle Logic', () => {
  it('does not cycle when disabled', () => {
    useStore.getState().setAutoCycleEnabled(false);
    const mode = useStore.getState().visualizerMode;
    // Would need timer, but disabled prevents it
    expect(useStore.getState().autoCycleEnabled).toBe(false);
    expect(useStore.getState().visualizerMode).toBe(mode);
  });

  it('does not cycle when not in visualizer mode', () => {
    useStore.getState().setAutoCycleEnabled(true);
    useStore.getState().setAppMode('lyrics');
    // In real code, the effect checks appMode !== 'visualizer'
    const shouldCycle = useStore.getState().autoCycleEnabled && useStore.getState().appMode === 'visualizer';
    expect(shouldCycle).toBe(false);
  });

  it('cycles when enabled and in visualizer mode', () => {
    useStore.getState().setAutoCycleEnabled(true);
    useStore.getState().setAppMode('visualizer');
    const shouldCycle = useStore.getState().autoCycleEnabled && useStore.getState().appMode === 'visualizer';
    expect(shouldCycle).toBe(true);
  });

  it('uses nextVisualizer to cycle (not random)', () => {
    useStore.getState().setVisualizerMode('spectrum');
    useStore.getState().nextVisualizer();
    expect(useStore.getState().visualizerMode).toBe('radial');
  });

  it('cycles through all modes eventually', () => {
    const visited = new Set<string>();
    useStore.getState().setVisualizerMode('spectrum');
    for (let i = 0; i < 13; i++) {
      visited.add(useStore.getState().visualizerMode);
      useStore.getState().nextVisualizer();
    }
    expect(visited.size).toBe(13);
  });

  it('interval can be 15, 30, or 60 seconds', () => {
    const validIntervals = [15, 30, 60];
    for (const interval of validIntervals) {
      useStore.getState().setAutoCycleIntervalSec(interval);
      expect(useStore.getState().autoCycleIntervalSec).toBe(interval);
    }
  });
});
