import { useRef, useEffect, useMemo } from 'react';
import { useStore } from '../../store';

// ── Config ───────────────────────────────────────────────────

const STAR_COUNT = 120;
const BUILDING_COUNT = 35;

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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ── Stars ────────────────────────────────────────────────────

interface Star {
  x: number;
  y: number;
  size: number;
  twinkleSpeed: number;
  phase: number;
}

function createStars(count: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random() * 0.38,
    size: 0.4 + Math.random() * 1.8,
    twinkleSpeed: 0.5 + Math.random() * 2,
    phase: Math.random() * Math.PI * 2,
  }));
}

// ── Building definitions (Pittsburgh skyline landmarks) ──────

interface Building {
  x: number;      // center x (0-1)
  w: number;      // width (0-1)
  h: number;      // height (0-1)
  type: 'box' | 'tower' | 'cathedral' | 'ppg' | 'ussteel' | 'spire';
  windowRows: number;
  windowCols: number;
}

function createSkyline(): Building[] {
  // Pittsburgh skyline from left to right — iconic buildings
  return [
    // Far left small buildings
    { x: 0.02, w: 0.035, h: 0.08, type: 'box', windowRows: 3, windowCols: 2 },
    { x: 0.06, w: 0.03, h: 0.12, type: 'box', windowRows: 5, windowCols: 2 },
    { x: 0.09, w: 0.04, h: 0.10, type: 'box', windowRows: 4, windowCols: 2 },
    { x: 0.13, w: 0.025, h: 0.15, type: 'tower', windowRows: 7, windowCols: 2 },
    { x: 0.16, w: 0.04, h: 0.09, type: 'box', windowRows: 3, windowCols: 3 },

    // Mount Washington / Station Square area
    { x: 0.20, w: 0.035, h: 0.14, type: 'box', windowRows: 6, windowCols: 2 },
    { x: 0.24, w: 0.03, h: 0.11, type: 'box', windowRows: 5, windowCols: 2 },

    // PPG Place (Gothic revival glass castle) - iconic!
    { x: 0.30, w: 0.055, h: 0.30, type: 'ppg', windowRows: 14, windowCols: 4 },
    { x: 0.265, w: 0.03, h: 0.20, type: 'ppg', windowRows: 9, windowCols: 2 },
    { x: 0.34, w: 0.025, h: 0.18, type: 'ppg', windowRows: 8, windowCols: 2 },

    // One Oxford Centre
    { x: 0.38, w: 0.04, h: 0.22, type: 'tower', windowRows: 10, windowCols: 3 },

    // US Steel Tower (tallest in Pittsburgh)
    { x: 0.44, w: 0.055, h: 0.38, type: 'ussteel', windowRows: 18, windowCols: 4 },
    { x: 0.48, w: 0.03, h: 0.16, type: 'box', windowRows: 7, windowCols: 2 },

    // BNY Mellon Center
    { x: 0.52, w: 0.045, h: 0.28, type: 'tower', windowRows: 13, windowCols: 3 },

    // One PPG Place area
    { x: 0.57, w: 0.035, h: 0.20, type: 'box', windowRows: 9, windowCols: 3 },
    { x: 0.60, w: 0.04, h: 0.24, type: 'tower', windowRows: 11, windowCols: 3 },

    // Gateway Center cluster
    { x: 0.65, w: 0.035, h: 0.17, type: 'box', windowRows: 8, windowCols: 2 },
    { x: 0.69, w: 0.04, h: 0.14, type: 'box', windowRows: 6, windowCols: 3 },

    // Cathedral of Learning (iconic gothic tower)
    { x: 0.75, w: 0.035, h: 0.34, type: 'cathedral', windowRows: 16, windowCols: 3 },

    // Right side smaller buildings
    { x: 0.80, w: 0.04, h: 0.12, type: 'box', windowRows: 5, windowCols: 3 },
    { x: 0.84, w: 0.03, h: 0.16, type: 'tower', windowRows: 7, windowCols: 2 },
    { x: 0.88, w: 0.04, h: 0.10, type: 'box', windowRows: 4, windowCols: 3 },
    { x: 0.92, w: 0.035, h: 0.13, type: 'box', windowRows: 5, windowCols: 2 },
    { x: 0.96, w: 0.03, h: 0.08, type: 'box', windowRows: 3, windowCols: 2 },
  ];
}

// ── Buildings for rendering ──────────────────────────────────

interface RenderBuilding {
  x: number;
  width: number;
  height: number;
  hasPeak: boolean;
  peakHeight: number;
  windows: { row: number; col: number }[];
}

