import { lazy, Suspense } from 'react';
import { useStore } from '../../store';

// Lazy-load all visualizers — only the active one's code is loaded
const SpectrumBars = lazy(() => import('./SpectrumBars'));
const RadialSpectrum = lazy(() => import('./RadialSpectrum'));
const ParticleField = lazy(() => import('./ParticleField'));
const Radical = lazy(() => import('./Radical'));
const Nebula = lazy(() => import('./Nebula'));
const Vitals = lazy(() => import('./Vitals'));
const Synthwave = lazy(() => import('./Synthwave'));
const SpaceAge = lazy(() => import('./SpaceAge'));
const StarryNight = lazy(() => import('./StarryNight'));
const GuitarHero = lazy(() => import('./GuitarHero'));
const VynalizeLogo = lazy(() => import('./VynalizeLogo'));
const BeatSaber = lazy(() => import('./BeatSaber'));

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
          {visualizerMode === 'spectrum' && <SpectrumBars accentColor={accentColor} />}
          {visualizerMode === 'radial' && <RadialSpectrum accentColor={accentColor} />}
          {visualizerMode === 'particles' && <ParticleField />}
          {visualizerMode === 'radical' && <Radical accentColor={accentColor} />}
          {visualizerMode === 'nebula' && <Nebula accentColor={accentColor} />}
          {visualizerMode === 'vitals' && <Vitals accentColor={accentColor} />}
          {visualizerMode === 'synthwave' && <Synthwave accentColor={accentColor} />}
          {visualizerMode === 'spaceage' && <SpaceAge accentColor={accentColor} />}
          {visualizerMode === 'starrynight' && <StarryNight accentColor={accentColor} />}
          {visualizerMode === 'guitarhero' && <GuitarHero accentColor={accentColor} />}
          {visualizerMode === 'vynalize' && <VynalizeLogo accentColor={accentColor} />}
          {visualizerMode === 'beatsaber' && <BeatSaber accentColor={accentColor} />}
        </Suspense>
      </div>
    </div>
  );
}
