import { useRef, useEffect, useMemo } from 'react';
import { useStore } from '../../store';
import { getVisDpr } from '../../utils/perfConfig';

// ── Color helpers (same as Nebula) ──────────────────────────

function boost(value: number, gain: number): number {
  return Math.min(1, Math.pow(value * gain, 0.55));
}

function hexToRgb(color: string): [number, number, number] {
  if (color.startsWith('rgb')) {
    const match = color.match(/(\d+)/g);
    if (match && match.length >= 3)
      return [parseInt(match[0]), parseInt(match[1]), parseInt(match[2])];
  }
  const hex = color.replace('#', '');
  return [
    parseInt(hex.substring(0, 2), 16),
    parseInt(hex.substring(2, 4), 16),
    parseInt(hex.substring(4, 6), 16),
  ];
}

function complementary(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  let h = 0;
  if (max !== min) {
    const d = max - min;
    const rn = r / 255, gn = g / 255, bn = b / 255;
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  h = (h + 0.42) % 1;
  const s = l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min) || 0;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

// ── Flow field noise (lightweight 2D, no dependency) ────────

function noise2d(x: number, y: number): number {
  return (
    Math.sin(x * 1.7 + y * 2.3) * 0.5 +
    Math.sin(x * 3.1 - y * 1.9) * 0.3 +
    Math.sin(x * 5.3 + y * 4.7) * 0.2
  );
}

// ── Pre-computed data types ─────────────────────────────────

interface Vortex {
  x: number; // 0-1 normalized
  y: number;
  radius: number;
  strength: number;
  direction: 1 | -1;
}

interface VanGoghStar {
  x: number;
  y: number;
  baseRadius: number;
  rings: number;
  brightness: number;
}

interface Stroke {
  x: number;
  y: number;
  colorIndex: number; // 0-3 palette index
}

interface Building {
  x: number;
  width: number;
  height: number;
  roofPeak: number; // 0 = flat, >0 = peaked
  isChurch: boolean;
  windows: { wx: number; wy: number }[];
}

// ── Pre-computed data generators ────────────────────────────

function createVortices(): Vortex[] {
  const vortices: Vortex[] = [
    { x: 0.5, y: 0.25, radius: 0.18, strength: 1.0, direction: 1 },
    { x: 0.2, y: 0.15, radius: 0.12, strength: 0.7, direction: -1 },
    { x: 0.75, y: 0.3, radius: 0.14, strength: 0.8, direction: 1 },
    { x: 0.35, y: 0.4, radius: 0.1, strength: 0.6, direction: -1 },
    { x: 0.85, y: 0.15, radius: 0.11, strength: 0.65, direction: 1 },
    { x: 0.6, y: 0.45, radius: 0.09, strength: 0.5, direction: -1 },
  ];
  return vortices;
}

function createVGStars(): VanGoghStar[] {
  return [
    { x: 0.15, y: 0.08, baseRadius: 12, rings: 4, brightness: 1.0 },
    { x: 0.38, y: 0.05, baseRadius: 10, rings: 3, brightness: 0.9 },
    { x: 0.55, y: 0.12, baseRadius: 14, rings: 5, brightness: 1.0 },
    { x: 0.72, y: 0.06, baseRadius: 11, rings: 4, brightness: 0.85 },
    { x: 0.9, y: 0.1, baseRadius: 9, rings: 3, brightness: 0.8 },
    { x: 0.25, y: 0.22, baseRadius: 7, rings: 3, brightness: 0.6 },
    { x: 0.45, y: 0.32, baseRadius: 6, rings: 2, brightness: 0.55 },
    { x: 0.65, y: 0.25, baseRadius: 8, rings: 3, brightness: 0.7 },
    { x: 0.82, y: 0.35, baseRadius: 6, rings: 2, brightness: 0.5 },
    { x: 0.08, y: 0.35, baseRadius: 7, rings: 2, brightness: 0.55 },
  ];
}

function createStrokes(): Stroke[] {
  const strokes: Stroke[] = [];
  const cols = 40;
  const rows = 25;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      strokes.push({
        x: (col + (Math.random() - 0.5) * 0.8) / cols,
        y: (row + (Math.random() - 0.5) * 0.8) / rows,
        colorIndex: Math.floor(Math.random() * 4),
      });
    }
  }
  return strokes;
}

