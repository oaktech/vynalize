import { useRef, useEffect } from 'react';
import { useStore } from '../../store';

/** Compress dynamic range — same approach as SpectrumBars boost().
 *  Quiet mic signals get amplified, loud signals are tamed. */
function boost(value: number, gain: number): number {
  return Math.min(1, Math.pow(value * gain, 0.55));
}

// ── Neon palette ──────────────────────────────────────────────
const NEON = [
  '#ff1493', // hot pink
  '#00ffff', // cyan
  '#39ff14', // neon green
  '#ff6600', // neon orange
  '#bf00ff', // electric purple
  '#ffff00', // yellow
  '#ff0055', // magenta-red
  '#00e5ff', // electric blue
  '#ff00ff', // magenta
  '#ffaa00', // amber
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickTwo(): [string, string] {
  const a = pick(NEON);
  let b = pick(NEON);
  while (b === a) b = pick(NEON);
  return [a, b];
}

// ── Pattern types ─────────────────────────────────────────────
type PatternKind = 'starburst' | 'rings' | 'zigzag' | 'diamond' | 'grid' | 'bolt';
const PATTERN_KINDS: PatternKind[] = ['starburst', 'rings', 'zigzag', 'diamond', 'grid', 'bolt'];

interface Scene {
  kind: PatternKind;
  color: string;
  color2: string;
  rotation: number;
  rotationSpeed: number;
  spawnTime: number;
  params: number[];
  // Pre-computed bolt jitter so it doesn't flicker
  boltPaths: number[][];
}

const CROSSFADE = 1200; // ms
const BEAT_COOLDOWN = 3000; // min ms between transitions

function makeBoltPaths(params: number[]): number[][] {
  const bolts = 2 + Math.floor(params[0] * 3);
  const segments = 5 + Math.floor(params[1] * 5);
  const paths: number[][] = [];
  for (let b = 0; b < bolts; b++) {
    const angle = (b / bolts) * Math.PI * 2;
    // Store [cosAngle, sinAngle, ...jitterValues]
    const path: number[] = [angle];
    for (let s = 1; s <= segments; s++) {
      path.push((Math.random() - 0.5) * 0.35);
    }
    paths.push(path);
  }
  return paths;
}

function createScene(now: number): Scene {
  const kind = pick(PATTERN_KINDS);
  const params = [Math.random(), Math.random(), Math.random(), Math.random()];
  return {
    kind,
    ...{ color: pickTwo()[0], color2: pickTwo()[1] },
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.006,
    spawnTime: now,
    params,
    boltPaths: kind === 'bolt' ? makeBoltPaths(params) : [],
  };
}

// ── Drawing functions (all centered, fill the canvas) ─────────

function drawStarburst(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  color: string, color2: string, rotation: number, params: number[],
) {
  const rays = 10 + Math.floor(params[0] * 14);
  const innerR = r * (0.08 + params[1] * 0.12);
  const step = (Math.PI * 2) / rays;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  for (let i = 0; i < rays; i++) {
    const angle = i * step;
    const col = i % 2 === 0 ? color : color2;
    ctx.beginPath();
    ctx.moveTo(
      Math.cos(angle - step * 0.35) * innerR,
      Math.sin(angle - step * 0.35) * innerR,
    );
    ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    ctx.lineTo(
      Math.cos(angle + step * 0.35) * innerR,
      Math.sin(angle + step * 0.35) * innerR,
    );
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 8 * devicePixelRatio;
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // hot white center
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, innerR * 2);
  glow.addColorStop(0, 'rgba(255,255,255,0.95)');
  glow.addColorStop(0.5, 'rgba(255,255,255,0.3)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, innerR * 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawRings(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  color: string, color2: string, _rotation: number, params: number[],
) {
  const count = 5 + Math.floor(params[0] * 6);
  const lineWidth = 3 + params[1] * 4;

  for (let i = 0; i < count; i++) {
    const t = (i + 1) / count;
    const ringR = r * t;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    const col = i % 2 === 0 ? color : color2;
    ctx.strokeStyle = col;
    ctx.lineWidth = lineWidth * devicePixelRatio;
    ctx.shadowColor = col;
    ctx.shadowBlur = 14 * devicePixelRatio;
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // center glow
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.1);
  glow.addColorStop(0, 'rgba(255,255,255,0.9)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawZigzag(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  color: string, color2: string, rotation: number, params: number[],
) {
  const teeth = 6 + Math.floor(params[0] * 8);
  const rows = 5 + Math.floor(params[1] * 5);
  const amplitude = r * 0.22;
  const rowHeight = (r * 2) / rows;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  for (let row = 0; row < rows; row++) {
    const yBase = -r + row * rowHeight;
    ctx.beginPath();
    ctx.moveTo(-r, yBase);
    for (let t = 0; t <= teeth; t++) {
      const xPos = -r + (t / teeth) * r * 2;
      const yPos = yBase + (t % 2 === 0 ? 0 : amplitude);
      ctx.lineTo(xPos, yPos);
    }
    const col = row % 2 === 0 ? color : color2;
    ctx.strokeStyle = col;
    ctx.lineWidth = (3 + params[2] * 3) * devicePixelRatio;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = col;
    ctx.shadowBlur = 10 * devicePixelRatio;
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  color: string, color2: string, rotation: number, params: number[],
) {
  const layers = 4 + Math.floor(params[0] * 4);
  const stretch = 1.2 + params[1] * 0.6;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  for (let i = layers; i >= 1; i--) {
    const t = i / layers;
    const s = r * t;

    ctx.beginPath();
    ctx.moveTo(0, -s * stretch);
    ctx.lineTo(s, 0);
    ctx.lineTo(0, s * stretch);
    ctx.lineTo(-s, 0);
    ctx.closePath();

    const col = i % 2 === 0 ? color : color2;
    ctx.strokeStyle = col;
    ctx.lineWidth = (2.5 + params[2] * 2.5) * devicePixelRatio;
    ctx.shadowColor = col;
    ctx.shadowBlur = 12 * devicePixelRatio;
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  color: string, color2: string, rotation: number, params: number[],
) {
  const lines = 7 + Math.floor(params[0] * 7);
  const spacing = (r * 2) / lines;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.lineWidth = 2 * devicePixelRatio;

  for (let i = 0; i <= lines; i++) {
    const offset = -r + i * spacing;
    const col = i % 2 === 0 ? color : color2;
    ctx.strokeStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 8 * devicePixelRatio;
    // horizontal
    ctx.beginPath();
    ctx.moveTo(-r, offset);
    ctx.lineTo(r, offset);
    ctx.stroke();
    // vertical
    ctx.beginPath();
    ctx.moveTo(offset, -r);
    ctx.lineTo(offset, r);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawBolt(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  color: string, color2: string, rotation: number, params: number[],
  boltPaths: number[][],
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  for (let b = 0; b < boltPaths.length; b++) {
    const path = boltPaths[b];
    const angle = path[0];
    const segments = path.length - 1;

    ctx.beginPath();
    ctx.moveTo(0, 0);

    for (let s = 1; s <= segments; s++) {
      const dist = (s / segments) * r;
      const jitter = path[s] * r;
      const px = Math.cos(angle) * dist + Math.sin(angle) * jitter;
      const py = Math.sin(angle) * dist - Math.cos(angle) * jitter;
      ctx.lineTo(px, py);
    }

    const col = b % 2 === 0 ? color : color2;
    ctx.strokeStyle = col;
    ctx.lineWidth = (3 + params[2] * 3) * devicePixelRatio;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = col;
    ctx.shadowBlur = 20 * devicePixelRatio;
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  cx: number, cy: number, r: number,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;

  switch (scene.kind) {
    case 'starburst':
      drawStarburst(ctx, cx, cy, r, scene.color, scene.color2, scene.rotation, scene.params);
      break;
    case 'rings':
      drawRings(ctx, cx, cy, r, scene.color, scene.color2, scene.rotation, scene.params);
      break;
    case 'zigzag':
      drawZigzag(ctx, cx, cy, r, scene.color, scene.color2, scene.rotation, scene.params);
      break;
    case 'diamond':
      drawDiamond(ctx, cx, cy, r, scene.color, scene.color2, scene.rotation, scene.params);
      break;
    case 'grid':
      drawGrid(ctx, cx, cy, r, scene.color, scene.color2, scene.rotation, scene.params);
      break;
    case 'bolt':
      drawBolt(ctx, cx, cy, r, scene.color, scene.color2, scene.rotation, scene.params, scene.boltPaths);
      break;
  }

  ctx.restore();
}

// ── Component ─────────────────────────────────────────────────

export default function Radical({ accentColor: _accentColor }: { accentColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioFeatures = useStore((s) => s.audioFeatures);
  const isBeat = useStore((s) => s.isBeat);

  // Two scene slots: current (always visible) and outgoing (fading out)
  const currentRef = useRef<Scene | null>(null);
  const outgoingRef = useRef<Scene | null>(null);
  const lastTransitionRef = useRef(0);
  const beatPulseRef = useRef(0);
  const smooth = useRef({ bass: 0, mid: 0, energy: 0, rms: 0 });

  // Canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Seed first scene immediately
  useEffect(() => {
    if (!currentRef.current) {
      const now = performance.now();
      currentRef.current = createScene(now - CROSSFADE); // already fully faded in
      lastTransitionRef.current = now - BEAT_COOLDOWN;
    }
  }, []);

  // Beat: transition to new scene (with cooldown)
  useEffect(() => {
    if (!isBeat) return;
    beatPulseRef.current = 1;

    const now = performance.now();
    if (now - lastTransitionRef.current < BEAT_COOLDOWN) return;

    lastTransitionRef.current = now;
    outgoingRef.current = currentRef.current;
    currentRef.current = createScene(now);
  }, [isBeat]);

  // Render every frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const now = performance.now();
    const cx = width / 2;
    const cy = height / 2;
    const baseR = Math.min(width, height) * 0.38;

    // Smooth audio (fast attack, slow decay — matches SpectrumBars)
    const s = smooth.current;
    const rawBass = audioFeatures?.bass ?? 0;
    const rawMid = audioFeatures?.mid ?? 0;
    const rawEnergy = audioFeatures?.energy ?? 0;
    const rawRms = audioFeatures?.rms ?? 0;
    s.bass += (rawBass - s.bass) * (rawBass > s.bass ? 0.4 : 0.15);
    s.mid += (rawMid - s.mid) * (rawMid > s.mid ? 0.4 : 0.15);
    s.energy += (rawEnergy - s.energy) * (rawEnergy > s.energy ? 0.4 : 0.15);
    s.rms += (rawRms - s.rms) * (rawRms > s.rms ? 0.4 : 0.15);

    // Compressed audio — target lower mids which register strongest on mic
    const bBass = boost(s.bass, 4.0);
    const bMid = boost(s.mid, 6.0);
    const bEnergy = boost(s.energy, 3.0);
    const bRms = boost(s.rms, 3.0);
    const bLowMid = boost(s.bass * 0.4 + s.mid * 0.6, 6.0); // blend favoring mids

    // Decay beat pulse
    beatPulseRef.current *= 0.88;
    const scaleBump = 1 + beatPulseRef.current * 0.4 + bLowMid * 0.5;

    // Draw outgoing scene (fading out)
    if (outgoingRef.current) {
      const age = now - (currentRef.current?.spawnTime ?? now);
      const fadeOut = 1 - Math.min(1, age / CROSSFADE);

      if (fadeOut > 0) {
        outgoingRef.current.rotation += outgoingRef.current.rotationSpeed * (1 + bLowMid * 1.5);
        drawScene(ctx, outgoingRef.current, cx, cy, baseR * scaleBump, fadeOut);
      } else {
        outgoingRef.current = null;
      }
    }

    // Draw current scene (fading in then full)
    if (currentRef.current) {
      const age = now - currentRef.current.spawnTime;
      const fadeIn = Math.min(1, age / CROSSFADE);

      currentRef.current.rotation += currentRef.current.rotationSpeed * (1 + bLowMid * 1.5);
      drawScene(ctx, currentRef.current, cx, cy, baseR * scaleBump, fadeIn);
    }
  }, [audioFeatures]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
