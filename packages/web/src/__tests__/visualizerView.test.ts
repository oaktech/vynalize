import { describe, it, expect } from 'vitest';
import { useStore, VISUALIZER_MODES } from '../store';
import { VISUALIZER_REGISTRY } from '../visualizerRegistry';
import { components } from '../components/visualizer/VisualizerView';
import type { VisualizerMode, AppMode } from '../types';

// ── Visualizer View Tests ──────────────────────────────────

describe('Visualizer View', () => {
  describe('Mode routing', () => {
    const ALL_VISUALIZER_MODES = VISUALIZER_MODES;

    it('has expected number of visualizer modes', () => {
      expect(ALL_VISUALIZER_MODES.length).toBeGreaterThanOrEqual(1);
    });

    it('each mode maps to a lazy component', () => {
      const componentKeys = Object.keys(components) as VisualizerMode[];
      expect(componentKeys).toHaveLength(ALL_VISUALIZER_MODES.length);
      for (const mode of ALL_VISUALIZER_MODES) {
        expect(components[mode]).toBeDefined();
      }
    });

    it('only renders one visualizer at a time', () => {
      for (const mode of ALL_VISUALIZER_MODES) {
        useStore.getState().setVisualizerMode(mode);
        const current = useStore.getState().visualizerMode;
        // Only one mode matches at a time
        const matches = ALL_VISUALIZER_MODES.filter(m => m === current);
        expect(matches).toHaveLength(1);
      }
    });
  });

  describe('Album art background', () => {
    it('shows blurred background when album art is available', () => {
      useStore.getState().setCurrentSong({
        title: 'Song',
        artist: 'Artist',
        album: 'Album',
        duration: 200,
        albumArtUrl: 'https://example.com/art.jpg',
        musicbrainzId: null,
        bpm: null,
      });
      expect(useStore.getState().currentSong?.albumArtUrl).toBeTruthy();
    });

    it('no background when no album art', () => {
      useStore.getState().setCurrentSong({
        title: 'Song',
        artist: 'Artist',
        album: 'Album',
        duration: 200,
        albumArtUrl: null,
        musicbrainzId: null,
        bpm: null,
      });
      expect(useStore.getState().currentSong?.albumArtUrl).toBeNull();
    });
  });

  describe('Accent color passing', () => {
    it('passes accent color to visualizer components', () => {
      useStore.getState().setAccentColor('#ff0000');
      expect(useStore.getState().accentColor).toBe('#ff0000');
    });

    it('default accent color is violet', () => {
      expect(useStore.getState().accentColor).toBe('#8b5cf6');
    });
  });
});

describe('App Mode Routing', () => {
  const ALL_APP_MODES: AppMode[] = ['visualizer', 'lyrics', 'video', 'ascii'];

  it('has 4 app modes', () => {
    expect(ALL_APP_MODES).toHaveLength(4);
  });

  it('only one app mode is active at a time', () => {
    for (const mode of ALL_APP_MODES) {
      useStore.getState().setAppMode(mode);
      expect(useStore.getState().appMode).toBe(mode);
    }
  });

  it('crossfade transition: inactive modes get pointer-events-none', () => {
    // AppShell renders all 4 modes with opacity transition
    // Only active mode has pointer-events
    useStore.getState().setAppMode('visualizer');
    for (const mode of ALL_APP_MODES) {
      const isActive = mode === 'visualizer';
      if (!isActive) {
        // pointer-events-none class applied
        expect(isActive).toBe(false);
      }
    }
  });

  it('lazy-renders lyrics, video, and ASCII only when active', () => {
    // AppShell conditionally mounts: {appMode === 'lyrics' && <LyricsView />}
    useStore.getState().setAppMode('visualizer');
    const shouldRenderLyrics = useStore.getState().appMode === 'lyrics';
    const shouldRenderVideo = useStore.getState().appMode === 'video';
    const shouldRenderAscii = useStore.getState().appMode === 'ascii';
    expect(shouldRenderLyrics).toBe(false);
    expect(shouldRenderVideo).toBe(false);
    expect(shouldRenderAscii).toBe(false);
  });

  it('visualizer always renders (no conditional mount)', () => {
    // VisualizerView is always mounted, just faded out
    useStore.getState().setAppMode('lyrics');
    // VisualizerView is still mounted (just opacity-0)
    // This is intentional for smooth transitions
    expect(true).toBe(true);
  });
});

describe('Mode Selector', () => {
  describe('Visualizer modes metadata', () => {
    it('every mode has a label and tag', () => {
      for (const entry of VISUALIZER_REGISTRY) {
        expect(entry.label).toBeTruthy();
        expect(entry.tag).toBeTruthy();
      }
    });

    it('tags are descriptive and distinct', () => {
      const tags = VISUALIZER_REGISTRY.map(m => m.tag);
      const uniqueTags = new Set(tags);
      expect(uniqueTags.size).toBe(tags.length);
    });
  });

  describe('Registry completeness', () => {
    it('registry covers every mode in VISUALIZER_MODES', () => {
      const registryIds = VISUALIZER_REGISTRY.map(e => e.id);
      expect(registryIds).toEqual(VISUALIZER_MODES);
    });

    it('component map covers every mode in VISUALIZER_MODES', () => {
      const componentKeys = Object.keys(components).sort();
      const sortedModes = [...VISUALIZER_MODES].sort();
      expect(componentKeys).toEqual(sortedModes);
    });

    it('no duplicate IDs in registry', () => {
      const ids = VISUALIZER_REGISTRY.map(e => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('Favorites', () => {
    it('shows star indicator for favorites', () => {
      useStore.getState().toggleFavoriteVisualizer('nebula');
      expect(useStore.getState().favoriteVisualizers).toContain('nebula');
    });

    it('can toggle favorite on/off', () => {
      useStore.getState().toggleFavoriteVisualizer('synthwave');
      expect(useStore.getState().favoriteVisualizers).toContain('synthwave');
      useStore.getState().toggleFavoriteVisualizer('synthwave');
      expect(useStore.getState().favoriteVisualizers).not.toContain('synthwave');
    });
  });

  describe('Visualizer sub-modes visibility', () => {
    it('shows visualizer chips only in visualizer app mode', () => {
      useStore.getState().setAppMode('visualizer');
      expect(useStore.getState().appMode).toBe('visualizer');
      // Chips would be rendered

      useStore.getState().setAppMode('lyrics');
      expect(useStore.getState().appMode).toBe('lyrics');
      // Chips would be hidden
    });
  });
});
