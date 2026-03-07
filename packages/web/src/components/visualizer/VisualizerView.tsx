import { lazy, Suspense } from 'react';
import { useStore } from '../../store';
import type { VisualizerMode } from '../../types';

// Lazy-load all visualizers — only the active one's code is loaded.
// Static import() paths are required for Vite's code-splitting.
const components: Record<VisualizerMode, React.LazyExoticComponent<React.ComponentType<any>>> = {
  spectrum: lazy(() => import('./SpectrumBars')),
  radial: lazy(() => import('./RadialSpectrum')),
  particles: lazy(() => import('./ParticleField')),
  radical: lazy(() => import('./Radical')),
  nebula: lazy(() => import('./Nebula')),
  vitals: lazy(() => import('./Vitals')),
  synthwave: lazy(() => import('./Synthwave')),
  spaceage: lazy(() => import('./SpaceAge')),
  starrynight: lazy(() => import('./StarryNight')),
  guitarhero: lazy(() => import('./GuitarHero')),
  vynalize: lazy(() => import('./VynalizeLogo')),
  beatsaber: lazy(() => import('./BeatSaber')),
};

function VisualizerLoading() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
    </div>
  );
}

export default function VisualizerView() {
  const visualizerMode = useStore((s) => s.visualizerMode);
  const currentSong = useStore((s) => s.currentSong);
  const accentColor = useStore((s) => s.accentColor);

  const Component = components[visualizerMode];

  return (
    <div className="w-full h-full relative">
      {/* Album art background (blurred) */}
      {currentSong?.albumArtUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.07] blur-3xl scale-110"
          style={{ backgroundImage: `url(${currentSong.albumArtUrl})` }}
        />
      )}

      {/* Visualizer */}
      <div className="absolute inset-0">
        <Suspense fallback={<VisualizerLoading />}>
          {Component && <Component accentColor={accentColor} />}
        </Suspense>
      </div>
    </div>
  );
}