function createCypressPoints(): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const segments = 50;
  for (let i = 0; i < segments; i++) {
    const t = i / (segments - 1); // 0 = bottom, 1 = top
    // Flame shape: wide at bottom, pointed at top
    const widthAtT = 0.025 * (1 - t * t) * (1 + Math.sin(t * 8) * 0.3);
    points.push({
      x: widthAtT,
      y: t,
    });
  }
  return points;
}

function createBuildings(): Building[] {
  const buildings: Building[] = [];
  const count = 10;
  let xCursor = 0.25;
  for (let i = 0; i < count; i++) {
    const w = 0.025 + Math.random() * 0.03;
    const h = 0.04 + Math.random() * 0.06;
    const isChurch = i === 5; // middle-ish building is the church
    const windows: { wx: number; wy: number }[] = [];
    const winCols = isChurch ? 1 : Math.max(1, Math.floor(w / 0.012));
    const winRows = Math.max(1, Math.floor(h / 0.025));
    for (let wr = 0; wr < winRows; wr++) {
      for (let wc = 0; wc < winCols; wc++) {
        windows.push({
          wx: (wc + 0.5) / winCols,
          wy: 0.3 + (wr * 0.5) / winRows,
        });
      }
    }
    buildings.push({
      x: xCursor,
      width: w,
      height: h + (isChurch ? 0.04 : 0),
      roofPeak: isChurch ? 0.06 : Math.random() < 0.4 ? 0.015 : 0,
      isChurch,
      windows,
    });
    xCursor += w + 0.005 + Math.random() * 0.015;
  }
  return buildings;
}

function createHills(): { points: number[] }[] {
  const hills: { points: number[] }[] = [];
  // 3 layers: back (higher, lighter), mid, front (lower, darker)
  const configs = [
    { baseY: 0.78, amplitude: 0.03, freq: 2.5 },
    { baseY: 0.82, amplitude: 0.025, freq: 3.2 },
    { baseY: 0.86, amplitude: 0.02, freq: 4.0 },
  ];
  for (const cfg of configs) {
    const pts: number[] = [];
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y =
        cfg.baseY +
        Math.sin(t * cfg.freq * Math.PI + 1.2) * cfg.amplitude +
        Math.sin(t * cfg.freq * 2.1 * Math.PI + 3.7) * cfg.amplitude * 0.5;
      pts.push(y);
    }
    hills.push({ points: pts });
  }
  return hills;
}

// ── Palette colors ──────────────────────────────────────────

const SKY_COLORS = [
  [10, 14, 42],    // deep navy #0a0e2a
  [26, 37, 85],    // dark blue #1a2555
  [20, 60, 100],   // teal-blue
  [60, 120, 180],  // lighter blue for stroke highlights
] as const;

const STAR_YELLOW: [number, number, number] = [255, 220, 80];
const MOON_YELLOW: [number, number, number] = [255, 235, 120];

// ── Component ───────────────────────────────────────────────

