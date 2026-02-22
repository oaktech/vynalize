import { useStore } from '../store';

/** Returns a halved DPR in low-power mode (Pi kiosk).
 *  At 0.5× native resolution, the canvas has ¼ the pixels — CSS scales it up.
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
