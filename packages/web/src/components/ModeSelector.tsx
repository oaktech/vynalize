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
  { id: 'waveform', label: 'Waveform' },
  { id: 'radial', label: 'Radial' },
  { id: 'particles', label: 'Particles' },
  { id: 'geometric', label: 'Geometry' },
  { id: 'radical', label: 'Radical' },
  { id: 'nebula', label: 'Nebula' },
  { id: 'vitals', label: 'Vitals' },
  { id: 'synthwave', label: 'Synthwave' },
];

export default function ModeSelector() {
  const appMode = useStore((s) => s.appMode);
  const setAppMode = useStore((s) => s.setAppMode);
  const visualizerMode = useStore((s) => s.visualizerMode);
  const setVisualizerMode = useStore((s) => s.setVisualizerMode);
  const accentColor = useStore((s) => s.accentColor);

  return (
    <div className="flex flex-col gap-2">
      {/* App mode tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 backdrop-blur-sm">
        {appModes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setAppMode(mode.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              appMode === mode.id
                ? 'text-white shadow-sm'
                : 'text-white/40 hover:text-white/70'
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
            {mode.label}
          </button>
        ))}
      </div>

      {/* Visualizer sub-modes */}
      {appMode === 'visualizer' && (
        <div className="flex gap-1 pl-1">
          {vizModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setVisualizerMode(mode.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                visualizerMode === mode.id
                  ? 'text-white bg-white/10'
                  : 'text-white/30 hover:text-white/60'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
