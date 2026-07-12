import { useRef, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import { getVisDpr, applyGlow, clearGlow, getLowPowerCount, useVisualizerLoop, audioRef } from '../../utils/perfConfig';

// ── Constants ─────────────────────────────────────────────────

const CRAWL_YELLOW = '#FFE81F';
const CRAWL_YELLOW_RGB = '255, 232, 31';

// Perspective focal length in world units — higher = flatter convergence
// (also tightens vertical gaps between lines, since less of the crawl's
// height range is spent on the steep near-camera falloff)
const FOCAL = 460;

// Where the vanishing point sits as a fraction of canvas height
const VANISH_FRAC = 0.18;
// Crawl text enters from slightly below the canvas bottom
const BOTTOM_FRAC = 1.04;

// Max text block width (logical) as fraction of canvas width, at scale = 1
const MAX_WIDTH_FRAC = 0.62;

// Logical font size at full scale (scale = 1, bottom of crawl)
const BASE_FONT_SIZE = 54;

// Converts ms elapsed since a lyric fired into world-Z units.
// 1000ms ago → worldZ ≈ 55 → line is well up the crawl.
const WORLD_SCALE = 0.055;

const STAR_COUNT_FULL = 200;
const STAR_COUNT_LOW = 80;

interface Star {
  originX: number;
  originY: number;
  r: number;
  baseAlpha: number;
  phase: number;
  speed: number;
  driftX: number;
  driftY: number;
}

// ── Perspective projection ────────────────────────────────────
//
// Maps a lyric's elapsed-time distance to screen coordinates.
// worldZ = how long ago (in world units) this lyric became active —
// small = just arrived at the bottom, large = receding toward the horizon.
//
// Tune FOCAL to change drama: lower = more aggressive convergence.
function projectCrawlLine(
  worldZ: number,
  vanishY: number,
  bottomY: number,
): { screenY: number; scale: number } | null {
  if (worldZ < 0) return null;
  const scale = FOCAL / (worldZ + FOCAL);
  // scale=1 (worldZ≈0) → screenY=bottomY (just entered from bottom)
  // scale→0 (worldZ large) → screenY→vanishY (receding toward horizon)
  const screenY = vanishY + scale * (bottomY - vanishY);
  return { screenY, scale };
}

// ── Component ─────────────────────────────────────────────────

export default function StarWars({ accentColor: _accentColor }: { accentColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stars = useRef<Star[]>([]);
  const starsReady = useRef(false);
  const beatPulse = useRef(0);
  const prevBeat = useRef(false);
  // Self-driven clock for the idle crawl (title/artist), used when there
  // are no timed lyrics to follow — keeps the crawl moving instead of
  // sitting frozen on the title.
  const idleClockStart = useRef<number | null>(null);

  // Resize canvas to physical pixels
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.clientWidth * getVisDpr();
      canvas.height = canvas.clientHeight * getVisDpr();
      starsReady.current = false;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const dpr = getVisDpr();
    const features = audioRef.features;
    const timeSec = performance.now() / 1000;

    // Beat detection — one-frame pulse decaying at ~87% per frame
    if (audioRef.isBeat && !prevBeat.current) beatPulse.current = 1;
    prevBeat.current = audioRef.isBeat;
    beatPulse.current *= 0.87;

    const vanishY = height * VANISH_FRAC;
    const bottomY = height * BOTTOM_FRAC;
    const cx = width / 2;
    const maxHalfW = (width * MAX_WIDTH_FRAC) / 2;

    // ── Lazy-init star field ────────────────────────────────
    const starCount = getLowPowerCount(STAR_COUNT_FULL, STAR_COUNT_LOW);
    if (!starsReady.current) {
      stars.current = Array.from({ length: starCount }, () => {
        const angle = Math.random() * Math.PI * 2;
        // Bigger (nearer) stars drift faster — cheap parallax.
        const driftSpeed = (Math.random() * 8 + 4) * dpr;
        return {
          originX: Math.random() * width,
          originY: Math.random() * height,
          r: (Math.random() * 1.5 + 0.3) * dpr,
          baseAlpha: Math.random() * 0.55 + 0.2,
          phase: Math.random() * Math.PI * 2,
          speed: Math.random() * 1.8 + 0.5,
          driftX: Math.cos(angle) * driftSpeed,
          driftY: Math.sin(angle) * driftSpeed,
        };
      });
      starsReady.current = true;
    }

    // ── Background ──────────────────────────────────────────
    ctx.fillStyle = '#00000A';
    ctx.fillRect(0, 0, width, height);

    // ── Stars ───────────────────────────────────────────────
    // Position is a pure function of absolute time (origin + drift·t, wrapped)
    // rather than mutated state — frame-rate independent, no accumulation drift.
    for (const star of stars.current) {
      const twinkle = 0.5 + 0.5 * Math.sin(timeSec * star.speed + star.phase);
      const alpha = Math.min(1, star.baseAlpha + twinkle * 0.22 + beatPulse.current * 0.3);
      const r = star.r * (1 + beatPulse.current * 0.45);
      const x = ((star.originX + star.driftX * timeSec) % width + width) % width;
      const y = ((star.originY + star.driftY * timeSec) % height + height) % height;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 245, ${alpha})`;
      ctx.fill();
    }

    // ── Converging edge lines (decorative) ─────────────────
    ctx.save();
    ctx.strokeStyle = `rgba(${CRAWL_YELLOW_RGB}, 0.08)`;
    ctx.lineWidth = dpr;
    ctx.beginPath();
    ctx.moveTo(cx, vanishY);
    ctx.lineTo(cx + maxHalfW, height);
    ctx.moveTo(cx, vanishY);
    ctx.lineTo(cx - maxHalfW, height);
    ctx.stroke();
    ctx.restore();

    // ── Fetch live position ─────────────────────────────────
    const state = useStore.getState();
    const { lyrics, position, currentSong } = state;
    const hasLyrics = lyrics.length > 0;

    // When there are no timed lyrics yet, still crawl — loop the title
    // (and artist) through the same perspective scroll on a self-driven
    // clock, so the screen never just sits on a frozen title.
    let crawlLines: { timeMs: number; text: string }[];
    let posMs: number;
    if (hasLyrics) {
      crawlLines = lyrics;
      posMs = position.startedAt
        ? performance.now() - position.startedAt + position.offsetMs
        : 0;
      idleClockStart.current = null;
    } else if (currentSong) {
      crawlLines = currentSong.artist
        ? [
            { timeMs: 0, text: currentSong.title },
            { timeMs: 4000, text: `BY ${currentSong.artist}` },
          ]
        : [{ timeMs: 0, text: currentSong.title }];
      // Pause after the last line fully recedes (worldZ cap ≈ 54.5s past
      // its timeMs) before looping back to the start.
      const loopPeriodMs = crawlLines[crawlLines.length - 1].timeMs + 60000;
      if (idleClockStart.current === null) idleClockStart.current = performance.now();
      posMs = (performance.now() - idleClockStart.current) % loopPeriodMs;
    } else {
      crawlLines = [];
      posMs = 0;
    }

    // ── Crawl text ──────────────────────────────────────────
    ctx.save();
    // Clip to crawl area — text disappears above vanishing point
    ctx.beginPath();
    ctx.rect(0, vanishY, width, height - vanishY);
    ctx.clip();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Current line: last one whose timeMs has passed
    let currentIdx = -1;
    for (let i = 0; i < crawlLines.length; i++) {
      if (crawlLines[i].timeMs <= posMs) currentIdx = i;
      else break;
    }

    for (let i = 0; i < crawlLines.length; i++) {
      // worldZ = how far in the past this line is — grows as it recedes toward horizon
      const rawWorldZ = (posMs - crawlLines[i].timeMs) * WORLD_SCALE;
      if (rawWorldZ < 0) continue;    // not yet arrived
      if (rawWorldZ > 3000) continue; // too far past, nearly invisible

      const proj = projectCrawlLine(rawWorldZ, vanishY, bottomY);
      if (!proj) continue;

      const { screenY, scale } = proj;
      if (screenY < vanishY || screenY > bottomY + 10) continue;

      const fontSize = Math.max(3 * dpr, BASE_FONT_SIZE * scale * dpr);
      ctx.font = `bold ${fontSize}px "Arial Narrow", Arial, sans-serif`;

      // Fade distant lines — full brightness when scale ≥ 0.45
      const distanceFade = Math.min(1, scale / 0.45);
      const isCurrent = i === currentIdx;
      const maxLineWidth = width * MAX_WIDTH_FRAC * scale;

      if (isCurrent) {
        applyGlow(ctx, (16 + beatPulse.current * 14) * scale * dpr, CRAWL_YELLOW);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, distanceFade * 1.15)})`;
      } else {
        clearGlow(ctx);
        ctx.fillStyle = `rgba(${CRAWL_YELLOW_RGB}, ${distanceFade * 0.85})`;
      }

      ctx.fillText(crawlLines[i].text.toUpperCase(), cx, screenY, maxLineWidth);
    }

    clearGlow(ctx);
    ctx.restore();

    // ── Horizon fade — softens the vanishing point edge ─────
    const fadeGrad = ctx.createLinearGradient(0, vanishY - 2 * dpr, 0, vanishY + 40 * dpr);
    fadeGrad.addColorStop(0, '#00000A');
    fadeGrad.addColorStop(1, 'rgba(0,0,10,0)');
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(0, vanishY - 2 * dpr, width, 42 * dpr);

    // Suppress unused-var warning — accentColor reserved for future theming
    void features;
  }, []);

  useVisualizerLoop(canvasRef, draw, [draw]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
