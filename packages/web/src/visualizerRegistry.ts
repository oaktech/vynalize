import type { VisualizerMode } from './types';

export interface VisualizerMeta {
  id: VisualizerMode;
  label: string;
  tag: string;
}

export const VISUALIZER_REGISTRY: VisualizerMeta[] = [
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

export const VISUALIZER_MODES: VisualizerMode[] = VISUALIZER_REGISTRY.map((e) => e.id);
