export interface SongInfo {
  title: string;
  artist: string;
  album: string;
  duration: number; // seconds
  albumArtUrl: string | null;
  musicbrainzId: string | null;
  bpm: number | null;
}

export interface LyricLine {
  timeMs: number;
  text: string;
}

export interface BeatEvent {
  timestamp: number;
  strength: number; // 0-1
}

export type VisualizerMode =
  | 'spectrum'
  | 'waveform'
  | 'radial'
  | 'particles'
  | 'geometric'
  | 'radical'
  | 'nebula'
  | 'vitals'
  | 'synthwave'
  | 'spaceage'
  | 'starrynight';

export type AppMode = 'visualizer' | 'lyrics' | 'video' | 'ascii';

export interface AudioFeatures {
  rms: number;
  energy: number;
  spectralCentroid: number;
  spectralFlux: number;
  zcr: number;
  loudness: { specific: Float32Array; total: number };
  mfcc: number[];
  frequencyData: Uint8Array;
  timeData: Uint8Array;
  bass: number;
  mid: number;
  high: number;
}

export interface PositionState {
  elapsedMs: number;
  offsetMs: number;
  isTracking: boolean;
  startedAt: number | null;
}
