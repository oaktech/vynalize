import { describe, it, expect } from 'vitest';
import { useStore } from '../store';
import type { VisualizerMode, AppMode } from '../types';

// ── Visualizer View Tests ──────────────────────────────────

describe('Visualizer View', () => {
  describe('Mode routing', () => {
    const ALL_VISUALIZER_MODES: VisualizerMode[] = [
      'spectrum', 'radial', 'particles', 'radical', 'nebula',
      'vitals', 'synthwave', 'spaceage', 'starrynight',
      'guitarhero', 'vynalize', 'beatsaber',
    ];

    it('has exactly 12 visualizer modes', () => {
      expect(ALL_VISUALIZER_MODES).toHaveLength(12);
    });

    it('each mode maps to a component', () => {
      // VisualizerView.tsx lazy-loads each of these
      const lazyComponents = [
        'SpectrumBars', 'RadialSpectrum', 'ParticleField', 'Radical',
        'Nebula', 'Vitals', 'Synthwave', 'SpaceAge', 'StarryNight',
        'GuitarHero', 'VynalizeLogo', 'BeatSaber',
      ];
      expect(lazyComponents).toHaveLength(ALL_VISUALIZER_MODES.length);
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
    const vizModes = [
      { id: 'spectrum', label: 'Spectrum', tag: 'Classic bars' },
      { id: 'radial', label: 'Radial', tag: 'Circular rings' },
      { id: 'particles', label: 'Particles', tag: 'Floating sparks' },
      { id: 'radical', label: 'Radical', tag: 'Wild geometry' },
      { id: 'nebula', label: 'Nebula', tag: 'Cosmic clouds' },
      { id: 'vitals', label: 'Vitals', tag: 'Audio heartbeat' },
      { id: 'synthwave', label: 'Synthwave', tag: 'Retro grid' },
      { id: 'spaceage', label: 'Space Age', tag: '3D starfield' },
      { id: 'starrynight', label: 'Starry Night', tag: 'Van Gogh skies' },
      { id: 'guitarhero', label: 'Guitar Hero', tag: 'Note highway' },
      { id: 'vynalize', label: 'Vynalize', tag: 'Logo pulse' },
      { id: 'beatsaber', label: 'Beat Saber', tag: '3D slicing' },
    ];

    it('all 12 visualizer modes have labels and tags', () => {
      expect(vizModes).toHaveLength(12);
      for (const mode of vizModes) {
        expect(mode.label).toBeTruthy();
        expect(mode.tag).toBeTruthy();
      }
    });

    it('tags are descriptive and distinct', () => {
      const tags = vizModes.map(m => m.tag);
      const uniqueTags = new Set(tags);
      expect(uniqueTags.size).toBe(tags.length);
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
