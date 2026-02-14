import { lazy, Suspense } from 'react';
import { useStore } from '../../store';
import SpectrumBars from './SpectrumBars';
import Waveform from './Waveform';
import RadialSpectrum from './RadialSpectrum';
import Radical from './Radical';
import Nebula from './Nebula';
import Vitals from './Vitals';
import Synthwave from './Synthwave';
import SpaceAge from './SpaceAge';

// Lazy-load 3D visualizers (avoids loading Three.js until needed)
const ParticleField = lazy(() => import('./ParticleField'));
const GeometricShapes = lazy(() => import('./GeometricShapes'));

function ThreeLoading() {
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
        {visualizerMode === 'spectrum' && <SpectrumBars accentColor={accentColor} />}
        {visualizerMode === 'waveform' && <Waveform accentColor={accentColor} />}
        {visualizerMode === 'radial' && <RadialSpectrum accentColor={accentColor} />}
        {visualizerMode === 'particles' && (
          <Suspense fallback={<ThreeLoading />}>
            <ParticleField />
          </Suspense>
        )}
        {visualizerMode === 'geometric' && (
          <Suspense fallback={<ThreeLoading />}>
            <GeometricShapes />
          </Suspense>
        )}
        {visualizerMode === 'radical' && <Radical accentColor={accentColor} />}
        {visualizerMode === 'nebula' && <Nebula accentColor={accentColor} />}
        {visualizerMode === 'vitals' && <Vitals accentColor={accentColor} />}
        {visualizerMode === 'synthwave' && <Synthwave accentColor={accentColor} />}
        {visualizerMode === 'spaceage' && <SpaceAge accentColor={accentColor} />}
      </div>
    </div>
  );
}