function createBuildings(count: number): RenderBuilding[] {
  const skyline = createSkyline();
  const extra = count - skyline.length;
  const all: RenderBuilding[] = skyline.map((b) => {
    const windowCols = b.windowCols;
    const windowRows = b.windowRows;
    const windows: { row: number; col: number }[] = [];
    for (let row = 0; row < windowRows; row++) {
      for (let col = 0; col < windowCols; col++) {
        if (Math.random() > 0.3) windows.push({ row, col });
      }
    }
    return {
      x: b.x,
      width: b.w,
      height: b.h,
      hasPeak: b.type === 'cathedral' || b.type === 'spire' || b.type === 'ppg',
      peakHeight: b.type === 'cathedral' ? 0.06 : b.type === 'ppg' ? 0.03 : 0,
      windows,
    };
  });
  // Fill extra random buildings if count exceeds landmark count
  for (let i = 0; i < extra; i++) {
    const x = Math.random();
    const width = 0.02 + Math.random() * 0.03;
    const height = 0.06 + Math.random() * 0.14;
    const windowCols = Math.max(1, Math.floor(width * 80));
    const windowRows = Math.max(1, Math.floor(height * 20));
    const windows: { row: number; col: number }[] = [];
    for (let row = 0; row < windowRows; row++) {
      for (let col = 0; col < windowCols; col++) {
        if (Math.random() > 0.3) windows.push({ row, col });
      }
    }
    all.push({ x, width, height, hasPeak: false, peakHeight: 0, windows });
  }
  return all;
}

// ── Golden particles (rise from city on beats) ──────────────

interface GoldParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  brightness: number;
}

// ── Window state for flickering lights ──────────────────────

interface WindowState {
  lit: boolean;
  brightness: number;
  flickerTimer: number;
}

// ── Component ────────────────────────────────────────────────

