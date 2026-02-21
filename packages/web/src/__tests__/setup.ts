import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { useStore } from '../store';

// ── Browser API mocks ──────────────────────────────────────

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

// Mock requestAnimationFrame / cancelAnimationFrame
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number);
vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));

// Mock AudioContext
class MockAnalyserNode {
  fftSize = 2048;
  frequencyBinCount = 1024;
  smoothingTimeConstant = 0.8;
  getByteFrequencyData = vi.fn((arr: Uint8Array) => arr.fill(0));
  getByteTimeDomainData = vi.fn((arr: Uint8Array) => arr.fill(128));
  getFloatFrequencyData = vi.fn((arr: Float32Array) => arr.fill(-100));
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockMediaStreamSource {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAudioContext {
  state: AudioContextState = 'running';
  sampleRate = 44100;
  createAnalyser = vi.fn(() => new MockAnalyserNode());
  createMediaStreamSource = vi.fn(() => new MockMediaStreamSource());
  close = vi.fn();
  suspend = vi.fn();
  resume = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
}
vi.stubGlobal('AudioContext', MockAudioContext);

// Mock MediaRecorder
class MockMediaRecorder {
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  static isTypeSupported = vi.fn(() => true);
  start = vi.fn(() => { this.state = 'recording'; });
  stop = vi.fn(() => {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['test'], { type: 'audio/webm' }) });
    this.onstop?.();
  });
}
vi.stubGlobal('MediaRecorder', MockMediaRecorder);

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
    enumerateDevices: vi.fn().mockResolvedValue([
      { kind: 'audioinput', deviceId: 'default', label: 'Default Microphone', groupId: '1' },
      { kind: 'audioinput', deviceId: 'device-2', label: 'USB Microphone', groupId: '2' },
    ]),
  },
});

// Mock Fullscreen API
document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined);
document.exitFullscreen = vi.fn().mockResolvedValue(undefined);

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  url: string;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => { this.readyState = MockWebSocket.CLOSED; });
  constructor(url: string) {
    this.url = url;
    // Auto-connect after microtask
    setTimeout(() => this.onopen?.(), 0);
  }
}
vi.stubGlobal('WebSocket', MockWebSocket);

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

// Mock HTMLCanvasElement
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  measureText: vi.fn(() => ({ width: 100 })),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  drawImage: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  putImageData: vi.fn(),
  setTransform: vi.fn(),
  resetTransform: vi.fn(),
  clip: vi.fn(),
  quadraticCurveTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  ellipse: vi.fn(),
  fillText: vi.fn(),
  strokeText: vi.fn(),
  setLineDash: vi.fn(),
  canvas: { width: 1920, height: 1080 },
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  shadowColor: '',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
});

// ── Reset store between tests ──────────────────────────────

afterEach(() => {
  // Reset Zustand store to initial state
  useStore.setState({
    isListening: false,
    audioFeatures: null,
    currentSong: null,
    isIdentifying: false,
    bpm: null,
    lastBeat: null,
    isBeat: false,
    lyrics: [],
    position: { elapsedMs: 0, offsetMs: 0, isTracking: false, startedAt: null },
    appMode: 'visualizer',
    visualizerMode: 'spectrum',
    isFullscreen: false,
    controlsVisible: true,
    videoId: null,
    videoSearching: false,
    videoOffsetMs: 0,
    videoCheckpoint: null,
    accentColor: '#8b5cf6',
    audioInputDeviceId: '',
    sensitivityGain: 1,
    sessionId: null,
    remoteConnected: false,
    wsStatus: 'disconnected',
    micError: null,
    isOnline: true,
    songHistory: [],
    favoriteVisualizers: [],
    autoCycleEnabled: false,
    autoCycleIntervalSec: 30,
    tutorialSeen: false,
    installDismissed: false,
  });
});
