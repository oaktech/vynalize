import { useRef, useEffect, useMemo } from 'react';
import { useStore } from '../../store';

// ── Color helpers ────────────────────────────────────────────

/** Compress dynamic range — same approach as SpectrumBars boost().
 *  Quiet mic signals get amplified, loud signals are tamed. */
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

  // Eye gaze state — smooth wandering with saccade-like jumps on beats
  const gaze = useRef({ x: 0, y: 0 });           // current gaze (-1 to 1)
  const gazeTarget = useRef({ x: 0, y: 0 });      // where the eye is drifting toward
  const gazeTimer = useRef(0);                      // time until next random target
  const blinkPhase = useRef(-1);                    // -1 = open, 0-1 = blink progress
  const nextBlink = useRef(2 + Math.random() * 4);  // seconds until next autonomous blink

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

    // ── Smooth audio params (fast attack, slow decay — matches SpectrumBars) ──
    const s = smooth.current;
    const { rms, bass, mid, high, energy } = audioFeatures;
    s.rms += (rms - s.rms) * (rms > s.rms ? 0.4 : 0.15);
    s.bass += (bass - s.bass) * (bass > s.bass ? 0.4 : 0.15);
    s.mid += (mid - s.mid) * (mid > s.mid ? 0.4 : 0.15);
    s.high += (high - s.high) * (high > s.high ? 0.4 : 0.15);
    s.energy += (energy - s.energy) * (energy > s.energy ? 0.4 : 0.15);

    // Compressed audio — boost quiet mic signals into visible range
    const bBass = boost(s.bass, 3.5);
    const bMid = boost(s.mid, 4.0);
    const bHigh = boost(s.high, 5.0);
    const bRms = boost(s.rms, 3.0);
    const bEnergy = boost(s.energy, 3.0);
    const bLowMid = boost(s.bass * 0.4 + s.mid * 0.6, 6.0); // lower-mid blend — strongest on mic

    // Beat pulse decay
    beatPulse.current *= 0.88;
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
      tctx.drawImage(canvasRef.current!, 0, 0);
    }

    // Clear main canvas
    ctx.clearRect(0, 0, width, height);

    // Draw faded trail (creates light streaks on particles)
    if (trail) {
      ctx.globalAlpha = 0.45 + bLowMid * 0.35;
      ctx.drawImage(trail, 0, 0);
      ctx.globalAlpha = 1;
    }

    // ── Layer 1: Star field ──
    const twinkle = bHigh * 2;
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

      const ribbonAmp = height * (0.06 + bLowMid * 0.22 + pulse * 0.05);
      const ribbonWidth = height * (0.08 + bLowMid * 0.16);
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
      const alpha = 0.04 + bLowMid * 0.14 + pulse * 0.04;
      grad.addColorStop(0, `rgba(${rr}, ${rg}, ${rb}, 0)`);
      grad.addColorStop(0.3, `rgba(${rr}, ${rg}, ${rb}, ${alpha})`);
      grad.addColorStop(0.5, `rgba(${rr}, ${rg}, ${rb}, ${alpha * 1.5})`);
      grad.addColorStop(0.7, `rgba(${rr}, ${rg}, ${rb}, ${alpha})`);
      grad.addColorStop(1, `rgba(${rr}, ${rg}, ${rb}, 0)`);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // ── Layer 3: Eye ──

    // Gaze: look somewhere, hold, return to center, rest, repeat
    // gazeTimer counts down through phases:
    //   > 0: holding gaze on target (or resting at center)
    //   <= 0: pick new action
    gazeTimer.current -= 0.016;
    if (gazeTimer.current <= 0) {
      const atCenter = Math.abs(gazeTarget.current.x) < 0.1 && Math.abs(gazeTarget.current.y) < 0.1;
      if (atCenter) {
        // Was resting at center → glance somewhere
        gazeTarget.current = {
          x: (Math.random() - 0.5) * 1.8,
          y: (Math.random() - 0.5) * 1.2,
        };
        gazeTimer.current = 0.6 + Math.random() * 1.2; // hold the glance briefly
      } else {
        // Was looking somewhere → return to center and rest
        gazeTarget.current = { x: 0, y: 0 };
        gazeTimer.current = 2 + Math.random() * 4; // rest at center for a while
      }
    }
    // On beat: quick glance, then it will naturally return to center after
    if (pulse > 0.9) {
      gazeTarget.current = {
        x: (Math.random() - 0.5) * 1.8,
        y: (Math.random() - 0.5) * 1.2,
      };
      gazeTimer.current = 0.3 + Math.random() * 0.6; // short hold before returning
      // Occasional blink on strong beats
      if (Math.random() < 0.25 && blinkPhase.current < 0) {
        blinkPhase.current = 0;
      }
    }
    // Smooth interpolation — fast initial move, gentle settle
    gaze.current.x += (gazeTarget.current.x - gaze.current.x) * 0.08;
    gaze.current.y += (gazeTarget.current.y - gaze.current.y) * 0.08;

    // Autonomous blink — every 3-7 seconds like a real human
    nextBlink.current -= 0.016;
    if (nextBlink.current <= 0 && blinkPhase.current < 0) {
      blinkPhase.current = 0;
      nextBlink.current = 3 + Math.random() * 4;
    }

    // Blink animation — fast close, slightly slower open (~200ms total)
    if (blinkPhase.current >= 0) {
      // Close fast (0→0.45), open slightly slower (0.45→1)
      blinkPhase.current += blinkPhase.current < 0.45 ? 0.15 : 0.1;
      if (blinkPhase.current >= 1) blinkPhase.current = -1;
    }
    // Blink curve: quick snap shut, gentle reopen
    const blinkAmount = blinkPhase.current >= 0
      ? Math.sin(blinkPhase.current * Math.PI)
      : 0;

    const eyeRadius = maxR * (0.14 + bLowMid * 0.1 + pulse * 0.05);
    const irisRadius = eyeRadius * (0.55 + bLowMid * 0.12);
    const pupilRadius = irisRadius * (0.4 + pulse * 0.15 - bLowMid * 0.1); // dilates with beats
    const gazeMaxDist = eyeRadius * 0.55;
    // Outer nebula glow (sclera glow)
    const orbAlpha = 0.15 + bLowMid * 0.35 + pulse * 0.25;
    const outerGlow = ctx.createRadialGradient(cx, cy, eyeRadius * 0.5, cx, cy, eyeRadius * 2.5);
    outerGlow.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, ${orbAlpha * 0.5})`);
    outerGlow.addColorStop(0.3, `rgba(${r2}, ${g2}, ${b2}, ${orbAlpha * 0.25})`);
    outerGlow.addColorStop(0.7, `rgba(${r1}, ${g1}, ${b1}, ${orbAlpha * 0.06})`);
    outerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, eyeRadius * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // All eye elements share one transform — blink squishes everything vertically
    ctx.save();
    const eyeOpenY = 1 - blinkAmount * 0.95; // 1 = open, ~0.05 = closed
    ctx.translate(cx, cy);
    ctx.scale(1, eyeOpenY); // round when open; collapses flat on blink

    // Relative iris position (gaze offset from eye center)
    const relIrisX = gaze.current.x * gazeMaxDist;
    const relIrisY = gaze.current.y * gazeMaxDist;

    // Sclera (eye white)
    ctx.beginPath();
    ctx.arc(0, 0, eyeRadius, 0, Math.PI * 2);
    const scleraGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, eyeRadius);
    scleraGrad.addColorStop(0, `rgba(220, 220, 230, ${0.12 + bLowMid * 0.12})`);
    scleraGrad.addColorStop(0.6, `rgba(180, 180, 200, ${0.08 + bLowMid * 0.08})`);
    scleraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = scleraGrad;
    ctx.fill();

    // Iris (colored ring that follows gaze)
    const irisGrad = ctx.createRadialGradient(
      relIrisX, relIrisY, pupilRadius * 0.5,
      relIrisX, relIrisY, irisRadius,
    );
    const irisAlpha = 0.5 + bLowMid * 0.5 + pulse * 0.25;
    irisGrad.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, ${Math.min(1, irisAlpha * 1.2)})`);
    irisGrad.addColorStop(0.3, `rgba(${r1}, ${g1}, ${b1}, ${Math.min(1, irisAlpha)})`);
    irisGrad.addColorStop(0.6, `rgba(${r2}, ${g2}, ${b2}, ${irisAlpha * 0.7})`);
    irisGrad.addColorStop(0.85, `rgba(${r1}, ${g1}, ${b1}, ${irisAlpha * 0.5})`);
    irisGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(relIrisX, relIrisY, irisRadius, 0, Math.PI * 2);
    ctx.fill();

    // Iris texture — radial streaks
    const streakCount = 24;
    for (let i = 0; i < streakCount; i++) {
      const angle = (i / streakCount) * Math.PI * 2 + now * 0.05;
      const innerR = pupilRadius * 1.1;
      const outerR = irisRadius * (0.85 + Math.sin(angle * 3 + now) * 0.1);
      ctx.beginPath();
      ctx.moveTo(
        relIrisX + Math.cos(angle) * innerR,
        relIrisY + Math.sin(angle) * innerR,
      );
      ctx.lineTo(
        relIrisX + Math.cos(angle) * outerR,
        relIrisY + Math.sin(angle) * outerR,
      );
      ctx.strokeStyle = `rgba(${r1}, ${g1}, ${b1}, ${0.08 + pulse * 0.06})`;
      ctx.lineWidth = 1.5 * devicePixelRatio;
      ctx.stroke();
    }

    // Pupil (dark center)
    const pupilGrad = ctx.createRadialGradient(
      relIrisX, relIrisY, 0,
      relIrisX, relIrisY, pupilRadius,
    );
    pupilGrad.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
    pupilGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.9)');
    pupilGrad.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
    ctx.fillStyle = pupilGrad;
    ctx.beginPath();
    ctx.arc(relIrisX, relIrisY, pupilRadius, 0, Math.PI * 2);
    ctx.fill();

    // Specular highlight (catchlight)
    const hlX = relIrisX - irisRadius * 0.25;
    const hlY = relIrisY - irisRadius * 0.3;
    const hlR = pupilRadius * 0.35;
    ctx.beginPath();
    ctx.arc(hlX, hlY, hlR, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + pulse * 0.3})`;
    ctx.fill();

    // Smaller secondary catchlight
    ctx.beginPath();
    ctx.arc(relIrisX + irisRadius * 0.2, relIrisY + irisRadius * 0.2, hlR * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + pulse * 0.15})`;
    ctx.fill();

    ctx.restore(); // end eye transform — blink collapses all elements together

    // ── Layer 4: Orbiting particles ──
    const orbSpeed = beatsPerSec * 0.4;

    for (const orb of orbs) {
      // Update angle
      const layerSpeed = 1 - orb.layer * 0.25;
      orb.angle += orb.speed * orbSpeed * 0.016 * layerSpeed;

      // Radius oscillation — breathes in and out
      const radiusMod = orb.radius + Math.sin(now * 0.5 + orb.drift) * 0.06;
      const dist = radiusMod * maxR + bLowMid * maxR * 0.14 + pulse * maxR * 0.08;

      // Slight vertical wobble for 3D feel
      const wobble = Math.sin(now * 0.7 + orb.angle * 2) * height * 0.03 * (orb.layer + 1);

      const ox = cx + Math.cos(orb.angle) * dist;
      const oy = cy + Math.sin(orb.angle) * dist * 0.6 + wobble; // elliptical orbit

      const sz = orb.size * devicePixelRatio * (0.8 + bLowMid * 1.0 + pulse * 0.6);
      const bright = orb.brightness * (0.5 + bLowMid * 0.6 + pulse * 0.5);

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