export default function PittsburghSkyline({ accentColor }: { accentColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioFeatures = useStore((s) => s.audioFeatures);
  const isBeat = useStore((s) => s.isBeat);

  const beatPulse = useRef(0);
  const smooth = useRef({ rms: 0, bass: 0, mid: 0, high: 0, energy: 0 });

  const stars = useMemo(() => createStars(STAR_COUNT), []);
  const buildings = useMemo(() => createBuildings(BUILDING_COUNT), []);

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

  // Beat trigger
  useEffect(() => {
    if (isBeat) beatPulse.current = 1;
  }, [isBeat]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioFeatures) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const dpr = devicePixelRatio;
    const [ar, ag, ab] = hexToRgb(accentColor);

    const { rms, bass, mid, high, energy } = audioFeatures;
    const freq = audioFeatures.frequencyData;

    // Smooth audio
    const s = smooth.current;
    s.rms += (rms - s.rms) * 0.1;
    s.bass += (bass - s.bass) * 0.1;
    s.mid += (mid - s.mid) * 0.1;
    s.high += (high - s.high) * 0.1;
    s.energy += (energy - s.energy) * 0.1;

    // Beat pulse
    beatPulse.current *= 0.88;
    const pulse = beatPulse.current;

    const skyline = height * 0.65;

    // ── Night sky gradient ──
    const skyGrad = ctx.createLinearGradient(0, 0, 0, skyline);
    skyGrad.addColorStop(0, '#050510');
    skyGrad.addColorStop(0.5, '#0a0a20');
    skyGrad.addColorStop(1, `rgba(${Math.floor(ar * 0.15)}, ${Math.floor(ag * 0.1)}, ${Math.floor(ab * 0.2)}, 0.3)`);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, skyline);

    // ── River / ground ──
    const riverGrad = ctx.createLinearGradient(0, skyline, 0, height);
    riverGrad.addColorStop(0, '#020208');
    riverGrad.addColorStop(0.3, `rgba(${Math.floor(ar * 0.05)}, ${Math.floor(ag * 0.05)}, ${Math.floor(ab * 0.1)}, 0.8)`);
    riverGrad.addColorStop(1, '#000000');
    ctx.fillStyle = riverGrad;
    ctx.fillRect(0, skyline, width, height - skyline);

    // ── Stars ──
    for (const star of stars) {
      const twinkle = 0.4 + 0.6 * Math.sin(performance.now() / 1000 * star.twinkleSpeed + star.x * 100);
      const bright = twinkle + s.high * 0.5;
      const sz = star.size * dpr * (0.8 + pulse * 0.2);
      ctx.beginPath();
      ctx.arc(star.x * width, star.y * height, sz, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, bright * 0.6)})`;
      ctx.fill();
    }

    // ── Buildings ──
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const bx = b.x * width;
      const bw = b.width * width;

      // Audio-reactive height: each building responds to a frequency band
      const freqIdx = Math.floor((i / buildings.length) * freq.length * 0.5);
      const freqVal = (freq[freqIdx] || 0) / 255;
      const bh = b.height * height * (0.8 + freqVal * 0.3 + pulse * 0.1);
      const by = skyline - bh;

      // Building body
      ctx.fillStyle = `rgba(${10 + Math.floor(ar * 0.08)}, ${8 + Math.floor(ag * 0.05)}, ${15 + Math.floor(ab * 0.1)}, 0.95)`;
      ctx.fillRect(bx, by, bw, bh);

      // Peak/spire
      if (b.hasPeak) {
        const peakH = b.peakHeight * height;
        ctx.beginPath();
        ctx.moveTo(bx + bw * 0.4, by);
        ctx.lineTo(bx + bw * 0.5, by - peakH);
        ctx.lineTo(bx + bw * 0.6, by);
        ctx.closePath();
        ctx.fill();
      }

      // Building edge highlight
      ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${0.08 + pulse * 0.15})`;
      ctx.lineWidth = 0.5 * dpr;
      ctx.strokeRect(bx, by, bw, bh);

      // ── Windows ──
      const windowCols = Math.max(1, Math.floor(b.width * 80));
      const windowRows = Math.max(1, Math.floor(b.height * 20));
      const cellW = bw / windowCols;
      const cellH = bh / windowRows;

      for (const win of b.windows) {
        const wx = bx + win.col * cellW + cellW * 0.2;
        const wy = by + win.row * cellH + cellH * 0.2;
        const ww = cellW * 0.6;
        const wh = cellH * 0.6;

        // Windows flicker with audio
        const flicker = Math.sin(performance.now() / 2000 + win.row * 3 + win.col * 7);
        const lit = flicker > -0.3 + s.energy * 0.5;

        if (lit) {
          const warmth = 0.5 + Math.random() * 0.3;
          ctx.fillStyle = `rgba(${Math.floor(200 * warmth + ar * 0.3)}, ${Math.floor(180 * warmth + ag * 0.2)}, ${Math.floor(100 * warmth + ab * 0.1)}, ${0.4 + s.rms * 0.4 + pulse * 0.2})`;
          ctx.fillRect(wx, wy, ww, wh);
        }
      }
    }

    // ── City glow on horizon ──
    const glowGrad = ctx.createRadialGradient(
      width * 0.5, skyline, 0,
      width * 0.5, skyline, width * (0.3 + s.energy * 0.15 + pulse * 0.1),
    );
    glowGrad.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, ${0.12 + pulse * 0.15})`);
    glowGrad.addColorStop(0.5, `rgba(${ar}, ${ag}, ${ab}, 0.03)`);
    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, skyline * 0.5, width, height * 0.5);

    // ── River reflections ──
    ctx.save();
    ctx.globalAlpha = 0.15 + pulse * 0.1;
    ctx.scale(1, -0.3);
    ctx.translate(0, -skyline * 4.2);

    for (const b of buildings) {
      const bx = b.x * width;
      const bw = b.width * width;
      const bh = b.height * height * 0.8;
      const by = skyline - bh;

      ctx.fillStyle = `rgba(${ar}, ${ag}, ${ab}, 0.15)`;
      ctx.fillRect(bx, by, bw, bh);
    }

    ctx.restore();

    // ── Ripple lines on river ──
    const now = performance.now() / 1000;
    ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${0.06 + s.bass * 0.08})`;
    ctx.lineWidth = 0.5 * dpr;
    for (let i = 0; i < 8; i++) {
      const ry = skyline + (height - skyline) * (0.1 + i * 0.12);
      const wave = Math.sin(now * 0.5 + i * 1.5) * 3 * dpr;
      ctx.beginPath();
      for (let x = 0; x < width; x += 4) {
        const y = ry + Math.sin(x * 0.005 + now + i) * wave;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // ── Beat flash overlay ──
    if (pulse > 0.1) {
      ctx.fillStyle = `rgba(${ar}, ${ag}, ${ab}, ${pulse * 0.06})`;
      ctx.fillRect(0, 0, width, height);
    }
  }, [audioFeatures, accentColor, isBeat, stars, buildings]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
