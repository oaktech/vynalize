import { useRef, useEffect, useMemo } from 'react';
import { useStore } from '../../store';
import { getVisDpr, applyGlow, clearGlow } from '../../utils/perfConfig';

// ── Config ───────────────────────────────────────────────────

const GRID_ROWS = 30;
const GRID_COLS = 24;
const STAR_COUNT = 180;
const MOUNTAIN_POINTS = 80;

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
    y: Math.random() * 0.45,
    size: 0.5 + Math.random() * 1.5,
    speed: 0.3 + Math.random() * 0.7,
  }));
}

// ── Mountain silhouette ──────────────────────────────────────

function createMountain(points: number): number[] {
  // Jagged peaks: abs(sine) creates sharp triangular ridges
  return Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    return (
      Math.abs(Math.sin(t * 7.3 + 0.5)) * 0.35 +
      Math.abs(Math.sin(t * 13.1 + 1.2)) * 0.25 +
      Math.abs(Math.sin(t * 23.7 + 0.3)) * 0.15 +
      Math.abs(Math.sin(t * 41 + 2.1)) * 0.08
    ) * 0.5 + 0.1;
  });
}

// ── Component ────────────────────────────────────────────────

export default function Synthwave({ accentColor }: { accentColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioFeatures = useStore((s) => s.audioFeatures);
  const isBeat = useStore((s) => s.isBeat);
  const bpm = useStore((s) => s.bpm);

  const beatPulse = useRef(0);
  const gridScroll = useRef(0);
  const smooth = useRef({ rms: 0, bass: 0, mid: 0, high: 0, energy: 0 });
  const shootingStars = useRef<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number }[]>([]);
  const lastShootingStar = useRef(0);

  const stars = useMemo(() => createStars(STAR_COUNT), []);
  const baseMountain = useMemo(() => createMountain(MOUNTAIN_POINTS), []);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioFeatures) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const dpr = getVisDpr();
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
    beatPulse.current *= 0.85;
    const pulse = beatPulse.current;

    // Scroll speed tied to BPM
    const beatsPerSec = (bpm || 120) / 60;
    gridScroll.current += beatsPerSec * 0.012;

    const horizon = height * 0.48;

    // ── Sky gradient ──
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
    skyGrad.addColorStop(0, '#0a0010');
    skyGrad.addColorStop(0.6, '#1a0030');
    skyGrad.addColorStop(1, `rgba(${ar}, ${ag}, ${ab}, 0.15)`);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, horizon);

    // ── Ground gradient ──
    const gndGrad = ctx.createLinearGradient(0, horizon, 0, height);
    gndGrad.addColorStop(0, '#0a0010');
    gndGrad.addColorStop(1, '#000000');
    ctx.fillStyle = gndGrad;
    ctx.fillRect(0, horizon, width, height - horizon);

    // ── Stars ──
    for (const star of stars) {
      const twinkle = 0.4 + 0.6 * Math.sin(performance.now() / 1000 * star.speed + star.x * 100);
      const bright = twinkle + s.high * 0.5;
      const sz = star.size * dpr * (0.8 + pulse * 0.3);
      ctx.beginPath();
      ctx.arc(star.x * width, star.y * height, sz, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, bright * 0.7)})`;
      ctx.fill();
    }

    // ── Shooting stars ──
    const now = performance.now() / 1000;

    // Spawn one every 3-6 seconds randomly
    if (now - lastShootingStar.current > 10 + Math.random() * 5) {
      lastShootingStar.current = now;
      const startX = Math.random() * width;
      const startY = Math.random() * horizon * 0.35;
      // Random direction: downward or sideways, left or right
      const dir = Math.random() < 0.5 ? 1 : -1;
      const angle = (0.1 + Math.random() * 0.6) * dir; // varying steepness
      const speed = width * (0.006 + Math.random() * 0.008);
      shootingStars.current.push({
        x: startX, y: startY,
        vx: Math.cos(angle) * speed * dir,
        vy: Math.abs(Math.sin(angle)) * speed + speed * 0.2, // always some downward
        life: 0,
        maxLife: 20 + Math.random() * 40,
        size: 1.5 + Math.random() * 1.5,
      });
    }

    // Update and draw
    shootingStars.current = shootingStars.current.filter((ss) => {
      ss.x += ss.vx;
      ss.y += ss.vy;
      ss.life++;

      // Kill if past horizon or fizzled out
      if (ss.y >= horizon || ss.life >= ss.maxLife) return false;

      const progress = ss.life / ss.maxLife;
      const alpha = progress < 0.15 ? progress / 0.15 : 1 - (progress - 0.15) / 0.85;
      const tailLen = 45 * dpr;

      // Tail direction from velocity
      const vel = Math.sqrt(ss.vx * ss.vx + ss.vy * ss.vy) || 1;
      const tx = -ss.vx / vel * tailLen * alpha;
      const ty = -ss.vy / vel * tailLen * alpha;

      const grad = ctx.createLinearGradient(ss.x, ss.y, ss.x + tx, ss.y + ty);
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.9})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.beginPath();
      ctx.strokeStyle = grad;
      ctx.lineWidth = ss.size * dpr;
      ctx.lineCap = 'round';
      ctx.moveTo(ss.x, ss.y);
      ctx.lineTo(ss.x + tx, ss.y + ty);
      ctx.stroke();

      // Bright head
      ctx.beginPath();
      ctx.arc(ss.x, ss.y, ss.size * dpr * (0.5 + alpha * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();

      return true;
    });

    // ── Sun ──
    const sunX = width * 0.5;
    const sunY = horizon - height * 0.02;
    const sunR = height * (0.15 + pulse * 0.03 + s.energy * 0.04);

    // Sun outer glow
    const sunGlow = ctx.createRadialGradient(sunX, sunY, sunR * 0.3, sunX, sunY, sunR * 2);
    sunGlow.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, ${0.3 + pulse * 0.3})`);
    sunGlow.addColorStop(0.5, `rgba(${ar}, ${ag}, ${ab}, 0.05)`);
    sunGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 2, 0, Math.PI * 2);
    ctx.fill();

    // Sun body with horizontal scan lines
    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.clip();

    // Sun gradient (warm top to accent bottom)
    const sunBodyGrad = ctx.createLinearGradient(sunX, sunY - sunR, sunX, sunY + sunR);
    sunBodyGrad.addColorStop(0, '#ffee44');
    sunBodyGrad.addColorStop(0.4, `rgb(${Math.min(255, ar + 60)}, ${Math.min(255, ag + 20)}, ${ab})`);
    sunBodyGrad.addColorStop(1, `rgb(${ar}, ${ag}, ${ab})`);
    ctx.fillStyle = sunBodyGrad;
    ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);

    // Horizontal slits (classic synthwave sun)
    const slitCount = 8;
    ctx.fillStyle = '#0a0010';
    for (let i = 0; i < slitCount; i++) {
      const slitY = sunY + sunR * (i / slitCount) * 0.9;
      const slitH = (2 + i * 1.5) * dpr;
      ctx.fillRect(sunX - sunR, slitY, sunR * 2, slitH);
    }

    ctx.restore();

    // ── Mountains ──
    // Modulate mountain heights with frequency data
    ctx.beginPath();
    ctx.moveTo(0, horizon);

    // Map the whole mountain to the low-frequency range that has energy
    const usableBins = Math.floor(freq.length * 0.1);
    const binsPerPoint = Math.max(1, Math.floor(usableBins / MOUNTAIN_POINTS));

    for (let i = 0; i < MOUNTAIN_POINTS; i++) {
      const t = i / (MOUNTAIN_POINTS - 1);
      const x = t * width;

      let sum = 0;
      const start = i * binsPerPoint;
      for (let j = start; j < start + binsPerPoint && j < freq.length; j++) { sum += freq[j]; }
      const freqBoost = sum / binsPerPoint / 255;
      const mtnHeight = baseMountain[i] * (1.0 + s.bass * 0.8 + pulse * 0.5) + freqBoost * 0.3;

      const y = horizon - mtnHeight * height * 0.15;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(width, horizon);
    ctx.closePath();

    // Mountain fill: dark silhouette with subtle accent tint
    const mtnGrad = ctx.createLinearGradient(0, horizon - height * 0.12, 0, horizon);
    mtnGrad.addColorStop(0, `rgba(${Math.floor(ar * 0.15)}, ${Math.floor(ag * 0.1)}, ${Math.floor(ab * 0.2)}, 0.95)`);
    mtnGrad.addColorStop(1, `rgba(${Math.floor(ar * 0.05)}, 0, ${Math.floor(ab * 0.1)}, 0.98)`);
    ctx.fillStyle = mtnGrad;
    ctx.fill();

    // Mountain edge glow
    ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${0.25 + pulse * 0.3})`;
    ctx.lineWidth = 1.5 * dpr;
    applyGlow(ctx, 8 * dpr, `rgb(${ar}, ${ag}, ${ab})`);
    ctx.stroke();
    clearGlow(ctx);

    // ── Perspective grid ──
    const vanishX = width * 0.5;
    const vanishY = horizon;
    const gridBottom = height;
    const gridAlpha = 0.4 + s.bass * 0.4 + pulse * 0.2;

    ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${gridAlpha})`;
    ctx.lineWidth = 1 * dpr;

    // Horizontal lines (recede toward horizon with perspective)
    for (let i = 0; i <= GRID_ROWS; i++) {
      const t = i / GRID_ROWS;
      // Apply scroll offset — lines move toward viewer
      const scrolled = (t + gridScroll.current) % 1;
      // Perspective: exponential spacing (closer = more spread)
      const perspT = Math.pow(scrolled, 2.5);
      const y = vanishY + perspT * (gridBottom - vanishY);

      // Fade out near horizon
      const lineFade = Math.pow(scrolled, 1.5);
      ctx.globalAlpha = lineFade;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Vertical lines (converge to vanishing point)
    ctx.globalAlpha = 1;
    for (let i = 0; i <= GRID_COLS; i++) {
      const t = (i / GRID_COLS) * 2 - 1; // -1 to 1
      const bottomX = vanishX + t * width * 0.8;

      ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${gridAlpha * 0.8})`;
      ctx.beginPath();
      ctx.moveTo(vanishX, vanishY);
      ctx.lineTo(bottomX, gridBottom);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    // ── Horizon glow line ──
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(width, horizon);
    ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${0.4 + pulse * 0.4})`;
    ctx.lineWidth = 2 * dpr;
    applyGlow(ctx, 15 * dpr * (0.5 + pulse), `rgb(${ar}, ${ag}, ${ab})`);
    ctx.stroke();
    clearGlow(ctx);

    // ── Chromatic flare on beats ──
    if (pulse > 0.1) {
      const flareGrad = ctx.createRadialGradient(sunX, horizon, 0, sunX, horizon, width * 0.4 * pulse);
      flareGrad.addColorStop(0, `rgba(255, 255, 255, ${pulse * 0.15})`);
      flareGrad.addColorStop(0.3, `rgba(${ar}, ${ag}, ${ab}, ${pulse * 0.08})`);
      flareGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = flareGrad;
      ctx.fillRect(0, 0, width, height);
    }
  }, [audioFeatures, accentColor, isBeat, bpm, stars, baseMountain]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
