import { create } from 'zustand';
import type {
  SongInfo,
  LyricLine,
  BeatEvent,
  VisualizerMode,
  AppMode,
  AudioFeatures,
  PositionState,
} from './types';

const VISUALIZER_MODES: VisualizerMode[] = [
  'spectrum', 'radial', 'particles',
  'radical', 'nebula', 'vitals', 'synthwave', 'spaceage', 'starrynight', 'guitarhero', 'vynalize', 'beatsaber',
];

interface VinylStore {
  // Audio state
  isListening: boolean;
  audioFeatures: AudioFeatures | null;
  setListening: (v: boolean) => void;
  setAudioFeatures: (f: AudioFeatures) => void;

  // Song identification
  currentSong: SongInfo | null;
  isIdentifying: boolean;
  setCurrentSong: (s: SongInfo | null) => void;
  setIdentifying: (v: boolean) => void;

  // Beat detection
  bpm: number | null;
  lastBeat: BeatEvent | null;
  isBeat: boolean;
  setBpm: (bpm: number | null) => void;
  triggerBeat: (event: BeatEvent) => void;
  clearBeat: () => void;

  // Lyrics
  lyrics: LyricLine[];
  setLyrics: (lines: LyricLine[]) => void;

  // Position tracking
  position: PositionState;
  setPosition: (p: Partial<PositionState>) => void;
  resetPosition: () => void;
  adjustOffset: (deltaMs: number) => void;
  tapSync: (targetMs: number) => void;

  // Display modes
  appMode: AppMode;
  visualizerMode: VisualizerMode;
  setAppMode: (m: AppMode) => void;
  setVisualizerMode: (m: VisualizerMode) => void;

  // UI state
  isFullscreen: boolean;
  controlsVisible: boolean;
  setFullscreen: (v: boolean) => void;
  setControlsVisible: (v: boolean) => void;

  // Video
  videoId: string | null;
  videoSearching: boolean;
  videoOffsetMs: number;
  videoCheckpoint: { timeSec: number; at: number } | null;
  setVideoId: (id: string | null) => void;
  setVideoSearching: (v: boolean) => void;
  setVideoOffsetMs: (ms: number) => void;
  adjustVideoOffset: (deltaMs: number) => void;
  setVideoCheckpoint: (cp: { timeSec: number; at: number } | null) => void;

  // Accent color from album art
  accentColor: string;
  setAccentColor: (c: string) => void;

  // Audio input device selection
  audioInputDeviceId: string;
  setAudioInputDeviceId: (id: string) => void;

  // Sensitivity gain (global multiplier for audio values)
  sensitivityGain: number;
  setSensitivityGain: (g: number) => void;

  // Session
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  remoteConnected: boolean;
  setRemoteConnected: (v: boolean) => void;

  // Visualizer cycling
  nextVisualizer: () => void;
  prevVisualizer: () => void;
}

const defaultPosition: PositionState = {
  elapsedMs: 0,
  offsetMs: 0,
  isTracking: false,
  startedAt: null,
};

export const useStore = create<VinylStore>((set) => ({
  isListening: false,
  audioFeatures: null,
  setListening: (isListening) => set({ isListening }),
  setAudioFeatures: (audioFeatures) => set({ audioFeatures }),

  currentSong: null,
  isIdentifying: false,
  setCurrentSong: (currentSong) => set({ currentSong }),
  setIdentifying: (isIdentifying) => set({ isIdentifying }),

  bpm: null,
  lastBeat: null,
  isBeat: false,
  setBpm: (bpm) => set({ bpm }),
  triggerBeat: (lastBeat) => set({ lastBeat, isBeat: true }),
  clearBeat: () => set({ isBeat: false }),

  lyrics: [],
  setLyrics: (lyrics) => set({ lyrics }),

  position: defaultPosition,
  setPosition: (p) =>
    set((state) => ({ position: { ...state.position, ...p } })),
  resetPosition: () => set({ position: defaultPosition }),
  adjustOffset: (deltaMs) =>
    set((state) => ({
      position: { ...state.position, offsetMs: state.position.offsetMs + deltaMs },
    })),
  tapSync: (targetMs) =>
    set((state) => ({
      position: { ...state.position, offsetMs: targetMs - state.position.elapsedMs },
    })),

  appMode: 'visualizer',
  visualizerMode: 'spectrum',
  setAppMode: (appMode) => set({ appMode }),
  setVisualizerMode: (visualizerMode) => set({ visualizerMode }),

  isFullscreen: false,
  controlsVisible: true,
  setFullscreen: (isFullscreen) => set({ isFullscreen }),
  setControlsVisible: (controlsVisible) => set({ controlsVisible }),

  videoId: null,
  videoSearching: false,
  videoOffsetMs: 0,
  videoCheckpoint: null,
  setVideoId: (videoId) => set({ videoId, videoCheckpoint: null }),
  setVideoSearching: (videoSearching) => set({ videoSearching }),
  setVideoOffsetMs: (videoOffsetMs) => set({ videoOffsetMs }),
  adjustVideoOffset: (deltaMs) =>
    set((state) => ({ videoOffsetMs: state.videoOffsetMs + deltaMs })),
  setVideoCheckpoint: (videoCheckpoint) => set({ videoCheckpoint }),

  accentColor: '#8b5cf6',
  setAccentColor: (accentColor) => set({ accentColor }),

  audioInputDeviceId: localStorage.getItem('vv-audio-device') || '',
  setAudioInputDeviceId: (audioInputDeviceId) => {
    localStorage.setItem('vv-audio-device', audioInputDeviceId);
    set({ audioInputDeviceId });
  },

  sensitivityGain: parseFloat(localStorage.getItem('vv-sensitivity') || '1'),
  setSensitivityGain: (sensitivityGain) => {
    localStorage.setItem('vv-sensitivity', String(sensitivityGain));
    set({ sensitivityGain });
  },

  sessionId: null,
  setSessionId: (sessionId) => set({ sessionId }),
  remoteConnected: false,
  setRemoteConnected: (remoteConnected) => set({ remoteConnected }),

  nextVisualizer: () =>
    set((state) => {
      const idx = VISUALIZER_MODES.indexOf(state.visualizerMode);
      return { visualizerMode: VISUALIZER_MODES[(idx + 1) % VISUALIZER_MODES.length] };
    }),
  prevVisualizer: () =>
    set((state) => {
      const idx = VISUALIZER_MODES.indexOf(state.visualizerMode);
      return { visualizerMode: VISUALIZER_MODES[(idx - 1 + VISUALIZER_MODES.length) % VISUALIZER_MODES.length] };
    }),
}));
