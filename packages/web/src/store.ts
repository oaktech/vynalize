import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

  // WebSocket status
  wsStatus: 'connected' | 'connecting' | 'disconnected';
  setWsStatus: (s: 'connected' | 'connecting' | 'disconnected') => void;

  // Microphone error
  micError: string | null;
  setMicError: (e: string | null) => void;

  // Network status
  isOnline: boolean;
  setOnline: (v: boolean) => void;

  // Visualizer cycling
  nextVisualizer: () => void;
  prevVisualizer: () => void;

  // Song history (#25)
  songHistory: Array<{ song: SongInfo; identifiedAt: number }>;
  addSongToHistory: (song: SongInfo) => void;

  // Visualizer favorites & auto-cycle (#26)
  favoriteVisualizers: VisualizerMode[];
  toggleFavoriteVisualizer: (mode: VisualizerMode) => void;
  autoCycleEnabled: boolean;
  autoCycleIntervalSec: number;
  setAutoCycleEnabled: (v: boolean) => void;
  setAutoCycleIntervalSec: (s: number) => void;

  // Onboarding (#24)
  tutorialSeen: boolean;
  setTutorialSeen: (v: boolean) => void;

  // PWA install prompt dismissed (#28)
  installDismissed: boolean;
  setInstallDismissed: (v: boolean) => void;

  // Auto-play music videos when discovered
  autoPlayVideo: boolean;
  setAutoPlayVideo: (v: boolean) => void;

  // Low-power mode (auto-enabled on Pi kiosk — not persisted)
  lowPowerMode: boolean;
  setLowPowerMode: (v: boolean) => void;

  // Auth (not persisted — fetched from server)
  authUser: { id: number; email: string; displayName: string; avatarUrl: string | null; hasYoutubeApiKey: boolean } | null;
  authLoading: boolean;
  authRequired: boolean;
  setAuthUser: (u: VinylStore['authUser']) => void;
  setAuthLoading: (v: boolean) => void;
  setAuthRequired: (v: boolean) => void;
}

const defaultPosition: PositionState = {
  elapsedMs: 0,
  offsetMs: 0,
  isTracking: false,
  startedAt: null,
};

export const useStore = create<VinylStore>()(
  persist(
    (set) => ({
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

      audioInputDeviceId: '',
      setAudioInputDeviceId: (audioInputDeviceId) => set({ audioInputDeviceId }),

      sensitivityGain: 1,
      setSensitivityGain: (sensitivityGain) => set({ sensitivityGain }),

      sessionId: null,
      setSessionId: (sessionId) => set({ sessionId }),
      remoteConnected: false,
      setRemoteConnected: (remoteConnected) => set({ remoteConnected }),

      wsStatus: 'disconnected',
      setWsStatus: (wsStatus) => set({ wsStatus }),

      micError: null,
      setMicError: (micError) => set({ micError }),

      isOnline: navigator.onLine,
      setOnline: (isOnline) => set({ isOnline }),

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

      songHistory: [],
      addSongToHistory: (song) =>
        set((state) => {
          const entry = { song, identifiedAt: Date.now() };
          const filtered = state.songHistory.filter(
            (h) => !(h.song.title === song.title && h.song.artist === song.artist),
          );
          return { songHistory: [entry, ...filtered].slice(0, 50) };
        }),

      favoriteVisualizers: [],
      toggleFavoriteVisualizer: (mode) =>
        set((state) => {
          const favs = state.favoriteVisualizers;
          return {
            favoriteVisualizers: favs.includes(mode)
              ? favs.filter((m) => m !== mode)
              : [...favs, mode],
          };
        }),
      autoCycleEnabled: false,
      autoCycleIntervalSec: 30,
      setAutoCycleEnabled: (autoCycleEnabled) => set({ autoCycleEnabled }),
      setAutoCycleIntervalSec: (autoCycleIntervalSec) => set({ autoCycleIntervalSec }),

      tutorialSeen: false,
      setTutorialSeen: (tutorialSeen) => set({ tutorialSeen }),

      installDismissed: false,
      setInstallDismissed: (installDismissed) => set({ installDismissed }),

      autoPlayVideo: false,
      setAutoPlayVideo: (autoPlayVideo) => set({ autoPlayVideo }),

      lowPowerMode: false,
      setLowPowerMode: (lowPowerMode) => set({ lowPowerMode }),

      authUser: null,
      authLoading: true,
      authRequired: false,
      setAuthUser: (authUser) => set({ authUser }),
      setAuthLoading: (authLoading) => set({ authLoading }),
      setAuthRequired: (authRequired) => set({ authRequired }),
    }),
    {
      name: 'vynalize-store',
      partialize: (state) => ({
        appMode: state.appMode,
        visualizerMode: state.visualizerMode,
        sensitivityGain: state.sensitivityGain,
        audioInputDeviceId: state.audioInputDeviceId,
        accentColor: state.accentColor,
        songHistory: state.songHistory,
        favoriteVisualizers: state.favoriteVisualizers,
        autoCycleEnabled: state.autoCycleEnabled,
        autoCycleIntervalSec: state.autoCycleIntervalSec,
        tutorialSeen: state.tutorialSeen,
        installDismissed: state.installDismissed,
        autoPlayVideo: state.autoPlayVideo,
      }),
    },
  ),
);