export default function StarryNight({ accentColor }: { accentColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioFeatures = useStore((s) => s.audioFeatures);
  const isBeat = useStore((s) => s.isBeat);
  const bpm = useStore((s) => s.bpm);

  const beatPulse = useRef(0);
  const smooth = useRef({ rms: 0, bass: 0, mid: 0, high: 0, energy: 0 });
  const timeAccum = useRef(0);

  const vortices = useMemo(() => createVortices(), []);
  const vgStars = useMemo(() => createVGStars(), []);
  const strokes = useMemo(() => createStrokes(), []);
  const cypressPoints = useMemo(() => createCypressPoints(), []);
  const buildings = useMemo(() => createBuildings(), []);
  const hills = useMemo(() => createHills(), []);

  // Canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.clientWidth * getVisDpr();
      canvas.height = canvas.clientHeight * getVisDpr();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (isBeat) beatPulse.current = 1;
  }, [isBeat]);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioFeatures) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const dpr = getVisDpr();

    // ── Smooth audio ──
    const sm = smooth.current;
    const { rms, bass, mid, high, energy } = audioFeatures;
    sm.rms += (rms - sm.rms) * (rms > sm.rms ? 0.4 : 0.15);
    sm.bass += (bass - sm.bass) * (bass > sm.bass ? 0.4 : 0.15);
    sm.mid += (mid - sm.mid) * (mid > sm.mid ? 0.4 : 0.15);
    sm.high += (high - sm.high) * (high > sm.high ? 0.4 : 0.15);
    sm.energy += (energy - sm.energy) * (energy > sm.energy ? 0.4 : 0.15);

    const bBass = boost(sm.bass, 3.5);
    const bMid = boost(sm.mid, 4.0);
    const bHigh = boost(sm.high, 5.0);
    const bEnergy = boost(sm.energy, 3.0);
    const bLowMid = boost(sm.bass * 0.4 + sm.mid * 0.6, 6.0);

    beatPulse.current *= 0.88;
    const pulse = beatPulse.current;

    const beatsPerSec = (bpm || 120) / 60;
    // Time accumulates faster with audio energy
    timeAccum.current += 0.016 * (1 + bLowMid * 2) * beatsPerSec * 0.5;
    const t = timeAccum.current;

    const [ar, ag, ab] = hexToRgb(accentColor);
    const [cr, cg, cb] = complementary(ar, ag, ab);

    // ── Layer 1: Sky gradient ──
    const skyShift = bLowMid * 20;
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.8);
    skyGrad.addColorStop(0, `rgb(${10 + skyShift * 0.3}, ${14 + skyShift * 0.5}, ${42 + skyShift})`);
    skyGrad.addColorStop(0.5, `rgb(${16 + skyShift * 0.2}, ${26 + skyShift * 0.4}, ${65 + skyShift * 0.8})`);
    skyGrad.addColorStop(1, `rgb(${26 + skyShift * 0.1}, ${37 + skyShift * 0.3}, ${85 + skyShift * 0.5})`);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // ── Layer 2: Brushstroke flow field ──
    const strokeWidth = (2 + bEnergy * 3) * dpr;
    const strokeLen = 15 * dpr;

    // Flow field function: noise + vortex tangential influence
    const getFlowAngle = (nx: number, ny: number): number => {
      let angle = noise2d(nx * 4 + t * 0.3, ny * 4) * Math.PI;

      // Add vortex influence
      for (const v of vortices) {
        const dx = nx - v.x;
        const dy = ny - v.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const influence = Math.exp(-(dist * dist) / (v.radius * v.radius * 2)) * v.strength;
        // Tangential angle: perpendicular to radial
        const tangent = Math.atan2(dx, -dy) * v.direction;
        angle += tangent * influence;
      }
      return angle;
    };

    ctx.lineCap = 'round';

    for (const stroke of strokes) {
      // Only draw strokes in the sky area (above hills)
      if (stroke.y > 0.76) continue;

      const sx = stroke.x * width;
      const sy = stroke.y * height;
      const angle = getFlowAngle(stroke.x, stroke.y);

      // End point following the flow
      const ex = sx + Math.cos(angle) * strokeLen;
      const ey = sy + Math.sin(angle) * strokeLen;

      // Control point for the curve (perpendicular offset for visible brush arc)
      const perpOffset = (noise2d(stroke.x * 7 + t * 0.1, stroke.y * 7) * 0.5) * strokeLen;
      const cpx = (sx + ex) / 2 + Math.cos(angle + Math.PI / 2) * perpOffset;
      const cpy = (sy + ey) / 2 + Math.sin(angle + Math.PI / 2) * perpOffset;

      // Color based on position and palette index
      const ci = stroke.colorIndex;
      let sr: number, sg: number, sb: number, sa: number;
      if (ci === 0) {
        // Deep navy
        sr = 15 + stroke.y * 30; sg = 20 + stroke.y * 40; sb = 60 + stroke.y * 60; sa = 0.4;
      } else if (ci === 1) {
        // Teal-blue (slightly brighter near vortices)
        sr = 20; sg = 60 + stroke.y * 40; sb = 100 + stroke.y * 50; sa = 0.35;
      } else if (ci === 2) {
        // Lighter blue highlight
        sr = 60; sg = 120; sb = 180; sa = 0.25;
      } else {
        // Accent tint (subtle)
        sr = ar * 0.3 + 20; sg = ag * 0.3 + 40; sb = ab * 0.3 + 80; sa = 0.2;
      }

      // Brighten strokes near vortex centers
      let vortexBoost = 0;
      for (const v of vortices) {
        const dx = stroke.x - v.x;
        const dy = stroke.y - v.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        vortexBoost += Math.exp(-(dist * dist) / (v.radius * v.radius)) * 0.3;
      }
      sa += vortexBoost;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(cpx, cpy, ex, ey);
      ctx.strokeStyle = `rgba(${Math.round(sr)}, ${Math.round(sg)}, ${Math.round(sb)}, ${Math.min(0.9, sa + bEnergy * 0.15)})`;
      ctx.lineWidth = strokeWidth * (0.7 + vortexBoost * 2);
      ctx.stroke();
    }

    // ── Layer 3: Swirl vortex emphasis (concentric arc strokes) ──
    for (const v of vortices) {
      const vcx = v.x * width;
      const vcy = v.y * height;
      const maxVR = v.radius * Math.max(width, height);
      const rotSpeed = (1 + bLowMid * 2) * v.direction;
      const rings = 6 + Math.floor(v.strength * 4);

      for (let ring = 1; ring <= rings; ring++) {
        const ringR = (ring / rings) * maxVR;
        const arcLen = Math.PI * (0.5 + v.strength * 0.8);
        const startAngle = t * rotSpeed * 0.5 + ring * 0.7;
        const alpha = (0.15 + bLowMid * 0.2) * (1 - ring / (rings + 2));

        ctx.beginPath();
        ctx.arc(vcx, vcy, ringR, startAngle, startAngle + arcLen);
        const ringColor = ring % 2 === 0
          ? `rgba(60, 120, 180, ${alpha})`
          : `rgba(20, 60, 110, ${alpha})`;
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = (3 + bEnergy * 2) * dpr * (1 - ring / (rings * 1.5));
        ctx.stroke();
      }
    }

    // ── Layer 4: Van Gogh stars (concentric halo rings) ──
    for (const star of vgStars) {
      const sx = star.x * width;
      const sy = star.y * height;
      const baseR = star.baseRadius * dpr;
      const haloPulse = 1 + pulse * 0.5;

      // Blend accent into star glow
      const glowR = Math.round(STAR_YELLOW[0] * 0.75 + ar * 0.25);
      const glowG = Math.round(STAR_YELLOW[1] * 0.75 + ag * 0.25);
      const glowB = Math.round(STAR_YELLOW[2] * 0.75 + ab * 0.25);

      // Outer glow
      const outerGlowR = baseR * (3 + pulse * 2) * haloPulse;
      const glowGrad = ctx.createRadialGradient(sx, sy, baseR * 0.5, sx, sy, outerGlowR);
      glowGrad.addColorStop(0, `rgba(${glowR}, ${glowG}, ${glowB}, ${0.4 * star.brightness})`);
      glowGrad.addColorStop(0.5, `rgba(${glowR}, ${glowG}, ${glowB}, ${0.15 * star.brightness})`);
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, outerGlowR, 0, Math.PI * 2);
      ctx.fill();

      // Concentric halo rings (thick arc segments, not full circles)
      for (let ri = 0; ri < star.rings; ri++) {
        const ringR = baseR * (1.2 + ri * 0.8) * haloPulse;
        const arcStart = t * 0.3 + ri * 1.2 + star.x * 5;
        const arcSpan = Math.PI * (0.4 + Math.random() * 0.1);
        const segments = 3;
        for (let seg = 0; seg < segments; seg++) {
          const segStart = arcStart + (seg * Math.PI * 2) / segments;
          ctx.beginPath();
          ctx.arc(sx, sy, ringR, segStart, segStart + arcSpan);
          const ringAlpha = (0.3 - ri * 0.05) * star.brightness;
          ctx.strokeStyle = `rgba(${glowR}, ${glowG}, ${glowB}, ${Math.max(0.05, ringAlpha)})`;
          ctx.lineWidth = (3 - ri * 0.4) * dpr;
          ctx.stroke();
        }
      }

      // Bright core
      ctx.beginPath();
      ctx.arc(sx, sy, baseR * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 230, ${0.8 * star.brightness})`;
      ctx.fill();
    }

    // ── Layer 5: Crescent moon ──
    const moonX = width * 0.82;
    const moonY = height * 0.1;
    const moonR = 22 * dpr;
    const moonGlowAlpha = 0.15 + bMid * 0.3;

    // Moon glow halo
    const moonGlow = ctx.createRadialGradient(moonX, moonY, moonR, moonX, moonY, moonR * 4);
    const mgR = Math.round(MOON_YELLOW[0] * 0.75 + ar * 0.25);
    const mgG = Math.round(MOON_YELLOW[1] * 0.75 + ag * 0.25);
    const mgB = Math.round(MOON_YELLOW[2] * 0.75 + ab * 0.25);
    moonGlow.addColorStop(0, `rgba(${mgR}, ${mgG}, ${mgB}, ${moonGlowAlpha})`);
    moonGlow.addColorStop(0.4, `rgba(${mgR}, ${mgG}, ${mgB}, ${moonGlowAlpha * 0.4})`);
    moonGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 4, 0, Math.PI * 2);
    ctx.fill();

    // Bright moon circle
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${MOON_YELLOW[0]}, ${MOON_YELLOW[1]}, ${MOON_YELLOW[2]}, 0.9)`;
    ctx.fill();

    // Dark overlay for crescent shape
    ctx.beginPath();
    ctx.arc(moonX + moonR * 0.45, moonY - moonR * 0.15, moonR * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${10 + Math.round(skyShift * 0.3)}, ${14 + Math.round(skyShift * 0.5)}, ${42 + Math.round(skyShift)})`;
    ctx.fill();

    // ── Layer 6: Rolling hills ──
    const hillColors = [
      [8, 15, 10],   // back — slightly lighter dark green
      [5, 10, 6],    // mid
      [2, 6, 3],     // front — near black
    ];

    for (let hi = 0; hi < hills.length; hi++) {
      const hill = hills[hi];
      const [hr, hg, hb] = hillColors[hi];
      ctx.beginPath();
      ctx.moveTo(0, height);

      for (let i = 0; i < hill.points.length; i++) {
        const x = (i / (hill.points.length - 1)) * width;
        const y = hill.points[i] * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = `rgb(${hr}, ${hg}, ${hb})`;
      ctx.fill();
    }

    // ── Layer 7: Village buildings ──
    for (const bldg of buildings) {
      const bx = bldg.x * width;
      const bw = bldg.width * width;
      const bh = bldg.height * height;
      // Place buildings on the hill contour
      const hillIdx = Math.min(
        hills[1].points.length - 1,
        Math.round(bldg.x * (hills[1].points.length - 1))
      );
      const groundY = hills[1].points[hillIdx] * height;
      const by = groundY - bh;

      ctx.beginPath();
      if (bldg.roofPeak > 0) {
        // Peaked roof
        const peakH = bldg.roofPeak * height;
        ctx.moveTo(bx, groundY);
        ctx.lineTo(bx, by);
        ctx.lineTo(bx + bw / 2, by - peakH);
        ctx.lineTo(bx + bw, by);
        ctx.lineTo(bx + bw, groundY);
      } else {
        ctx.rect(bx, by, bw, bh);
      }
      ctx.closePath();
      ctx.fillStyle = bldg.isChurch ? 'rgb(3, 5, 4)' : 'rgb(5, 8, 5)';
      ctx.fill();

      // Church steeple
      if (bldg.isChurch) {
        const steepleW = bw * 0.25;
        const steepleH = bh * 0.6;
        const steepleX = bx + bw / 2 - steepleW / 2;
        const steepleY = by - bldg.roofPeak * height;
        ctx.beginPath();
        ctx.moveTo(steepleX, steepleY);
        ctx.lineTo(steepleX + steepleW / 2, steepleY - steepleH);
        ctx.lineTo(steepleX + steepleW, steepleY);
        ctx.closePath();
        ctx.fillStyle = 'rgb(3, 5, 4)';
        ctx.fill();
      }

      // Windows — warm yellow, flickering with highs
      for (const win of bldg.windows) {
        const winX = bx + win.wx * bw;
        const winY = by + win.wy * bh;
        const winW = 3 * dpr;
        const winH = 4 * dpr;
        const flicker = 0.3 + bHigh * 0.6 + Math.sin(t * 3 + win.wx * 10 + win.wy * 7) * 0.1;

        // Window glow
        const winGlow = ctx.createRadialGradient(
          winX, winY, 0,
          winX, winY, winW * 4
        );
        winGlow.addColorStop(0, `rgba(255, 200, 50, ${flicker * 0.3})`);
        winGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = winGlow;
        ctx.beginPath();
        ctx.arc(winX, winY, winW * 4, 0, Math.PI * 2);
        ctx.fill();

        // Window rect
        ctx.fillStyle = `rgba(255, 210, 80, ${flicker})`;
        ctx.fillRect(winX - winW / 2, winY - winH / 2, winW, winH);
      }
    }

    // ── Layer 8: Cypress tree ──
    const cypressBaseX = width * 0.08;
    const cypressBaseY = height * 0.85;
    const cypressHeight = height * 0.55;
    const cypressScale = width * 1.0;
    const sway = 0.005 + bBass * 0.02; // bass-driven sway

    ctx.save();

    // Draw cypress as upward-curving brushstrokes
    for (let i = 0; i < cypressPoints.length - 1; i++) {
      const pt = cypressPoints[i];
      const ptNext = cypressPoints[i + 1];
      const heightFrac = pt.y; // 0 = bottom, 1 = top

      // Sway increases toward top (anchored at bottom)
      const swayOffset = Math.sin(t * 1.5) * sway * heightFrac * heightFrac * cypressScale;

      const x1 = cypressBaseX + swayOffset - pt.x * cypressScale;
      const y1 = cypressBaseY - pt.y * cypressHeight;
      const x2 = cypressBaseX + swayOffset + pt.x * cypressScale;
      const y2 = y1;

      const x1n = cypressBaseX + Math.sin(t * 1.5) * sway * ptNext.y * ptNext.y * cypressScale - ptNext.x * cypressScale;
      const y1n = cypressBaseY - ptNext.y * cypressHeight;
      const x2n = cypressBaseX + Math.sin(t * 1.5) * sway * ptNext.y * ptNext.y * cypressScale + ptNext.x * cypressScale;
      const y2n = y1n;

      // Left brushstroke
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      const cpxL = x1 - 3 * dpr + Math.sin(heightFrac * 6 + t) * 2 * dpr;
      ctx.quadraticCurveTo(cpxL, (y1 + y1n) / 2, x1n, y1n);
      ctx.strokeStyle = `rgba(5, ${15 + Math.round(heightFrac * 15)}, 8, ${0.7 + heightFrac * 0.2})`;
      ctx.lineWidth = (3 + bEnergy) * dpr;
      ctx.stroke();

      // Right brushstroke
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      const cpxR = x2 + 3 * dpr + Math.sin(heightFrac * 6 + t + 1) * 2 * dpr;
      ctx.quadraticCurveTo(cpxR, (y2 + y2n) / 2, x2n, y2n);
      ctx.stroke();

      // Center fill stroke
      if (i % 2 === 0) {
        ctx.beginPath();
        ctx.moveTo((x1 + x2) / 2, y1);
        ctx.quadraticCurveTo(
          (x1 + x2) / 2 + Math.sin(heightFrac * 8 + t * 0.7) * 4 * dpr,
          (y1 + y1n) / 2,
          (x1n + x2n) / 2,
          y1n
        );
        ctx.strokeStyle = `rgba(3, ${10 + Math.round(heightFrac * 10)}, 5, 0.8)`;
        ctx.lineWidth = (4 + bEnergy * 1.5) * dpr;
        ctx.stroke();
      }
    }

    ctx.restore();
  }, [audioFeatures, accentColor, isBeat, bpm, vortices, vgStars, strokes, cypressPoints, buildings, hills]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
