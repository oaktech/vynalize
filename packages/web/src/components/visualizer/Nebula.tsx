import { useRef, useEffect, useMemo } from 'react';
import { useStore } from '../../store';

// ── Color helpers ────────────────────────────────────────────

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
  // Rotate hue ~150° for an analogous-complement that blends beautifully
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
  h = (h + 0.42) % 1; // ~150° rotation
  // HSL to RGB
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

// ── Stars ────────────────────────────────────────────────────

interface Star {
  x: number; // 0-1 normalized
  y: number;
  size: number;
  brightness: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

function createStars(count: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random(),
      y: Math.random(),
      size: 0.5 + Math.random() * 1.5,
      brightness: 0.3 + Math.random() * 0.7,
      twinkleSpeed: 0.5 + Math.random() * 2,
      twinkleOffset: Math.random() * Math.PI * 2,
    });
  }
  return stars;
}

// ── Orbiting particles ───────────────────────────────────────

interface Orb {
  angle: number;
  radius: number; // normalized 0-1
  speed: number;
  size: number;
  brightness: number;
  layer: number; // 0-2, controls parallax
  drift: number; // radius oscillation offset
}

function createOrbs(count: number): Orb[] {
  const orbs: Orb[] = [];
  for (let i = 0; i < count; i++) {
    orbs.push({
      angle: Math.random() * Math.PI * 2,
      radius: 0.15 + Math.random() * 0.35,
      speed: (0.2 + Math.random() * 0.6) * (Math.random() < 0.5 ? 1 : -1),
      size: 1 + Math.random() * 3,
      brightness: 0.4 + Math.random() * 0.6,
      layer: Math.floor(Math.random() * 3),
      drift: Math.random() * Math.PI * 2,
    });
  }
  return orbs;
}

// ── Component ────────────────────────────────────────────────

const STAR_COUNT = 250;
const ORB_COUNT = 90;
const RIBBON_COUNT = 4;

