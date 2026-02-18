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
  | 'radial'
  | 'particles'
  | 'radical'
  | 'nebula'
  | 'vitals'
  | 'synthwave'
  | 'spaceage'
  | 'starrynight'
  | 'guitarhero'
  | 'vynalize'
  | 'beatsaber';

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

// ── WebSocket message types ──────────────────────────────────

export type WsCommand =
  | { type: 'command'; action: 'setVisualizerMode'; value: VisualizerMode }
  | { type: 'command'; action: 'setAppMode'; value: AppMode }
  | { type: 'command'; action: 'setAccentColor'; value: string }
  | { type: 'command'; action: 'adjustSensitivity'; value: number }
  | { type: 'command'; action: 'nextVisualizer' }
  | { type: 'command'; action: 'prevVisualizer' }
  | { type: 'command'; action: 'adjustVideoOffset'; value: number };

export interface WsStateMessage {
  type: 'state';
  data: {
    visualizerMode: VisualizerMode;
    appMode: AppMode;
    accentColor: string;
    sensitivityGain: number;
  };
}

export interface WsSongMessage {
  type: 'song';
  data: SongInfo | null;
}

export interface WsBeatMessage {
  type: 'beat';
  bpm: number | null;
}

export interface WsSessionMessage {
  type: 'session';
  sessionId: string;
}

export interface WsRemoteStatusMessage {
  type: 'remoteStatus';
  connected: boolean;
  controllers: number;
}

export type WsMessage = WsCommand | WsStateMessage | WsSongMessage | WsBeatMessage | WsSessionMessage | WsRemoteStatusMessage;
