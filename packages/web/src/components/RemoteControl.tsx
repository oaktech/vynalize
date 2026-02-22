import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useWsCommands } from '../hooks/useWsCommands';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import type { AppMode, VisualizerMode } from '../types';

const APP_MODES: { id: AppMode; label: string }[] = [
  { id: 'visualizer', label: 'Visual' },
  { id: 'lyrics', label: 'Lyrics' },
  { id: 'video', label: 'Video' },
  { id: 'ascii', label: 'ASCII' },
];

const VIZ_MODES: { id: VisualizerMode; label: string }[] = [
  { id: 'spectrum', label: 'Spectrum' },
  { id: 'radial', label: 'Radial' },
  { id: 'particles', label: 'Particles' },
  { id: 'radical', label: 'Radical' },
  { id: 'nebula', label: 'Nebula' },
  { id: 'vitals', label: 'Vitals' },
  { id: 'synthwave', label: 'Synthwave' },
  { id: 'spaceage', label: 'Space Age' },
  { id: 'starrynight', label: 'Starry Night' },
  { id: 'guitarhero', label: 'Guitar Hero' },
  { id: 'vynalize', label: 'Vynalize' },
];

const VIZ_COUNT = VIZ_MODES.length;

/* ─── Session Entry ─── */

function SessionEntry({ onJoin }: { onJoin: (code: string) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setError('Enter the code shown on your display');
      return;
    }
    setError('');
    onJoin(trimmed);
  };

  const accentColor = '#8b5cf6';

  return (
    <div
      className="min-h-screen text-white overflow-y-auto overscroll-y-contain"
      style={{
        backgroundColor: '#000',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="relative z-10 px-5 max-w-lg mx-auto flex flex-col min-h-screen">
        {/* Header — logo */}
        <div className="flex justify-center pt-16 mb-2">
          <img
            src="/vynalize-logo.png"
            alt="Vynalize"
            className="h-[100px] w-auto object-contain"
          />
        </div>
        <p className="text-center text-[15px] text-white/70 mb-10">
          Remote Control
        </p>

        {/* Code section */}
        <div className="mb-7">
          <p className="text-[11px] text-white/70 tracking-[1px] font-semibold mb-3 px-1">
            VYNALIZE.COM CODE
          </p>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="ENTER CODE"
            maxLength={6}
            aria-label="Session code"
            className="w-full text-center text-2xl py-4 px-4 text-white placeholder:text-white/45 focus:outline-none transition-colors"
            style={{
              height: 56,
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.25)',
              backgroundColor: 'rgba(255,255,255,0.12)',
              fontFamily: 'Menlo, monospace',
              letterSpacing: '8px',
            }}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
        </div>

        {/* Error */}
        {error && (
          <div
            className="mb-5 p-3 text-[13px]"
            style={{
              backgroundColor: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 12,
              color: '#ef4444',
            }}
          >
            {error}
          </div>
        )}

        {/* Connect button */}
        <button
          onClick={handleSubmit}
          className="w-full py-3.5 text-[15px] font-semibold text-white transition-all active:scale-95"
          style={{
            height: 48,
            borderRadius: 12,
            backgroundColor: code.length >= 4 ? accentColor : 'rgba(255,255,255,0.04)',
            opacity: code.length >= 4 ? 1 : 0.4,
          }}
        >
          Connect
        </button>

        {/* Spacer + footer */}
        <div className="flex-1" />
        <footer className="text-center pt-2 pb-4">
          <p className="text-[10px] text-white/15">Vynalize Remote v0.1.0</p>
        </footer>
      </div>
    </div>
  );
}

/* ─── Remote UI ─── */

