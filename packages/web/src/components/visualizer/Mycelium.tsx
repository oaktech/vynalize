import { useRef, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import { getVisDpr, applyGlow, clearGlow, getLowPowerCount, isLowPower, useVisualizerLoop, audioRef } from '../../utils/perfConfig';

// ── Constants ─────────────────────────────────────────────────

// Growth speed in canvas px/sec at dpr=1 and a 120bpm reference tempo.
const BASE_SPEED = 24;
// How aggressively tips wander (curl) as they grow, in rad/sec.
const WANDER_STRENGTH = 1.3;
// How strongly tips steer away from the colony's base point — keeps the
// structure fanning outward instead of curling back on itself.
const OUTWARD_BIAS = 0.9;
// Baseline forking probability density (chance per second, scaled by dt).
const BRANCH_CHANCE = 0.16;
const MAX_GENERATION = 6;

const MAX_TIPS_FULL = 40;
const MAX_TIPS_LOW = 16;
const MIN_TIPS = 5;

const SPORE_COUNT_FULL = 50;
const SPORE_COUNT_LOW = 18;

interface Tip {
  x: number;
  y: number;
  angle: number;
  seed: number;
  age: number;
  maxAge: number;
  generation: number;
}

interface Spore {
  originX: number;
  originY: number;
  driftX: number;
  driftY: number;
  r: number;
  phase: number;
  speed: number;
}

// Shortest signed angular distance from `a` to `b`, wrapped to [-π, π].
function angleDiff(a: number, b: number): number {
  return ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

// Timbre → hue: dark/bassy spectra read as warm coral pink-red,
// bright/trebly spectra read as cool bioluminescent teal-green.
function timbreHue(centroidNorm: number): number {
  return 350 - centroidNorm * 175;
}

function branchWidth(bass: number, generation: number, dpr: number): number {
  const base = 1.4 + Math.min(1, bass) * 7.5;
  return Math.max(0.6, base / (1 + generation * 0.4)) * dpr;
}

function spawnTip(baseX: number, baseY: number, generation: number, angle: number): Tip {
  return {
    x: baseX,
    y: baseY,
    angle,
    seed: Math.random() * 1000,
    age: 0,
    maxAge: (9 + Math.random() * 7) / (1 + generation * 0.15),
    generation,
  };
}

// ── Component ─────────────────────────────────────────────────

export default function Mycelium({ accentColor: _accentColor }: { accentColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const growthCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tipsRef = useRef<Tip[]>([]);
  const sporesRef = useRef<Spore[]>([]);
  const sporesReady = useRef(false);
  const lastFrameTime = useRef(0);
  const beatPulse = useRef(0);
  const prevBeat = useRef(false);
  const smooth = useRef({ bass: 0, centroid: 0 });
  const currentSong = useStore((s) => s.currentSong);

  const seedColony = useCallback((width: number, height: number) => {
    const growth = growthCanvasRef.current;
    if (growth) {
      const gctx = growth.getContext('2d');
      gctx?.clearRect(0, 0, growth.width, growth.height);
    }
    const seedCount = Math.min(4, getLowPowerCount(MAX_TIPS_FULL, MAX_TIPS_LOW));
    tipsRef.current = Array.from({ length: seedCount }, () => {
      const baseX = width * (0.3 + Math.random() * 0.4);
      const baseY = height * (0.98 + Math.random() * 0.05);
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.7;
      return spawnTip(baseX, baseY, 0, angle);
    });
    lastFrameTime.current = 0;
  }, []);

  // Resize canvas + persistent growth layer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const w = canvas.clientWidth * getVisDpr();
      const h = canvas.clientHeight * getVisDpr();
      canvas.width = w;
      canvas.height = h;
      if (!growthCanvasRef.current) {
        growthCanvasRef.current = document.createElement('canvas');
      }
      growthCanvasRef.current.width = w;
      growthCanvasRef.current.height = h;
      sporesReady.current = false;
      seedColony(w, h);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [seedColony]);

  // Fresh colony per song
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width) return;
    seedColony(canvas.width, canvas.height);
  }, [currentSong, seedColony]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const dpr = getVisDpr();
    const growth = growthCanvasRef.current;
    if (!growth) return;
    const gctx = growth.getContext('2d');
    if (!gctx) return;

    const now = performance.now();
    const timeSec = now / 1000;
    const lowPower = isLowPower();

    // Beat pulse — one-frame spike decaying at ~87% per frame
    if (audioRef.isBeat && !prevBeat.current) beatPulse.current = 1;
    prevBeat.current = audioRef.isBeat;
    beatPulse.current *= 0.87;
    const pulse = beatPulse.current;

    // Frame-rate independent dt, clamped so a backgrounded tab doesn't
    // cause the whole colony to leap forward on return.
    const dt = lastFrameTime.current === 0 ? 0 : Math.min((now - lastFrameTime.current) / 1000, 0.08);
    lastFrameTime.current = now;

    const baseX = width * 0.5;
    const baseY = height * 1.02;

    // ── Background ──────────────────────────────────────────
    ctx.fillStyle = '#020a09';
    ctx.fillRect(0, 0, width, height);

    // ── Ambient spores (drifting motes) ─────────────────────
    const sporeCount = getLowPowerCount(SPORE_COUNT_FULL, SPORE_COUNT_LOW);
    if (!sporesReady.current) {
      sporesRef.current = Array.from({ length: sporeCount }, () => ({
        originX: Math.random() * width,
        originY: Math.random() * height,
        driftX: (Math.random() - 0.5) * 6 * dpr,
        driftY: -(Math.random() * 5 + 2) * dpr,
        r: (Math.random() * 1.2 + 0.4) * dpr,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 1.5 + 0.4,
      }));
      sporesReady.current = true;
    }
    const hueNow = timbreHue(smooth.current.centroid);
    for (const spore of sporesRef.current) {
      const x = ((spore.originX + spore.driftX * timeSec) % width + width) % width;
      const y = ((spore.originY + spore.driftY * timeSec) % height + height) % height;
      const twinkle = 0.5 + 0.5 * Math.sin(timeSec * spore.speed + spore.phase);
      const alpha = 0.15 + twinkle * 0.25 + pulse * 0.15;
      ctx.beginPath();
      ctx.arc(x, y, spore.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hueNow}, 70%, 70%, ${alpha})`;
      ctx.fill();
    }

    // ── Audio-driven growth ──────────────────────────────────
    const audioFeatures = audioRef.features;
    if (audioFeatures && dt > 0) {
      const sm = smooth.current;
      const rawBass = audioFeatures.bass ?? 0;
      sm.bass += (rawBass - sm.bass) * (rawBass > sm.bass ? 0.4 : 0.12);

      const centroidNorm = Math.min((audioFeatures.spectralCentroid ?? 0) / 260, 1);
      sm.centroid += (centroidNorm - sm.centroid) * 0.08;

      const flux = audioFeatures.spectralFlux ?? 0;
      const bpm = audioRef.bpm || 100;
      const tempoFactor = 0.4 + (bpm / 120) * 0.9;
      const speed = BASE_SPEED * dpr * tempoFactor;
      const maxTips = getLowPowerCount(MAX_TIPS_FULL, MAX_TIPS_LOW);
      const hue = timbreHue(sm.centroid);

      gctx.lineCap = 'round';
      gctx.lineJoin = 'round';

      const tips = tipsRef.current;
      const nextTips: Tip[] = [];
      const margin = 60 * dpr;

      for (const tip of tips) {
        tip.age += dt;
        const offCanvas = tip.x < -margin || tip.x > width + margin || tip.y < -margin;
        if (tip.age > tip.maxAge || offCanvas) continue; // dies — not carried into nextTips

        // Organic curl via layered sine wander, seeded per-tip so each
        // branch has its own personality.
        const wander =
          Math.sin(timeSec * 0.6 + tip.seed) * 0.6 + Math.sin(timeSec * 1.7 + tip.seed * 2.3) * 0.35;
        tip.angle += wander * WANDER_STRENGTH * dt;

        // Gentle steering away from the colony base — keeps the whole
        // structure fanning outward rather than tangling on itself.
        const outward = Math.atan2(tip.y - baseY, tip.x - baseX);
        tip.angle += angleDiff(tip.angle, outward) * OUTWARD_BIAS * dt;

        const nx = tip.x + Math.cos(tip.angle) * speed * dt;
        const ny = tip.y + Math.sin(tip.angle) * speed * dt;

        const w = branchWidth(sm.bass, tip.generation, dpr);
        const ageFade = 1 - tip.age / tip.maxAge;
        gctx.strokeStyle = `hsla(${hue}, 82%, ${52 + pulse * 10}%, ${0.55 + ageFade * 0.4})`;
        gctx.lineWidth = w;
        gctx.beginPath();
        gctx.moveTo(tip.x, tip.y);
        gctx.lineTo(nx, ny);
        gctx.stroke();

        tip.x = nx;
        tip.y = ny;
        nextTips.push(tip);

        // Forking — more likely on transients (spectral flux) and thicker
        // (bassier) growth, capped by generation depth and tip budget.
        const branchChance = (BRANCH_CHANCE + flux * 0.5) * dt;
        if (tip.generation < MAX_GENERATION && nextTips.length + tips.length < maxTips && Math.random() < branchChance) {
          const spread = 0.5 + Math.random() * 0.5;
          nextTips.push(spawnTip(tip.x, tip.y, tip.generation + 1, tip.angle + spread * (Math.random() < 0.5 ? 1 : -1)));
        }
      }

      // Keep the colony alive — reseed from the base if it thins out.
      while (nextTips.length < MIN_TIPS) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.9;
        nextTips.push(spawnTip(baseX + (Math.random() - 0.5) * width * 0.3, baseY, 0, angle));
      }

      tipsRef.current = nextTips;
    }

    // ── Composite persistent growth onto the visible canvas ──
    ctx.drawImage(growth, 0, 0);

    // ── Glowing growth tips ───────────────────────────────────
    for (const tip of tipsRef.current) {
      const w = branchWidth(smooth.current.bass, tip.generation, dpr);
      const r = w * 0.9 + pulse * 2 * dpr;
      if (!lowPower) applyGlow(ctx, (10 + pulse * 10) * dpr, `hsl(${hueNow}, 90%, 65%)`);
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hueNow}, 90%, 75%, 0.9)`;
      ctx.fill();
    }
    clearGlow(ctx);
  }, []);

  useVisualizerLoop(canvasRef, draw, [draw]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
