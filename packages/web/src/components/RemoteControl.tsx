import { useCallback } from 'react';
import { useStore } from '../store';
import { useWsCommands } from '../hooks/useWsCommands';
import type { AppMode, VisualizerMode } from '../types';

const APP_MODES: { id: AppMode; label: string; icon: JSX.Element }[] = [
  {
    id: 'visualizer',
    label: 'Visual',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z" />
      </svg>
    ),
  },
  {
    id: 'lyrics',
    label: 'Lyrics',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M4 6h16M4 10h16M4 14h10M4 18h7" />
      </svg>
    ),
  },
  {
    id: 'video',
    label: 'Video',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    id: 'ascii',
    label: 'ASCII',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M4 7V4h16v3M9 20h6M12 4v16" />
      </svg>
    ),
  },
];

const VIZ_MODES: { id: VisualizerMode; label: string }[] = [
  { id: 'spectrum', label: 'Spectrum' },
  { id: 'waveform', label: 'Waveform' },
  { id: 'radial', label: 'Radial' },
  { id: 'particles', label: 'Particles' },
  { id: 'geometric', label: 'Geometry' },
  { id: 'radical', label: 'Radical' },
  { id: 'nebula', label: 'Nebula' },
  { id: 'vitals', label: 'Vitals' },
  { id: 'synthwave', label: 'Synthwave' },
  { id: 'spaceage', label: 'Space Age' },
  { id: 'starrynight', label: 'Starry Night' },
];

export default function RemoteControl() {
  const { send } = useWsCommands('controller');

  const currentSong = useStore((s) => s.currentSong);
  const bpm = useStore((s) => s.bpm);
  const appMode = useStore((s) => s.appMode);
  const visualizerMode = useStore((s) => s.visualizerMode);
  const accentColor = useStore((s) => s.accentColor);
  const sensitivityGain = useStore((s) => s.sensitivityGain);

  const setAppMode = useCallback(
    (mode: AppMode) => {
      send({ type: 'command', action: 'setAppMode', value: mode });
    },
    [send],
  );

  const setVisualizerMode = useCallback(
    (mode: VisualizerMode) => {
      send({ type: 'command', action: 'setVisualizerMode', value: mode });
    },
    [send],
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

  return (
    <div
      className="min-h-screen bg-black text-white overflow-y-auto overscroll-y-contain"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      {/* ── Ambient glow from accent color ── */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.07]"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${accentColor}, transparent 70%)`,
        }}
      />

      <div className="relative z-10 px-5 py-6 max-w-lg mx-auto flex flex-col gap-7">
        {/* ── Header ── */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white/90">
              Vinyl Visions
            </h1>
            <p className="text-[11px] text-white/30 tracking-wide uppercase mt-0.5">
              Remote
            </p>
          </div>
          {bpm && (
            <div className="flex items-center gap-2">
              <span
                className="block w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: accentColor }}
              />
              <span className="text-sm font-mono tabular-nums text-white/50">
                {bpm} <span className="text-[10px] text-white/30">BPM</span>
              </span>
            </div>
          )}
        </header>

        {/* ── Now Playing ── */}
        <section className="relative rounded-2xl overflow-hidden">
          {/* Album art backdrop */}
          {currentSong?.albumArtUrl && (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-20 blur-2xl scale-125"
              style={{ backgroundImage: `url(${currentSong.albumArtUrl})` }}
            />
          )}
          <div
            className="relative p-5 rounded-2xl border border-white/[0.06]"
            style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
          >
            {currentSong ? (
              <div className="flex items-center gap-4">
                {currentSong.albumArtUrl ? (
                  <img
                    src={currentSong.albumArtUrl}
                    alt={currentSong.album}
                    className="w-20 h-20 rounded-xl shadow-lg object-cover flex-shrink-0 ring-1 ring-white/10"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-white/25"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-white truncate leading-snug">
                    {currentSong.title}
                  </p>
                  <p className="text-sm text-white/60 truncate mt-0.5">
                    {currentSong.artist}
                  </p>
                  {currentSong.album && (
                    <p className="text-xs text-white/30 truncate mt-1">
                      {currentSong.album}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 py-2">
                <div className="w-20 h-20 rounded-xl bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-white/15"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-white/25">Waiting for music...</p>
                  <p className="text-xs text-white/15 mt-1">
                    Play a record on the connected display
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── App Mode Selector ── */}
        <section>
          <p className="text-[11px] text-white/30 tracking-wide uppercase mb-3 px-0.5">
            Display Mode
          </p>
          <div className="grid grid-cols-4 gap-2">
            {APP_MODES.map((mode) => {
              const active = appMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setAppMode(mode.id)}
                  className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl border transition-all active:scale-95"
                  style={{
                    borderColor: active ? `${accentColor}55` : 'rgba(255,255,255,0.06)',
                    backgroundColor: active ? `${accentColor}18` : 'rgba(255,255,255,0.02)',
                  }}
                >
                  <span style={{ color: active ? accentColor : 'rgba(255,255,255,0.4)' }}>
                    {mode.icon}
                  </span>
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)' }}
                  >
                    {mode.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Visualizer Modes ── */}
        <section>
          <div className="flex items-center justify-between mb-3 px-0.5">
            <p className="text-[11px] text-white/30 tracking-wide uppercase">
              Visualizer
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={cyclePrev}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/50 active:scale-90 active:bg-white/[0.08] transition-all"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                onClick={cycleNext}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/50 active:scale-90 active:bg-white/[0.08] transition-all"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {VIZ_MODES.map((mode) => {
              const active = visualizerMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setVisualizerMode(mode.id)}
                  className="py-3 px-2 rounded-xl border text-[12px] font-medium transition-all active:scale-95"
                  style={{
                    borderColor: active ? `${accentColor}55` : 'rgba(255,255,255,0.06)',
                    backgroundColor: active ? `${accentColor}18` : 'rgba(255,255,255,0.02)',
                    color: active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
                  }}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Sensitivity ── */}
        <section>
          <div className="flex items-center justify-between mb-3 px-0.5">
            <p className="text-[11px] text-white/30 tracking-wide uppercase">
              Sensitivity
            </p>
            <span className="text-xs font-mono tabular-nums text-white/40">
              {sensitivityGain.toFixed(1)}x
            </span>
          </div>
          <div className="relative">
            <input
              type="range"
              min="0.1"
              max="2.0"
              step="0.05"
              value={sensitivityGain}
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
              className="w-full h-12 appearance-none bg-transparent cursor-pointer touch-none"
              style={
                {
                  '--track-color': 'rgba(255,255,255,0.06)',
                  '--fill-color': accentColor,
                  WebkitAppearance: 'none',
                } as React.CSSProperties
              }
            />
            {/* Track labels */}
            <div className="flex justify-between px-0.5 -mt-1">
              <span className="text-[10px] text-white/20">Line-in</span>
              <span className="text-[10px] text-white/20">Mic</span>
              <span className="text-[10px] text-white/20">Boost</span>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="text-center pt-2 pb-4">
          <p className="text-[10px] text-white/15">
            Vinyl Visions Remote v0.1.0
          </p>
        </footer>
      </div>

      {/* ── Slider styles ── */}
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