function RemoteUI({
  sessionId,
  onDisconnect,
}: {
  sessionId: string | null;
  onDisconnect: () => void;
}) {
  const { send } = useWsCommands('controller', sessionId);

  const currentSong = useStore((s) => s.currentSong);
  const bpm = useStore((s) => s.bpm);
  const appMode = useStore((s) => s.appMode);
  const visualizerMode = useStore((s) => s.visualizerMode);
  const accentColor = useStore((s) => s.accentColor);
  const sensitivityGain = useStore((s) => s.sensitivityGain);
  const autoPlayVideo = useStore((s) => s.autoPlayVideo);
  const wsStatus = useStore((s) => s.wsStatus);

  const setAppMode = useCallback(
    (mode: AppMode) => {
      send({ type: 'command', action: 'setAppMode', value: mode });
    },
    [send],
  );

  const setVisualizerMode = useCallback(
    (mode: VisualizerMode) => {
      if (appMode !== 'visualizer') {
        send({ type: 'command', action: 'setAppMode', value: 'visualizer' });
      }
      send({ type: 'command', action: 'setVisualizerMode', value: mode });
    },
    [send, appMode],
  );

  const cyclePrev = useCallback(() => {
    send({ type: 'command', action: 'prevVisualizer' });
  }, [send]);

  const cycleNext = useCallback(() => {
    send({ type: 'command', action: 'nextVisualizer' });
  }, [send]);

  const setSensitivity = useCallback(
    (v: number) => {
      send({ type: 'command', action: 'adjustSensitivity', value: v });
    },
    [send],
  );

  const toggleAutoPlayVideo = useCallback(() => {
    send({ type: 'command', action: 'setAutoPlayVideo', value: !autoPlayVideo });
  }, [send, autoPlayVideo]);

  // Video sync
  const [syncFlash, setSyncFlash] = useState<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const adjustVideoOffset = useCallback(
    (deltaMs: number) => {
      send({ type: 'command', action: 'adjustVideoOffset', value: deltaMs });
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      setSyncFlash(deltaMs < 0 ? '\u22120.2s' : '+0.2s');
      syncTimerRef.current = setTimeout(() => setSyncFlash(null), 700);
    },
    [send],
  );

  // Visualizer chip scrolling
  const chipScrollRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const idx = VIZ_MODES.findIndex((m) => m.id === visualizerMode);
    const chip = chipRefs.current[idx];
    if (chip && chipScrollRef.current) {
      const container = chipScrollRef.current;
      const scrollLeft = chip.offsetLeft - 80;
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    }
  }, [visualizerMode]);

  const activeVizLabel =
    VIZ_MODES.find((m) => m.id === visualizerMode)?.label ?? visualizerMode;

  return (
    <div
      className="min-h-screen text-white overflow-y-auto overscroll-y-contain"
      style={{
        backgroundColor: '#050505',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="relative z-10 px-6 max-w-lg mx-auto flex flex-col">
        {/* 1. Header — Logo */}
        <div className="flex justify-center pt-3 mb-2">
          <img
            src="/vynalize-logo.png"
            alt="Vynalize"
            className="h-[80px] w-auto object-contain"
          />
        </div>

        {/* Status row */}
        <div className="flex items-center justify-end gap-3 mb-5">
          {wsStatus !== 'connected' && (
            <span
              className="text-[11px] font-semibold px-2 py-1 rounded-md"
              style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
            >
              Reconnecting...
            </span>
          )}
          {bpm != null && (
            <div className="flex items-center gap-1.5">
              <span
                className="block w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: accentColor }}
              />
              <span className="text-[13px] tabular-nums text-white/50" style={{ fontFamily: 'Menlo, monospace' }}>
                {bpm} <span className="text-[10px] text-white/30">BPM</span>
              </span>
            </div>
          )}
        </div>

        {/* 2. Now Playing Hero */}
        <section
          className="mb-7 p-4"
          style={{
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.08)',
            borderTopWidth: 3,
            borderTopColor: accentColor,
            backgroundColor: `${accentColor}08`,
          }}
        >
          {currentSong ? (
            <div className="flex items-center gap-4">
              {currentSong.albumArtUrl ? (
                <img
                  src={currentSong.albumArtUrl}
                  alt={currentSong.album}
                  className="w-[88px] h-[88px] rounded-2xl shadow-lg object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-[88px] h-[88px] rounded-2xl flex items-center justify-center flex-shrink-0 text-[32px] text-white/20"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                >
                  {'\u266B'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[18px] font-bold text-white truncate leading-snug">
                  {currentSong.title}
                </p>
                <p className="text-[15px] text-white/60 truncate mt-0.5">
                  {currentSong.artist}
                </p>
                {currentSong.album && (
                  <p className="text-[13px] text-white/30 truncate mt-1">
                    {currentSong.album}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-6">
              <p className="text-[16px] text-white/25 font-medium">Listening...</p>
            </div>
          )}
        </section>

        {/* Video Sync — rewind / fast-forward */}
        {appMode === 'video' && currentSong && (
          <div className="flex items-center justify-center gap-4 -mt-3 mb-7">
            <button
              onClick={() => adjustVideoOffset(-200)}
              className="w-[52px] h-[52px] rounded-full flex items-center justify-center text-[24px] font-light active:scale-90 transition-transform"
              style={{ backgroundColor: `${accentColor}14`, color: accentColor }}
            >
              {'\u2039\u2039'}
            </button>
            <span
              className="text-[15px] font-medium transition-colors"
              style={{ color: syncFlash != null ? accentColor : 'rgba(255,255,255,0.25)' }}
            >
              {syncFlash ?? 'Video sync'}
            </span>
            <button
              onClick={() => adjustVideoOffset(200)}
              className="w-[52px] h-[52px] rounded-full flex items-center justify-center text-[24px] font-light active:scale-90 transition-transform"
              style={{ backgroundColor: `${accentColor}14`, color: accentColor }}
            >
              {'\u203A\u203A'}
            </button>
          </div>
        )}

        {/* 3. Display Mode — Segmented Control */}
        <section className="mb-7">
          <p className="text-[12px] text-white/40 font-medium mb-3">Display mode</p>
          <div
            className="flex p-[3px]"
            style={{
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {APP_MODES.map((mode) => {
              const active = appMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setAppMode(mode.id)}
                  className="flex-1 flex items-center justify-center text-[14px] font-semibold transition-all active:scale-95"
                  style={{
                    borderRadius: 20,
                    backgroundColor: active ? accentColor : 'transparent',
                    color: active ? '#fff' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* 4. Visualizer Picker */}
        <section className="mb-7">
          <p className="text-[12px] text-white/40 font-medium mb-3">Visualizer</p>

          {/* Nav row — arrows + current name */}
          <div className="flex items-center justify-center gap-5 mb-3.5">
            <button
              onClick={cyclePrev}
              aria-label="Previous visualizer"
              className="w-10 h-10 rounded-full flex items-center justify-center text-[24px] font-light text-white/50 active:scale-90 transition-transform"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
            >
              {'\u2039'}
            </button>
            <span className="text-[16px] font-semibold text-white min-w-[100px] text-center">
              {activeVizLabel}
            </span>
            <button
              onClick={cycleNext}
              aria-label="Next visualizer"
              className="w-10 h-10 rounded-full flex items-center justify-center text-[24px] font-light text-white/50 active:scale-90 transition-transform"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
            >
              {'\u203A'}
            </button>
          </div>

          {/* Horizontal chip scroll */}
          <div
            ref={chipScrollRef}
            className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
            style={{ scrollBehavior: 'smooth' }}
          >
            {VIZ_MODES.map((mode, i) => {
              const active = visualizerMode === mode.id;
              return (
                <button
                  key={mode.id}
                  ref={(el) => { chipRefs.current[i] = el; }}
                  onClick={() => setVisualizerMode(mode.id)}
                  className="flex-shrink-0 flex items-center justify-center px-4 text-[13px] font-medium transition-all active:scale-95"
                  style={{
                    height: 36,
                    borderRadius: 22,
                    backgroundColor: active ? accentColor : 'rgba(255,255,255,0.08)',
                    color: active ? '#fff' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* 5. Sensitivity Slider */}
        <section className="mb-7">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[12px] text-white/40 font-medium">Sensitivity</p>
            <span
              className="text-[13px] tabular-nums text-white/40"
              style={{ fontFamily: 'Menlo, monospace' }}
            >
              {sensitivityGain.toFixed(1)}x
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="2.0"
            step="0.05"
            value={sensitivityGain}
            onChange={(e) => setSensitivity(parseFloat(e.target.value))}
            aria-label="Audio sensitivity"
            className="w-full h-11 appearance-none bg-transparent cursor-pointer touch-none"
          />
        </section>

        {/* Auto-play video toggle */}
        <section className="mb-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[14px] font-medium text-white/80">Auto-play videos</p>
              <p className="text-[11px] text-white/35 mt-0.5">Switch to video when discovered</p>
            </div>
            <button
              onClick={toggleAutoPlayVideo}
              role="switch"
              aria-checked={autoPlayVideo}
              aria-label="Auto-play videos"
              className="relative flex-shrink-0 w-[51px] h-[31px] rounded-full transition-colors duration-200"
              style={{
                backgroundColor: autoPlayVideo ? accentColor : 'rgba(255,255,255,0.15)',
              }}
            >
              <span
                className="absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white shadow transition-transform duration-200"
                style={{
                  transform: autoPlayVideo ? 'translateX(20px)' : 'translateX(0)',
                }}
              />
            </button>
          </div>
        </section>

        {/* Install prompt */}
        <InstallBanner />

        {/* 6. Disconnect */}
        <button
          onClick={onDisconnect}
          className="self-center py-3 px-6 mb-4 text-[14px] font-medium text-white/30 active:text-white/50 transition-colors"
        >
          Disconnect
        </button>
      </div>

      {/* Slider + scrollbar styles */}
      <style>{`
        input[type="range"]::-webkit-slider-runnable-track {
          height: 4px;
          border-radius: 2px;
          background: rgba(255,255,255,0.08);
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: ${accentColor};
          margin-top: -12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1);
        }
        input[type="range"]::-moz-range-track {
          height: 4px;
          border-radius: 2px;
          background: rgba(255,255,255,0.08);
          border: none;
        }
        input[type="range"]::-moz-range-thumb {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: ${accentColor};
          border: none;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1);
        }
      `}</style>
    </div>
  );
}

/* ─── Install Banner ─── */

function InstallBanner() {
  const { canShow, promptInstall, dismiss } = useInstallPrompt();
  if (!canShow) return null;
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.08] bg-white/[0.03] mb-4">
      <div className="flex-1">
        <p className="text-sm font-medium text-white/80">Add to Home Screen</p>
        <p className="text-[11px] text-white/35 mt-0.5">Quick access to the remote</p>
      </div>
      <button
        onClick={promptInstall}
        className="px-4 py-2 text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors"
      >
        Install
      </button>
      <button onClick={dismiss} className="p-1.5 text-white/25 hover:text-white/50" aria-label="Dismiss">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/* ─── Root ─── */

export default function RemoteControl() {
  const urlSession = new URLSearchParams(window.location.search).get('session');
  const [sessionId, setSessionId] = useState<string | null>(urlSession);
  const [requireCode, setRequireCode] = useState(true);
  const [loading, setLoading] = useState(!urlSession);

  useEffect(() => {
    if (urlSession) return;
    fetch('/api/config')
      .then((r) => r.json())
      .then((cfg) => setRequireCode(cfg.requireCode))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [urlSession]);

  const handleDisconnect = useCallback(() => {
    setSessionId(null);
    // Clear session from URL without reload
    const url = new URL(window.location.href);
    url.searchParams.delete('session');
    window.history.replaceState({}, '', url.toString());
  }, []);

  if (loading) return null;

  if (!sessionId && requireCode) {
    return <SessionEntry onJoin={setSessionId} />;
  }

  return <RemoteUI sessionId={sessionId} onDisconnect={handleDisconnect} />;
}
