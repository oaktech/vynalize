import { useEffect, type RefObject } from 'react';
import { useStore } from '../store';
import type { AudioFeatures } from '../types';

// ── Shared audio state (bypasses React) ──────────────────────
// Written by useAudioAnalysis, read by visualizers via rAF — no
// React re-renders in the hot path.

export const audioRef = {
  features: null as AudioFeatures | null,
  bpm: 0,
  isBeat: false,
};

// ── Performance helpers ──────────────────────────────────────

/** Returns a halved DPR in low-power mode (Pi kiosk).
 *  At 0.5× native resolution, the canvas has 1/4 the pixels — CSS scales it up.
 *  Looks slightly softer but dramatically reduces GPU fill rate. */
export function getVisDpr(): number {
  return useStore.getState().lowPowerMode ? 0.5 : devicePixelRatio;
}

/** Set canvas shadow glow. No-ops in low-power mode. */
export function applyGlow(
  ctx: CanvasRenderingContext2D,
  blur: number,
  color: string,
): void {
  if (useStore.getState().lowPowerMode) return;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

/** Reset shadow after a glow draw call. */
export function clearGlow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowBlur = 0;
}

/** Returns a scaled-down count for particle systems in low-power mode. */
export function getLowPowerCount(full: number, reduced: number): number {
  return useStore.getState().lowPowerMode ? reduced : full;
}

/** Returns true when running in low-power mode. */
export function isLowPower(): boolean {
  return useStore.getState().lowPowerMode;
}

// ── Visualizer animation loop ────────────────────────────────
// Replaces the useEffect([audioFeatures]) pattern. Runs a self-
// throttled rAF loop that reads audio state from `audioRef`
// instead of triggering React re-renders on every frame.

type DrawFn = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) => void;

/**
 * Runs a rAF-driven draw loop, completely outside React's render cycle.
 * `draw` is called at ~60fps (desktop) or ~15fps (Pi).
 * Re-initializes only when `deps` change (e.g. accentColor).
 */
export function useVisualizerLoop(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  draw: DrawFn,
  deps: React.DependencyList,
): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let lastFrame = 0;
    const interval = isLowPower() ? 66 : 0; // 15fps cap on Pi, uncapped on desktop

    function loop(now: number) {
      if (interval && now - lastFrame < interval) {
        raf = requestAnimationFrame(loop);
        return;
      }
      lastFrame = now;
      draw(ctx!, canvas!.width, canvas!.height);
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
