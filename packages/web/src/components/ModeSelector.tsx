import { useStore } from '../store';
import type { AppMode, VisualizerMode } from '../types';

const appModes: { id: AppMode; label: string; icon: string }[] = [
  { id: 'visualizer', label: 'Visualizer', icon: 'M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z' },
  { id: 'lyrics', label: 'Lyrics', icon: 'M4 6h16M4 10h16M4 14h10M4 18h7' },
  { id: 'video', label: 'Video', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'ascii', label: 'ASCII', icon: 'M4 7V4h16v3M9 20h6M12 4v16' },
];

const vizModes: { id: VisualizerMode; label: string }[] = [
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
  { id: 'beatsaber', label: 'Beat Saber' },
];

export default function ModeSelector() {
  const appMode = useStore((s) => s.appMode);
  const setAppMode = useStore((s) => s.setAppMode);
  const visualizerMode = useStore((s) => s.visualizerMode);
  const setVisualizerMode = useStore((s) => s.setVisualizerMode);
  const accentColor = useStore((s) => s.accentColor);

  return (
    <div className="flex flex-col gap-2">
      {/* Visualizer sub-modes (above app mode tabs so they're closer to content) */}
      {appMode === 'visualizer' && (
        <div className="flex gap-1.5 sm:gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-0.5">
          {vizModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setVisualizerMode(mode.id)}
              className={`px-3 py-2 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-md text-xs font-medium transition-all flex-shrink-0 whitespace-nowrap active:scale-95 ${
                visualizerMode === mode.id
                  ? 'text-white bg-white/10'
                  : 'text-white/30 hover:text-white/60 active:text-white/60'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      )}

      {/* App mode tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 backdrop-blur-sm">
        {appModes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setAppMode(mode.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 py-2.5 sm:py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 ${
              appMode === mode.id
                ? 'text-white shadow-sm'
                : 'text-white/40 hover:text-white/70 active:text-white/70'
            }`}
            style={
              appMode === mode.id
                ? { backgroundColor: `${accentColor}33` }
                : undefined
            }
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={mode.icon} />
            </svg>
            <span className="text-[10px] sm:text-xs">{mode.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
