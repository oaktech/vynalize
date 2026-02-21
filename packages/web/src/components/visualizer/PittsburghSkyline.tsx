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

// ── Stars ────────────────────────────────────────────────────

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
}

function createStars(count: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random() * 0.4,
    size: 0.5 + Math.random() * 1.5,
    speed: 0.3 + Math.random() * 0.7,
  }));
}

// ── Buildings (Pittsburgh skyline silhouette) ────────────────

interface Building {
  x: number;
  width: number;
  height: number;
  windows: { row: number; col: number }[];
  hasPeak: boolean;
  peakHeight: number;
}

function createBuildings(count: number): Building[] {
  const buildings: Building[] = [];
  let cursor = 0;

  for (let i = 0; i < count; i++) {
    const w = 0.015 + Math.random() * 0.04;
    const h = 0.08 + Math.random() * 0.35;
    // Taller in the center (Pittsburgh downtown cluster)
    const centerBoost = 1 - Math.abs((cursor + w / 2) - 0.5) * 1.4;
    const finalH = h * (0.5 + Math.max(0, centerBoost) * 0.8);
    const hasPeak = Math.random() < 0.2;
    const peakHeight = hasPeak ? finalH * (0.05 + Math.random() * 0.15) : 0;

    // Generate window grid
    const windowCols = Math.max(1, Math.floor(w * 80));
    const windowRows = Math.max(1, Math.floor(finalH * 20));
    const windows: { row: number; col: number }[] = [];
    for (let r = 0; r < windowRows; r++) {
      for (let c = 0; c < windowCols; c++) {
        if (Math.random() < 0.4) windows.push({ row: r, col: c });
      }
    }

    buildings.push({ x: cursor, width: w, height: finalH, windows, hasPeak, peakHeight });
    cursor += w + Math.random() * 0.005;
  }

  return buildings;
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
      const twinkle = 0.4 + 0.6 * Math.sin(performance.now() / 1000 * star.speed + star.x * 100);
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
