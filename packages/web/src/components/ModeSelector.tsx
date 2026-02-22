import { useStore } from '../store';
import type { AppMode, VisualizerMode } from '../types';

export const APP_MODES: AppMode[] = ['visualizer', 'lyrics', 'video', 'ascii'];

const appModes: { id: AppMode; label: string; icon: string }[] = [
  { id: 'visualizer', label: 'Visualizer', icon: 'M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z' },
  { id: 'lyrics', label: 'Lyrics', icon: 'M4 6h16M4 10h16M4 14h10M4 18h7' },
  { id: 'video', label: 'Video', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'ascii', label: 'ASCII', icon: 'M4 7V4h16v3M9 20h6M12 4v16' },
];

const vizModes: { id: VisualizerMode; label: string; tag: string }[] = [
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

export default function ModeSelector() {
  const appMode = useStore((s) => s.appMode);
  const setAppMode = useStore((s) => s.setAppMode);
  const visualizerMode = useStore((s) => s.visualizerMode);
  const setVisualizerMode = useStore((s) => s.setVisualizerMode);
  const accentColor = useStore((s) => s.accentColor);
  const favorites = useStore((s) => s.favoriteVisualizers);
  const toggleFav = useStore((s) => s.toggleFavoriteVisualizer);

  return (
    <div className="flex flex-col gap-2">
      {/* App mode tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 backdrop-blur-sm">
        {appModes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setAppMode(mode.id)}
            aria-label={`${mode.label} mode`}
            aria-pressed={appMode === mode.id}
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

      {/* Visualizer sub-modes */}
      {appMode === 'visualizer' && (
        <div className="flex gap-1.5 sm:gap-1 pl-1 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-0.5">
          {vizModes.map((mode) => {
            const isFav = favorites.includes(mode.id);
            const isActive = visualizerMode === mode.id;

            return (
              <div key={mode.id} className="flex-shrink-0 group relative">
                <button
                  onClick={() => setVisualizerMode(mode.id)}
                  aria-label={`${mode.label} visualizer — ${mode.tag}`}
                  aria-pressed={isActive}
                  className={`px-3 py-2 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-md text-xs font-medium transition-all whitespace-nowrap active:scale-95 ${
                    isActive
                      ? 'text-white bg-white/10'
                      : 'text-white/30 hover:text-white/60 active:text-white/60'
                  }`}
                >
                  {isFav && <span className="mr-1 text-amber-400/70">&#9733;</span>}
                  {mode.label}
                </button>
                {/* Favorite toggle on hover */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFav(mode.id); }}
                  aria-label={isFav ? `Remove ${mode.label} from favorites` : `Add ${mode.label} to favorites`}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/80 border border-white/10 text-[8px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {isFav ? '★' : '☆'}
                </button>
                {/* Tooltip with description */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/90 border border-white/10 rounded text-[10px] text-white/50 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {mode.tag}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