export default function Nebula({ accentColor }: { accentColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioFeatures = useStore((s) => s.audioFeatures);
  const isBeat = useStore((s) => s.isBeat);
  const bpm = useStore((s) => s.bpm);

  const beatPulse = useRef(0);
  const smooth = useRef({ rms: 0, bass: 0, mid: 0, high: 0, energy: 0 });
  const trailCanvas = useRef<HTMLCanvasElement | null>(null);

  const stars = useMemo(() => createStars(STAR_COUNT), []);
  const orbs = useMemo(() => createOrbs(ORB_COUNT), []);

  // Canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const w = canvas.clientWidth * devicePixelRatio;
      const h = canvas.clientHeight * devicePixelRatio;
      canvas.width = w;
      canvas.height = h;
      // Also resize trail canvas
      if (!trailCanvas.current) {
        trailCanvas.current = document.createElement('canvas');
      }
      trailCanvas.current.width = w;
      trailCanvas.current.height = h;
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
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.max(width, height) * 0.5;
    const now = performance.now() / 1000;

    // ── Smooth audio params ──
    const s = smooth.current;
    const lerp = 0.08;
    s.rms += (audioFeatures.rms - s.rms) * lerp;
    s.bass += (audioFeatures.bass - s.bass) * lerp;
    s.mid += (audioFeatures.mid - s.mid) * lerp;
    s.high += (audioFeatures.high - s.high) * lerp;
    s.energy += (audioFeatures.energy - s.energy) * lerp;

    // Beat pulse decay
    beatPulse.current *= 0.85;
    const pulse = beatPulse.current;

    // Colors
    const [r1, g1, b1] = hexToRgb(accentColor);
    const [r2, g2, b2] = complementary(r1, g1, b1);

    // ── Trail effect: fade previous frame ──
    const trail = trailCanvas.current;
    if (trail) {
      const tctx = trail.getContext('2d')!;
      // Copy current canvas to trail
      tctx.globalCompositeOperation = 'source-over';
      tctx.drawImage(canvas, 0, 0);
    }

    // Clear main canvas
    ctx.clearRect(0, 0, width, height);

    // Draw faded trail (creates light streaks on particles)
    if (trail) {
      ctx.globalAlpha = 0.45 + s.energy * 0.3;
      ctx.drawImage(trail, 0, 0);
      ctx.globalAlpha = 1;
    }

    // ── Layer 1: Star field ──
    const twinkle = s.high * 2;
    for (const star of stars) {
      const sx = star.x * width;
      const sy = star.y * height;
      const flicker = 0.5 + 0.5 * Math.sin(now * star.twinkleSpeed + star.twinkleOffset);
      const bright = star.brightness * (0.4 + flicker * 0.6) + twinkle * flicker * 0.3;
      const sz = star.size * devicePixelRatio * (0.8 + pulse * 0.4);

      ctx.beginPath();
      ctx.arc(sx, sy, sz, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, bright * 0.8)})`;
      ctx.fill();
    }

    // ── Layer 2: Aurora ribbons ──
    const beatsPerSec = (bpm || 120) / 60;

    for (let ri = 0; ri < RIBBON_COUNT; ri++) {
      const ribbonY = height * (0.2 + ri * 0.2);
      const isAccent = ri % 2 === 0;
      const [rr, rg, rb] = isAccent ? [r1, g1, b1] : [r2, g2, b2];

      const ribbonAmp = height * (0.06 + s.bass * 0.15 + pulse * 0.04);
      const ribbonWidth = height * (0.08 + s.energy * 0.12);
      const phaseOffset = ri * 1.7;
      const speed = beatsPerSec * 0.3 * (ri % 2 === 0 ? 1 : -0.7);

      ctx.beginPath();
      ctx.moveTo(0, ribbonY);

      // Top edge
      for (let x = 0; x <= width; x += 4) {
        const t = x / width;
        const wave =
          Math.sin(t * 3 * Math.PI + now * speed + phaseOffset) * 0.6 +
          Math.sin(t * 5 * Math.PI - now * speed * 0.5 + phaseOffset * 2) * 0.4;
        const y = ribbonY + wave * ribbonAmp;
        ctx.lineTo(x, y);
      }

      // Bottom edge (reverse)
      for (let x = width; x >= 0; x -= 4) {
        const t = x / width;
        const wave =
          Math.sin(t * 3 * Math.PI + now * speed + phaseOffset + 0.5) * 0.6 +
          Math.sin(t * 5 * Math.PI - now * speed * 0.5 + phaseOffset * 2 + 0.3) * 0.4;
        const y = ribbonY + wave * ribbonAmp + ribbonWidth;
        ctx.lineTo(x, y);
      }

      ctx.closePath();

      const grad = ctx.createLinearGradient(0, ribbonY - ribbonAmp, 0, ribbonY + ribbonAmp + ribbonWidth);
      const alpha = 0.04 + s.energy * 0.08 + pulse * 0.03;
      grad.addColorStop(0, `rgba(${rr}, ${rg}, ${rb}, 0)`);
      grad.addColorStop(0.3, `rgba(${rr}, ${rg}, ${rb}, ${alpha})`);
      grad.addColorStop(0.5, `rgba(${rr}, ${rg}, ${rb}, ${alpha * 1.5})`);
      grad.addColorStop(0.7, `rgba(${rr}, ${rg}, ${rb}, ${alpha})`);
      grad.addColorStop(1, `rgba(${rr}, ${rg}, ${rb}, 0)`);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // ── Layer 3: Central energy orb ──
    const orbRadius = maxR * (0.15 + s.rms * 0.3 + pulse * 0.15);
    const orbAlpha = 0.15 + s.energy * 0.25 + pulse * 0.2;

    // Outer glow
    const outerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbRadius * 2.5);
    outerGlow.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, ${orbAlpha * 0.6})`);
    outerGlow.addColorStop(0.3, `rgba(${r2}, ${g2}, ${b2}, ${orbAlpha * 0.3})`);
    outerGlow.addColorStop(0.7, `rgba(${r1}, ${g1}, ${b1}, ${orbAlpha * 0.08})`);
    outerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, orbRadius * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Inner core
    const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbRadius);
    const coreAlpha = 0.3 + pulse * 0.5 + s.rms * 0.3;
    coreGlow.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, coreAlpha)})`);
    coreGlow.addColorStop(0.2, `rgba(${r1}, ${g1}, ${b1}, ${coreAlpha * 0.7})`);
    coreGlow.addColorStop(0.6, `rgba(${r2}, ${g2}, ${b2}, ${coreAlpha * 0.3})`);
    coreGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, orbRadius, 0, Math.PI * 2);
    ctx.fill();

    // ── Layer 4: Orbiting particles ──
    const orbSpeed = beatsPerSec * 0.4;

    for (const orb of orbs) {
      // Update angle
      const layerSpeed = 1 - orb.layer * 0.25;
      orb.angle += orb.speed * orbSpeed * 0.016 * layerSpeed;

      // Radius oscillation — breathes in and out
      const radiusMod = orb.radius + Math.sin(now * 0.5 + orb.drift) * 0.06;
      const dist = radiusMod * maxR + s.bass * maxR * 0.08 + pulse * maxR * 0.06;

      // Slight vertical wobble for 3D feel
      const wobble = Math.sin(now * 0.7 + orb.angle * 2) * height * 0.03 * (orb.layer + 1);

      const ox = cx + Math.cos(orb.angle) * dist;
      const oy = cy + Math.sin(orb.angle) * dist * 0.6 + wobble; // elliptical orbit

      const sz = orb.size * devicePixelRatio * (0.8 + s.energy * 0.8 + pulse * 0.5);
      const bright = orb.brightness * (0.5 + s.energy * 0.5 + pulse * 0.4);

      // Particle glow
      const isAccentParticle = orb.layer < 2;
      const [pr, pg, pb] = isAccentParticle ? [r1, g1, b1] : [r2, g2, b2];

      const pGlow = ctx.createRadialGradient(ox, oy, 0, ox, oy, sz * 4);
      pGlow.addColorStop(0, `rgba(${pr}, ${pg}, ${pb}, ${Math.min(1, bright)})`);
      pGlow.addColorStop(0.4, `rgba(${pr}, ${pg}, ${pb}, ${bright * 0.3})`);
      pGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = pGlow;
      ctx.beginPath();
      ctx.arc(ox, oy, sz * 4, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.beginPath();
      ctx.arc(ox, oy, sz, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, bright * 0.9)})`;
      ctx.fill();
    }
  }, [audioFeatures, accentColor, isBeat, bpm, stars, orbs]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
