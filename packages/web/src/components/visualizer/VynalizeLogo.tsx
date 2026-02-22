import { useRef, useEffect, useCallback } from 'react';
import { getVisDpr, applyGlow, clearGlow, useVisualizerLoop, audioRef } from '../../utils/perfConfig';

// ── Helpers ──────────────────────────────────────────────────

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

function boost(value: number, gain: number = 4.0): number {
  return Math.min(1, Math.pow(value * gain, 0.55));
}

// ── Particle types ───────────────────────────────────────────

interface Sparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
}

interface Ripple {
  radius: number;
  life: number;
}

// ── Component ────────────────────────────────────────────────

export default function VynalizeLogo({ accentColor }: { accentColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Persistent animation state (all mutable, no React state)
  const timeRef = useRef(0);
  const lastFrameRef = useRef(performance.now());
  const rotationRef = useRef(0);
  const pupilScale = useRef([1, 1]);
  const lidOpenness = useRef([0.85, 0.85]);
  const browBounce = useRef([0, 0]);
  const beatPulse = useRef(0);
  const eyeScale = useRef([1, 1]);
  const headBobPhase = useRef(0);
  const sparkles = useRef<Sparkle[]>([]);
  const ripples = useRef<Ripple[]>([]);
  const smooth = useRef({ bass: 0, mid: 0, high: 0, energy: 0, rms: 0 });
  const irisRot = useRef(0);
  const waveBurst = useRef(0);
  const prevBeat = useRef(false);

  // ── Resize ─────────────────────────────────────────────────

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

  // ── Main draw callback ──────────────────────────────────────

  const draw = useCallback((ctx: CanvasRenderingContext2D, W: number, H: number) => {
    const audioFeatures = audioRef.features;
    if (!audioFeatures) return;

    // Beat edge detection from shared ref
    if (audioRef.isBeat && !prevBeat.current) {
      beatPulse.current = 1;
      pupilScale.current = [0.45, 0.45];
      eyeScale.current = [1.09, 1.09];
      lidOpenness.current = [1, 1];
      browBounce.current = [-1, -1];
      waveBurst.current = 1;
    }
    prevBeat.current = audioRef.isBeat;

    const bpm = audioRef.bpm;

    const now = performance.now();
    const dt = Math.min((now - lastFrameRef.current) / 1000, 0.05);
    lastFrameRef.current = now;
    timeRef.current += dt;
    const time = timeRef.current;

    const dpr = getVisDpr();
    const [ar, ag, ab] = hexToRgb(accentColor);

    // ── Smooth audio (fast attack, slow decay) ───────────────

    const s = smooth.current;
    for (const key of ['bass', 'mid', 'high', 'energy', 'rms'] as const) {
      const raw = audioFeatures[key];
      s[key] += (raw - s[key]) * (raw > s[key] ? 0.4 : 0.12);
    }

    const bass = boost(s.bass, 5.0);
    const mid = boost(s.mid, 4.0);
    const high = boost(s.high, 3.0);
    const energy = boost(s.energy, 4.0);
    const rms = boost(s.rms, 3.5);

    // ── Decay animated values ────────────────────────────────

    beatPulse.current *= 0.88;
    const bp = beatPulse.current;

    for (let i = 0; i < 2; i++) {
      pupilScale.current[i] += (1 - pupilScale.current[i]) * 0.035;
      eyeScale.current[i] += (1 - eyeScale.current[i]) * 0.055;
      browBounce.current[i] *= 0.87;
    }
    waveBurst.current *= 0.9;

    // Lid openness drifts toward energy-based target
    const lidTarget = 0.5 + energy * 0.5;
    for (let i = 0; i < 2; i++) {
      lidOpenness.current[i] += (lidTarget - lidOpenness.current[i]) * 0.07;
    }

    // ── Record spin ──────────────────────────────────────────

    const rpmBase = (2 * Math.PI) / 1.82; // ~33 RPM
    const bpmFactor = bpm ? bpm / 120 : 1;
    const spinSpeed = rpmBase * bpmFactor * (1 + energy * 0.3);
    rotationRef.current += spinSpeed * dt;
    irisRot.current -= spinSpeed * 0.4 * dt;

    // ── Head bob ─────────────────────────────────────────────

    const bobRate = bpm ? (bpm / 60) * Math.PI * 2 : Math.PI * 0.8;
    headBobPhase.current += bobRate * dt;
    const bobAmount = H * 0.012 * (0.3 + energy * 0.7);
    const headBob = Math.sin(headBobPhase.current) * bobAmount;

    // ── Layout ───────────────────────────────────────────────

    const faceX = W / 2;
    const faceY = H * 0.43 + headBob;
    const eyeR = Math.min(W, H) * 0.135;
    const eyeGap = eyeR * 2.7;
    const lx = faceX - eyeGap / 2;
    const rx = faceX + eyeGap / 2;

    // ── Clear & background ───────────────────────────────────

    ctx.fillStyle = '#08080b';
    ctx.fillRect(0, 0, W, H);

    // Accent glow behind face
    const bgGlow = ctx.createRadialGradient(
      faceX, faceY, 0, faceX, faceY, Math.max(W, H) * 0.5,
    );
    bgGlow.addColorStop(0, `rgba(${ar},${ag},${ab},${0.04 + energy * 0.05})`);
    bgGlow.addColorStop(0.4, `rgba(${ar},${ag},${ab},${0.015 + energy * 0.02})`);
    bgGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bgGlow;
    ctx.fillRect(0, 0, W, H);

    // ── Background ripples ───────────────────────────────────

    if (bp > 0.85) {
      ripples.current.push({ radius: eyeR * 0.5, life: 1 });
    }
    for (let i = ripples.current.length - 1; i >= 0; i--) {
      const rip = ripples.current[i];
      rip.radius += Math.max(W, H) * 0.004;
      rip.life -= 0.01;
      if (rip.life <= 0) { ripples.current.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(faceX, faceY, rip.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${ar},${ag},${ab},${rip.life * 0.12})`;
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();
    }

    // ── Draw each eye (vinyl record) ─────────────────────────

    const eyes = [
      { cx: lx, cy: faceY, phase: 0 },
      { cx: rx, cy: faceY, phase: Math.PI / 3 },
    ];

    for (let ei = 0; ei < 2; ei++) {
      const eye = eyes[ei];
      const rot = rotationRef.current;
      const wobbleAmp = 0.018 + bass * 0.028;
      const wobble = Math.sin(time * 1.2 + eye.phase) * wobbleAmp;
      const sc = eyeScale.current[ei];
      const r = eyeR * sc;

      ctx.save();
      ctx.translate(eye.cx, eye.cy);
      ctx.scale(1, 1 + wobble); // warped-record wobble

      // ── Outer glow (accent tinted) ──

      const outerGlow = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.4);
      outerGlow.addColorStop(0, 'rgba(0,0,0,0)');
      outerGlow.addColorStop(0.7, `rgba(${ar},${ag},${ab},${0.02 + bp * 0.06})`);
      outerGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = outerGlow;
      ctx.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 3);

      // ── Vinyl disc (rotates) ──

      ctx.save();
      ctx.rotate(rot);

      // Main disc body
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      const discGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      discGrad.addColorStop(0, '#1a1a1a');
      discGrad.addColorStop(0.3, '#111');
      discGrad.addColorStop(0.9, '#0e0e0e');
      discGrad.addColorStop(1, '#1a1a1a');
      ctx.fillStyle = discGrad;
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1.2 * dpr;
      ctx.stroke();

      // Groove rings
      const grooveCount = 12;
      for (let gi = 0; gi < grooveCount; gi++) {
        const norm = gi / grooveCount;
        const gr = r * (0.36 + norm * 0.58);
        if (gr > r * 0.96) continue;
        // Alternate groove brightness for realism
        const grooveBright = gi % 2 === 0 ? 35 : 28;
        const grooveAlpha = 0.35 + rms * 0.25;
        ctx.beginPath();
        ctx.arc(0, 0, gr, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${grooveBright},${grooveBright},${grooveBright},${grooveAlpha})`;
        ctx.lineWidth = (gi % 3 === 0 ? 0.8 : 0.4) * dpr;
        ctx.stroke();
      }

      // Light reflection sweep (rotating glint across grooves)
      const sweepAngle = time * 0.6;
      ctx.save();
      ctx.rotate(sweepAngle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r * 0.97, -0.2, 0.2);
      ctx.closePath();
      const sweepGrad = ctx.createRadialGradient(0, 0, r * 0.35, 0, 0, r * 0.95);
      sweepGrad.addColorStop(0, 'rgba(255,255,255,0)');
      sweepGrad.addColorStop(0.5, `rgba(255,255,255,${0.035 + rms * 0.045})`);
      sweepGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sweepGrad;
      ctx.fill();
      ctx.restore();

      ctx.restore(); // un-rotate for iris

      // ── Rainbow iris ──

      const irisBase = r * 0.33;
      const irisPulse = 1 + energy * 0.1 + bp * 0.05;
      const irisR = irisBase * irisPulse;

      // Eye tracking: subtle iris offset from spectral centroid
      const centroidNorm = Math.min(audioFeatures.spectralCentroid / 8000, 1);
      const trackX = (centroidNorm - 0.4) * r * 0.06;
      const trackY = Math.sin(time * 0.4) * r * 0.015;

      ctx.save();
      ctx.translate(trackX, trackY);

      // Conic gradient (rainbow)
      const conicAngle = irisRot.current;
      const conic = ctx.createConicGradient(conicAngle, 0, 0);
      conic.addColorStop(0, '#ff3366');
      conic.addColorStop(0.1, '#ff6633');
      conic.addColorStop(0.22, '#ffcc00');
      conic.addColorStop(0.36, '#33ff88');
      conic.addColorStop(0.5, '#33ddff');
      conic.addColorStop(0.64, '#5566ff');
      conic.addColorStop(0.78, '#aa33ff');
      conic.addColorStop(0.9, '#ff33aa');
      conic.addColorStop(1, '#ff3366');

      ctx.beginPath();
      ctx.arc(0, 0, irisR, 0, Math.PI * 2);
      ctx.fillStyle = conic;
      ctx.fill();

      // Inner iris ring for depth
      ctx.beginPath();
      ctx.arc(0, 0, irisR * 0.7, 0, Math.PI * 2);
      const innerIris = ctx.createRadialGradient(0, 0, 0, 0, 0, irisR * 0.7);
      innerIris.addColorStop(0, 'rgba(0,0,0,0.3)');
      innerIris.addColorStop(0.6, 'rgba(0,0,0,0.1)');
      innerIris.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = innerIris;
      ctx.fill();

      // Iris glow halo
      ctx.beginPath();
      ctx.arc(0, 0, irisR * 1.15, 0, Math.PI * 2);
      const halo = ctx.createRadialGradient(0, 0, irisR * 0.8, 0, 0, irisR * 1.15);
      halo.addColorStop(0, `rgba(${ar},${ag},${ab},${0.1 + energy * 0.15})`);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.fill();

      // ── Pupil ──

      const pupilBase = irisR * 0.33;
      const pupilR = pupilBase * pupilScale.current[ei];

      ctx.beginPath();
      ctx.arc(0, 0, pupilR, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();

      // Specular highlight on pupil
      const hlSize = pupilR * 0.3;
      ctx.beginPath();
      ctx.arc(-irisR * 0.1, -irisR * 0.12, hlSize, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(irisR * 0.06, -irisR * 0.08, hlSize * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fill();

      ctx.restore(); // un-translate iris

      // ── Eyelid ──

      const lid = lidOpenness.current[ei];
      if (lid < 0.97) {
        ctx.save();

        // Clip to eye circle
        ctx.beginPath();
        ctx.arc(0, 0, r + 1, 0, Math.PI * 2);
        ctx.clip();

        // Lid descends from top — higher lidBottom = more closed
        const lidBottom = -r + (r * 2) * (1 - lid);

        // Upper lid fill (matches background)
        ctx.beginPath();
        ctx.moveTo(-r - 2, -r - 2);
        ctx.lineTo(r + 2, -r - 2);
        ctx.lineTo(r + 2, lidBottom);
        ctx.quadraticCurveTo(0, lidBottom + r * 0.25, -r - 2, lidBottom);
        ctx.closePath();
        ctx.fillStyle = '#0a0a0d';
        ctx.fill();

        // Lid edge — subtle accent line
        ctx.beginPath();
        ctx.moveTo(-r * 0.95, lidBottom);
        ctx.quadraticCurveTo(0, lidBottom + r * 0.25, r * 0.95, lidBottom);
        ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.2)`;
        ctx.lineWidth = 1.5 * dpr;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.restore();
      }

      ctx.restore(); // restore eye transform
    }

    // ── Eyebrows (multiple arcs, matching logo) ──────────────

    for (let ei = 0; ei < 2; ei++) {
      const eyeX = ei === 0 ? lx : rx;
      const dir = ei === 0 ? 1 : -1; // mirror for left vs right

      // Brow raises with energy, bounces on beat
      const raise = energy * eyeR * 0.15;
      const bounce = browBounce.current[ei] * eyeR * 0.12;
      // Inner end dips with bass (intense expression)
      const innerDip = bass * eyeR * 0.07;

      // Draw 2–3 arc strokes (like the logo's expressive brow lines)
      for (let bi = 0; bi < 3; bi++) {
        const spread = bi * eyeR * 0.08;
        const baseY = faceY - eyeR * 1.3 - spread + bounce;
        const alpha = (0.7 - bi * 0.2) + energy * 0.3;
        const width = (3.5 - bi * 0.8 + energy * 2) * dpr;

        const x1 = eyeX - dir * eyeR * 0.55;
        const y1 = baseY - raise + innerDip;
        const x2 = eyeX + dir * eyeR * 0.65;
        const y2 = baseY - raise;
        const cpx = eyeX + dir * eyeR * 0.05;
        const cpy = baseY - raise - eyeR * 0.2 - high * eyeR * 0.1 - spread * 0.5;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(cpx, cpy, x2, y2);
        ctx.strokeStyle = `rgba(${ar},${ag},${ab},${Math.min(1, alpha)})`;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }

    // ── Sound waves (spectrum arcs on each side) ─────────────

    const freq = audioFeatures.frequencyData;
    const waveExpand = waveBurst.current;

    for (let side = 0; side < 2; side++) {
      const eyeX = side === 0 ? lx : rx;
      const dir = side === 0 ? -1 : 1;
      const baseX = eyeX + dir * eyeR * 1.2;

      for (let wi = 0; wi < 4; wi++) {
        // Map wave to frequency band
        const bandStart = Math.floor((wi / 4) * freq.length * 0.25);
        const bandEnd = Math.floor(((wi + 1) / 4) * freq.length * 0.25);
        let sum = 0;
        for (let fi = bandStart; fi < bandEnd; fi++) sum += freq[fi];
        const val = boost(sum / (bandEnd - bandStart) / 255, 4.5);

        const dist = eyeR * (0.15 + wi * 0.22) + waveExpand * eyeR * 0.3;
        const wx = baseX + dir * dist;
        const waveH = eyeR * 0.55 * (0.25 + val * 0.75);
        const alpha = 0.12 + val * 0.55;
        const lw = (1.5 + val * 2.5) * dpr;

        // Draw arc (concave toward the eye)
        const startAngle = side === 0 ? Math.PI * 0.55 : -Math.PI * 0.45;
        const endAngle = side === 0 ? Math.PI * 1.45 : Math.PI * 0.45;

        ctx.beginPath();
        ctx.arc(wx, faceY, waveH, startAngle, endAngle, false);
        ctx.strokeStyle = `rgba(${ar},${ag},${ab},${alpha})`;
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }

    // ── "VYNALIZE" text with staggered letter bounce ─────────

    const text = 'VYNALIZE';
    const fontSize = eyeR * 0.48;
    ctx.font = `800 ${fontSize}px "Inter", system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Measure each letter width for precise positioning
    const letterWidths: number[] = [];
    let totalW = 0;
    for (const ch of text) {
      const w = ctx.measureText(ch).width;
      letterWidths.push(w);
      totalW += w;
    }
    const spacing = fontSize * 0.08;
    totalW += spacing * (text.length - 1);

    const textY = faceY + eyeR * 2.1;
    let cursorX = faceX - totalW / 2;

    for (let li = 0; li < text.length; li++) {
      const ch = text[li];
      const lw = letterWidths[li];

      // Staggered bounce wave
      const bouncePhase = headBobPhase.current - li * 0.35;
      const bounce = Math.sin(bouncePhase) * (2 + energy * 5) * dpr;

      const charX = cursorX + lw / 2;
      const charY = textY + bounce;

      // Rainbow hue cycles through + shifts over time
      const hue = (li / text.length) * 360 + time * 40;
      const sat = 75 + energy * 25;
      const lit = 55 + bp * 25;

      ctx.save();
      ctx.fillStyle = `hsl(${hue}, ${sat}%, ${lit}%)`;
      applyGlow(ctx, (3 + bp * 10) * dpr, `rgba(${ar},${ag},${ab},${0.25 + bp * 0.4})`);
      ctx.fillText(ch, charX, charY);
      clearGlow(ctx);
      ctx.restore();

      cursorX += lw + spacing;
    }

    // ── Sparkle particles ────────────────────────────────────

    const sp = sparkles.current;

    // Spawn sparkles from record edges
    const spawnRate = energy * 2.5 + bp * 10;
    const spawnCount = Math.floor(spawnRate * dt * 60);
    for (let i = 0; i < spawnCount && sp.length < 200; i++) {
      const sourceEye = Math.random() > 0.5 ? 0 : 1;
      const ex = sourceEye === 0 ? lx : rx;
      // Tangential ejection from spinning disc
      const angle = rotationRef.current + Math.random() * Math.PI * 2;
      const dist = eyeR * (0.85 + Math.random() * 0.2);
      const speed = 60 + Math.random() * 100 + bp * 80;
      // Tangent direction (perpendicular to radius = angle + PI/2)
      const tangent = angle + Math.PI / 2;
      sp.push({
        x: ex + Math.cos(angle) * dist,
        y: faceY + Math.sin(angle) * dist,
        vx: Math.cos(tangent) * speed + Math.cos(angle) * speed * 0.3,
        vy: Math.sin(tangent) * speed + Math.sin(angle) * speed * 0.3 - 25,
        life: 1,
        maxLife: 0.5 + Math.random() * 0.7,
        size: (1 + Math.random() * 2.5) * dpr,
        hue: Math.random() * 360,
      });
    }

    // Update & draw
    for (let i = sp.length - 1; i >= 0; i--) {
      const p = sp[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 50 * dt; // gentle gravity
      p.vx *= 0.995; // air resistance
      p.life -= dt / p.maxLife;
      if (p.life <= 0) { sp.splice(i, 1); continue; }

      const alpha = p.life * p.life; // quadratic fade
      const sz = p.size * (0.5 + p.life * 0.5);

      ctx.beginPath();
      ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 85%, 72%, ${alpha * 0.85})`;
      ctx.fill();
    }
  }, [accentColor]);

  useVisualizerLoop(canvasRef, draw, [draw]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
