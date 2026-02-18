import { useRef, useEffect, useMemo } from 'react';
import { useStore } from '../../store';

// ── Helpers ─────────────────────────────────────────────────

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

function hslToRgbStr(h: number, s: number, l: number): string {
  h = ((h % 1) + 1) % 1;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return `${Math.round(f(0) * 255)}, ${Math.round(f(8) * 255)}, ${Math.round(f(4) * 255)}`;
}

/** Compress dynamic range with per-lane gain to compensate for spectral rolloff */
const LANE_GAIN = [1.5, 2.0, 3.0, 4.5, 6.0];
function boost(v: number, lane: number): number {
  return Math.min(1, Math.pow(v * LANE_GAIN[lane], 0.55));
}

// ── Classic Guitar Hero lane colors ─────────────────────────

// Iconic GH palette: green, red, yellow, blue, orange
const GH_COLORS = [
  '34, 197, 94',    // green
  '239, 68, 68',    // red
  '250, 204, 21',   // yellow
  '59, 130, 246',   // blue
  '249, 115, 22',   // orange
];

// ── Types ───────────────────────────────────────────────────

interface Note {
  lane: number;
  y: number;
  intensity: number;
  active: boolean;
  hitResult: '' | 'perfect' | 'great' | 'good' | 'miss';
  hitTime: number;
}

interface ScoreState {
  score: number;
  streak: number;
  longestStreak: number;
  combo: number;
  multiplier: number;
  starPower: number;
  lastHitText: string;
  lastHitTime: number;
}

interface MilestoneState {
  text: string;
  time: number;
}

interface LaneState {
  prevValue: number;
  lastSpikeTime: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

// ── Lane config ─────────────────────────────────────────────

const LANE_BINS: [number, number][] = [
  [0, 15], [16, 35], [36, 65], [66, 100], [101, 150],
];

const NUM_LANES = 5;
const STAR_COUNT = 100;
const STREAK_COUNT = 25;

interface Star { x: number; y: number; size: number; twinkleSpeed: number; twinkleOffset: number }
interface SpeedStreak { x: number; y: number; length: number; speed: number; side: number; brightness: number }

function createStars(count: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random(), y: Math.random() * 0.45,
    size: 0.5 + Math.random() * 1.5, twinkleSpeed: 0.3 + Math.random() * 0.8,
    twinkleOffset: Math.random() * Math.PI * 2,
  }));
}

function createStreaks(count: number): SpeedStreak[] {
  return Array.from({ length: count }, () => ({
    x: 0.15 + Math.random() * 0.35, y: Math.random(),
    length: 0.5 + Math.random() * 1, speed: 0.003 + Math.random() * 0.006,
    side: Math.random() < 0.5 ? -1 : 1, brightness: 0.2 + Math.random() * 0.4,
  }));
}

// Spotlight beam data (pre-computed angles & sweep speeds)
interface Spotlight { angle: number; sweepSpeed: number; sweepOffset: number; width: number; brightness: number }
function createSpotlights(): Spotlight[] {
  return [
    { angle: -0.4, sweepSpeed: 0.15, sweepOffset: 0, width: 0.14, brightness: 0.25 },
    { angle: 0.3, sweepSpeed: 0.11, sweepOffset: 2.1, width: 0.11, brightness: 0.20 },
    { angle: 0.1, sweepSpeed: 0.19, sweepOffset: 4.2, width: 0.16, brightness: 0.18 },
  ];
}

// ── Component ───────────────────────────────────────────────

export default function GuitarHero({ accentColor }: { accentColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioFeatures = useStore((s) => s.audioFeatures);
  const isBeat = useStore((s) => s.isBeat);
  const bpm = useStore((s) => s.bpm);
  const currentSong = useStore((s) => s.currentSong);

  const beatPulse = useRef(0);
  const gridScroll = useRef(0);
  const notesRef = useRef<Note[]>([]);
  const scoreRef = useRef<ScoreState>({
    score: 0, streak: 0, longestStreak: 0, combo: 0, multiplier: 1, starPower: 0,
    lastHitText: '', lastHitTime: 0,
  });
  const milestoneRef = useRef<MilestoneState>({ text: '', time: 0 });
  const prevMultiplierRef = useRef(1);
  const laneStates = useRef<LaneState[]>(
    Array.from({ length: NUM_LANES }, () => ({ prevValue: 0, lastSpikeTime: 0 })),
  );
  const particlesRef = useRef<Particle[]>([]);
  const laneFlash = useRef<number[]>(new Array(NUM_LANES).fill(0));
  const laneBeam = useRef<number[]>(new Array(NUM_LANES).fill(0));
  const smoothEnergy = useRef(0);
  const stars = useMemo(() => createStars(STAR_COUNT), []);
  const streaks = useRef(createStreaks(STREAK_COUNT));
  const spotlights = useMemo(() => createSpotlights(), []);

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
    scoreRef.current = { score: 0, streak: 0, longestStreak: 0, combo: 0, multiplier: 1, starPower: 0, lastHitText: '', lastHitTime: 0 };
    prevMultiplierRef.current = 1;
    notesRef.current = [];
    particlesRef.current = [];
    milestoneRef.current = { text: '', time: 0 };
    for (let i = 0; i < NUM_LANES; i++) { laneFlash.current[i] = 0; laneBeam.current[i] = 0; }
  }, [currentSong]);

  // Main render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioFeatures) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const dpr = devicePixelRatio;
    const now = performance.now();

    const [ar, ag, ab] = hexToRgb(accentColor);

    // Use classic GH colors
    const laneColors = GH_COLORS;

    const freq = audioFeatures.frequencyData;

    smoothEnergy.current += (audioFeatures.energy - smoothEnergy.current) * 0.08;
    const energy = smoothEnergy.current;

    beatPulse.current *= 0.88;
    const pulse = beatPulse.current;

    // ── Highway geometry ──
    const vanishY = height * 0.22;
    const vanishX = width * 0.5;
    const bottomY = height * 0.82;
    const floorY = height; // lane lines extend to screen bottom
    const laneSpread = width * 0.42;

    function getLaneX(lane: number, y01: number): number {
      const t = (lane - 2) / 2;
      const spreadAtY = laneSpread * (0.12 + 0.88 * y01);
      return vanishX + t * spreadAtY;
    }

    function getScale(y01: number): number {
      return 0.25 + 0.75 * y01;
    }

    function y01ToCanvas(y01: number): number {
      return vanishY + y01 * (bottomY - vanishY);
    }

    const y01Floor = (height - vanishY) / (bottomY - vanishY);

    const beatsPerSec = (bpm || 120) / 60;
    gridScroll.current += beatsPerSec * 0.012;

    // ── Note spawning ──
    for (let lane = 0; lane < NUM_LANES; lane++) {
      const [binStart, binEnd] = LANE_BINS[lane];
      let sum = 0;
      let count = 0;
      for (let b = binStart; b <= binEnd && b < freq.length; b++) {
        sum += freq[b] / 255;
        count++;
      }
      const raw = count > 0 ? sum / count : 0;
      const avg = boost(raw, lane);
      const ls = laneStates.current[lane];
      const delta = avg - ls.prevValue;
      ls.prevValue = avg;

      if (delta > 0.06 && avg > 0.15 && now - ls.lastSpikeTime > 180) {
        ls.lastSpikeTime = now;
        notesRef.current.push({ lane, y: 0, intensity: avg, active: true, hitResult: '', hitTime: 0 });
      }
    }

    if (notesRef.current.length > 100) notesRef.current = notesRef.current.slice(-100);

    // ── Note scrolling & hit detection ──
    const noteSpeed = beatsPerSec * 0.012;
    const score = scoreRef.current;
    const prevMult = prevMultiplierRef.current;

    for (const note of notesRef.current) {
      if (!note.active) continue;
      // Hit notes stop; missed notes keep scrolling past
      if (note.hitResult === '' || note.hitResult === 'miss') {
        note.y += noteSpeed;
      }

      if (note.y >= 0.97 && note.hitResult === '') {
        if (Math.random() > 0.07) {
          const closeness = 1 - Math.abs(note.y - 1.0);
          let text: string; let points: number;
          if (closeness > 0.98) { text = 'PERFECT!'; points = 100; note.hitResult = 'perfect'; }
          else if (closeness > 0.95) { text = 'GREAT!'; points = 75; note.hitResult = 'great'; }
          else { text = 'GOOD'; points = 50; note.hitResult = 'good'; }

          score.streak++;
          if (score.streak > score.longestStreak) score.longestStreak = score.streak;
          const newCombo = Math.floor(score.streak / 5);
          if (newCombo > score.combo) score.combo = newCombo;
          if (score.combo >= 12) score.multiplier = 4;
          else if (score.combo >= 8) score.multiplier = 3;
          else if (score.combo >= 4) score.multiplier = 2;
          else score.multiplier = 1;

          score.score += points * score.multiplier;
          score.lastHitText = text;
          score.lastHitTime = now;

          if (score.multiplier > prevMult) {
            milestoneRef.current = { text: `${score.multiplier}X MULTIPLIER!`, time: now };
            for (let lane = 0; lane < NUM_LANES; lane++) {
              const px = getLaneX(lane, 1.0);
              const py = y01ToCanvas(1.0);
              for (let p = 0; p < 10; p++) {
                const angle = (Math.PI * 2 * p) / 10 + Math.random() * 0.3;
                const spd = (5 + Math.random() * 7) * dpr;
                particlesRef.current.push({
                  x: px, y: py,
                  vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 5 * dpr,
                  life: 0, maxLife: 35 + Math.random() * 15, color: laneColors[lane],
                });
              }
            }
          }
          prevMultiplierRef.current = score.multiplier;

          if (score.streak > 10) score.starPower = Math.min(1, score.starPower + 0.01);

          const px = getLaneX(note.lane, 1.0);
          const py = y01ToCanvas(1.0);
          const col = laneColors[note.lane];
          for (let p = 0; p < 16; p++) {
            const angle = (Math.PI * 2 * p) / 16 + Math.random() * 0.3;
            const spd = (3 + Math.random() * 5) * dpr;
            particlesRef.current.push({
              x: px, y: py,
              vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 3 * dpr,
              life: 0, maxLife: 22 + Math.random() * 12, color: col,
            });
          }

          laneFlash.current[note.lane] = 1;
          laneBeam.current[note.lane] = 1;
        } else {
          note.hitResult = 'miss';
          score.streak = 0;
          score.combo = 0;
          score.multiplier = 1;
          prevMultiplierRef.current = 1;
          score.lastHitText = 'MISS';
          score.lastHitTime = now;
        }
        note.hitTime = now;
      }
    }

    notesRef.current = notesRef.current.filter((n) => {
      if (!n.active) return false;
      if (n.hitResult === '') return true; // still scrolling
      if (n.hitResult === 'miss') return n.y < y01Floor; // missed: keep until off-screen
      return now - n.hitTime < 300; // hit: fade out
    });

    if (particlesRef.current.length > 300) particlesRef.current = particlesRef.current.slice(-300);

    // ════════════════════════════════════════════════════════
    // DRAW
    // ════════════════════════════════════════════════════════

    // ── 1. Background ──
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#08050f');
    bgGrad.addColorStop(0.35, '#100818');
    bgGrad.addColorStop(0.7, '#0c0612');
    bgGrad.addColorStop(1, '#06030a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // ── 1b. Stage spotlights ──
    const timeSec = now / 1000;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const spot of spotlights) {
      const sweep = Math.sin(timeSec * spot.sweepSpeed + spot.sweepOffset);
      const angle = spot.angle + sweep * 0.35;
      const originX = vanishX + sweep * width * 0.15;
      const originY = 0;
      const beamLen = height * 0.85;
      const halfW = spot.width * width;

      const endX = originX + Math.sin(angle) * beamLen;
      const endY = originY + Math.cos(angle) * beamLen;

      // Determine color from accent with hue shift
      const spotCol = hslToRgbStr(
        ((ar / 255) * 0.3 + (spot.sweepOffset / 6)),
        0.6, 0.6,
      );
      const brt = spot.brightness * (1.2 + energy * 1.6 + pulse * 0.8);

      ctx.beginPath();
      ctx.moveTo(originX - 3 * dpr, originY);
      ctx.lineTo(endX - halfW, endY);
      ctx.lineTo(endX + halfW, endY);
      ctx.lineTo(originX + 3 * dpr, originY);
      ctx.closePath();

      const spotGrad = ctx.createLinearGradient(originX, originY, endX, endY);
      spotGrad.addColorStop(0, `rgba(${spotCol}, ${brt})`);
      spotGrad.addColorStop(0.5, `rgba(${spotCol}, ${brt * 0.3})`);
      spotGrad.addColorStop(1, `rgba(${spotCol}, 0)`);
      ctx.fillStyle = spotGrad;
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // ── 1c. Stars ──
    for (const star of stars) {
      const twinkle = 0.3 + 0.7 * Math.sin(timeSec * star.twinkleSpeed + star.twinkleOffset);
      const bright = twinkle * (0.8 + energy * 0.5 + pulse * 0.5);
      const sz = star.size * dpr * (0.8 + pulse * 0.25);
      ctx.beginPath();
      ctx.arc(star.x * width, star.y * height, sz, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, bright)})`;
      ctx.fill();
    }

    // ── 1d. Speed streaks ──
    const streakSpeedMult = 1 + energy * 2 + pulse * 1.5;
    for (const streak of streaks.current) {
      streak.y += streak.speed * streakSpeedMult;
      if (streak.y > 1) {
        streak.y -= 1;
        streak.x = 0.15 + Math.random() * 0.35;
        streak.brightness = 0.2 + Math.random() * 0.4;
      }
      const sx = streak.side === -1
        ? width * (0.5 - streak.x * 0.5 - 0.1)
        : width * (0.5 + streak.x * 0.5 + 0.1);
      const sy = streak.y * height;
      const sLen = streak.length * 30 * dpr * streakSpeedMult;
      const alpha = streak.brightness * (0.5 + energy * 0.8);

      const sGrad = ctx.createLinearGradient(sx, sy - sLen, sx, sy);
      sGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      sGrad.addColorStop(1, `rgba(255, 255, 255, ${alpha})`);
      ctx.strokeStyle = sGrad;
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.moveTo(sx, sy - sLen);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }

    // ── 1e. Stage wash lights (colored pools on back wall) ──
    const washLights = [
      { x: 0.12, y: 0.18, hOff: 0, speed: 0.13, phase: 0 },
      { x: 0.88, y: 0.20, hOff: 0.25, speed: 0.17, phase: 1.5 },
      { x: 0.35, y: 0.10, hOff: 0.5, speed: 0.09, phase: 3.0 },
      { x: 0.65, y: 0.12, hOff: 0.75, speed: 0.11, phase: 4.5 },
    ];
    for (const wash of washLights) {
      const wobbleX = Math.sin(timeSec * wash.speed + wash.phase) * 0.04;
      const wobbleY = Math.cos(timeSec * wash.speed * 0.7 + wash.phase) * 0.02;
      const wx = (wash.x + wobbleX) * width;
      const wy = (wash.y + wobbleY) * height;
      const wr = height * 0.2;
      const washCol = hslToRgbStr(wash.hOff + timeSec * 0.01, 0.9, 0.6);
      const washA = 0.1 + energy * 0.15 + pulse * 0.1;
      const wGrad = ctx.createRadialGradient(wx, wy, 0, wx, wy, wr);
      wGrad.addColorStop(0, `rgba(${washCol}, ${washA})`);
      wGrad.addColorStop(0.6, `rgba(${washCol}, ${washA * 0.3})`);
      wGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = wGrad;
      ctx.fillRect(wx - wr, wy - wr, wr * 2, wr * 2);
    }

    // ── 1f. Speaker stacks (flanking the highway) ──
    const hwLeftEdge = getLaneX(-0.5, 0.6);
    const hwRightEdge = getLaneX(NUM_LANES - 0.5, 0.6);
    const speakerAlpha = 0.6 + energy * 0.25;

    // Draw speaker stack helper
    const drawSpeakerStack = (sx: number, sy: number, sw: number, sh: number, flip: boolean) => {
      // Cabinet body
      ctx.fillStyle = `rgba(18, 14, 24, ${speakerAlpha})`;
      ctx.fillRect(sx, sy, sw, sh);

      // Speaker cones (circles)
      const coneCount = Math.floor(sh / (sw * 0.55));
      const coneR = sw * 0.32;
      for (let c = 0; c < coneCount; c++) {
        const cy = sy + sw * 0.45 + c * (sh / coneCount);
        const cx = sx + sw * 0.5;
        // Outer ring
        ctx.beginPath();
        ctx.arc(cx, cy, coneR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(10, 8, 15, ${speakerAlpha})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(100, 80, 110, ${speakerAlpha * 0.7})`;
        ctx.lineWidth = 1 * dpr;
        ctx.stroke();
        // Inner cone
        ctx.beginPath();
        ctx.arc(cx, cy, coneR * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(30, 25, 40, ${speakerAlpha})`;
        ctx.fill();
        // Cone pulse glow on beat
        if (pulse > 0.1) {
          const cGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, coneR * 1.5);
          cGlow.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, ${pulse * 0.2})`);
          cGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = cGlow;
          ctx.beginPath();
          ctx.arc(cx, cy, coneR * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    // Left speaker stack (2 cabinets stacked)
    const spW = width * 0.06;
    const spH = height * 0.22;
    const spLX = hwLeftEdge - spW - width * 0.04;
    const spLY = height * 0.35;
    drawSpeakerStack(spLX, spLY, spW, spH, false);
    drawSpeakerStack(spLX, spLY + spH + 4 * dpr, spW, spH * 0.8, false);

    // Right speaker stack
    const spRX = hwRightEdge + width * 0.04;
    drawSpeakerStack(spRX, spLY, spW, spH, true);
    drawSpeakerStack(spRX, spLY + spH + 4 * dpr, spW, spH * 0.8, true);

    // ── 1h. Spotlight lens flares (where beams originate) ──
    for (const spot of spotlights) {
      const sweep = Math.sin(timeSec * spot.sweepSpeed + spot.sweepOffset);
      const originX = vanishX + sweep * width * 0.15;
      const flareBrt = spot.brightness * (1.0 + energy * 1.2 + pulse * 1.0);
      const flareR = 16 * dpr;

      // Core flare
      const flare = ctx.createRadialGradient(originX, 0, 0, originX, 0, flareR * 3);
      flare.addColorStop(0, `rgba(255, 255, 255, ${flareBrt * 0.5})`);
      flare.addColorStop(0.3, `rgba(255, 255, 220, ${flareBrt * 0.2})`);
      flare.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = flare;
      ctx.beginPath();
      ctx.arc(originX, 2 * dpr, flareR * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── 1i. Haze / fog layer ──
    const hazeA = 0.04 + energy * 0.06 + pulse * 0.04;
    const hazeGrad = ctx.createLinearGradient(0, height * 0.15, 0, height * 0.5);
    hazeGrad.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, ${hazeA * 0.3})`);
    hazeGrad.addColorStop(0.5, `rgba(200, 200, 220, ${hazeA})`);
    hazeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = hazeGrad;
    ctx.fillRect(0, height * 0.15, width, height * 0.35);

    // ── 1k. Ambient side glow ──
    const glowI = 0.08 + energy * 0.22 + pulse * 0.15;
    const lGlow = ctx.createRadialGradient(0, height * 0.55, 0, 0, height * 0.55, width * 0.35);
    lGlow.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, ${glowI})`);
    lGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = lGlow;
    ctx.fillRect(0, 0, width * 0.5, height);

    const rGlow = ctx.createRadialGradient(width, height * 0.55, 0, width, height * 0.55, width * 0.35);
    rGlow.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, ${glowI})`);
    rGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rGlow;
    ctx.fillRect(width * 0.5, 0, width * 0.5, height);

    // ── 2. Highway surface (dark fretboard) ──
    ctx.beginPath();
    ctx.moveTo(getLaneX(-0.5, 0), y01ToCanvas(0));
    ctx.lineTo(getLaneX(NUM_LANES - 0.5, 0), y01ToCanvas(0));
    ctx.lineTo(getLaneX(NUM_LANES - 0.5, y01Floor), floorY);
    ctx.lineTo(getLaneX(-0.5, y01Floor), floorY);
    ctx.closePath();
    const hwGrad = ctx.createLinearGradient(0, y01ToCanvas(0), 0, y01ToCanvas(1));
    hwGrad.addColorStop(0, 'rgba(15, 10, 25, 0.7)');
    hwGrad.addColorStop(1, 'rgba(20, 12, 30, 0.85)');
    ctx.fillStyle = hwGrad;
    ctx.fill();

    // Lane divider lines
    for (let i = 0; i <= NUM_LANES; i++) {
      const laneIdx = i - 0.5;
      const topX = getLaneX(laneIdx, 0);
      const botX = getLaneX(laneIdx, y01Floor);

      let flashA = 0;
      if (i > 0) flashA = Math.max(flashA, laneFlash.current[i - 1]);
      if (i < NUM_LANES) flashA = Math.max(flashA, laneFlash.current[i]);

      const baseA = 0.2 + pulse * 0.1;
      if (flashA > 0.01) {
        const fl = i > 0 && laneFlash.current[i - 1] > (i < NUM_LANES ? laneFlash.current[i] : 0) ? i - 1 : Math.min(i, NUM_LANES - 1);
        ctx.strokeStyle = `rgba(${laneColors[fl]}, ${baseA + flashA * 0.6})`;
        ctx.shadowColor = `rgba(${laneColors[fl]}, 0.6)`;
        ctx.shadowBlur = 10 * dpr * flashA;
      } else {
        ctx.strokeStyle = `rgba(255, 255, 255, ${baseA})`;
        ctx.shadowBlur = 0;
      }

      ctx.lineWidth = (i === 0 || i === NUM_LANES ? 2.5 : 1.5) * dpr;
      ctx.beginPath();
      ctx.moveTo(topX, y01ToCanvas(0));
      ctx.lineTo(botX, floorY);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // ── 3. Beat markers ──
    ctx.lineWidth = 1 * dpr;
    for (let i = 0; i < 16; i++) {
      const mt = ((i / 16) + gridScroll.current) % 1;
      const canvasY = y01ToCanvas(mt);
      const alpha = 0.05 + 0.1 * mt;
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(getLaneX(-0.5, mt), canvasY);
      ctx.lineTo(getLaneX(NUM_LANES - 0.5, mt), canvasY);
      ctx.stroke();
    }

    // ── 4. Notes ──
    for (const note of notesRef.current) {
      if (note.hitResult !== '' && note.hitResult !== 'miss' && now - note.hitTime > 250) continue;
      if (note.y > y01Floor) continue;

      const y01 = note.y;
      const canvasY = y01ToCanvas(y01);
      const cx = getLaneX(note.lane, y01);
      const scale = getScale(y01);
      const baseR = 24 * dpr * scale;
      const radius = baseR * (0.85 + note.intensity * 0.35);
      const col = laneColors[note.lane];

      let alpha = 1;
      let extraS = 1;
      if (note.hitResult !== '' && note.hitResult !== 'miss') {
        const el = now - note.hitTime;
        alpha = 1 - el / 250;
        extraS = 1 + el / 200;
      } else if (note.hitResult === 'miss') {
        // Fade out as it scrolls past strikeline toward bottom
        const pastStrike = Math.max(0, note.y - 1.0) / (y01Floor - 1.0);
        alpha = 1 - pastStrike;
      }
      if (alpha <= 0) continue;

      // Trail
      if (note.hitResult === '') {
        const trailLen = 0.14;
        for (let s = 1; s <= 8; s++) {
          const ty = Math.max(0, y01 - (s / 8) * trailLen);
          const tcy = y01ToCanvas(ty);
          const tcx = getLaneX(note.lane, ty);
          const ts = getScale(ty);
          const tr = baseR * ts / scale * 0.5 * (1 - s / 8);
          ctx.fillStyle = `rgba(${col}, ${(1 - s / 8) * 0.25})`;
          ctx.beginPath();
          ctx.arc(tcx, tcy, Math.max(1, tr), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const r = radius * extraS;

      // Glow halo
      const glow = ctx.createRadialGradient(cx, canvasY, r * 0.2, cx, canvasY, r * 2.5);
      glow.addColorStop(0, `rgba(${col}, ${0.5 * alpha})`);
      glow.addColorStop(1, `rgba(${col}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, canvasY, r * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Gem body (bright center, saturated ring)
      const gem = ctx.createRadialGradient(cx, canvasY - r * 0.2, 0, cx, canvasY, r);
      gem.addColorStop(0, `rgba(255, 255, 255, ${0.95 * alpha})`);
      gem.addColorStop(0.25, `rgba(${col}, ${0.9 * alpha})`);
      gem.addColorStop(0.7, `rgba(${col}, ${0.7 * alpha})`);
      gem.addColorStop(1, `rgba(${col}, ${0.2 * alpha})`);
      ctx.fillStyle = gem;
      ctx.beginPath();
      ctx.arc(cx, canvasY, r, 0, Math.PI * 2);
      ctx.fill();

      // Outer ring
      ctx.strokeStyle = `rgba(${col}, ${0.8 * alpha})`;
      ctx.lineWidth = 2.5 * dpr * scale;
      ctx.beginPath();
      ctx.arc(cx, canvasY, r * 0.9, 0, Math.PI * 2);
      ctx.stroke();

      // Specular highlight
      ctx.fillStyle = `rgba(255, 255, 255, ${0.35 * alpha})`;
      ctx.beginPath();
      ctx.ellipse(cx, canvasY - r * 0.3, r * 0.35, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── 5. Strikeline ──
    const strikeY = y01ToCanvas(1.0);

    // ── 5a. Hit beams (laser columns shooting up) ──
    for (let lane = 0; lane < NUM_LANES; lane++) {
      const beam = laneBeam.current[lane];
      if (beam < 0.02) continue;

      const cx = getLaneX(lane, 1.0);
      const col = laneColors[lane];
      const beamH = height * 0.5 * beam;
      const beamW = 10 * dpr * beam;

      // Core beam
      const bGrad = ctx.createLinearGradient(cx, strikeY, cx, strikeY - beamH);
      bGrad.addColorStop(0, `rgba(${col}, ${beam * 0.7})`);
      bGrad.addColorStop(0.3, `rgba(${col}, ${beam * 0.4})`);
      bGrad.addColorStop(1, `rgba(${col}, 0)`);
      ctx.fillStyle = bGrad;
      ctx.fillRect(cx - beamW, strikeY - beamH, beamW * 2, beamH);

      // Bright center line
      const cGrad = ctx.createLinearGradient(cx, strikeY, cx, strikeY - beamH * 0.7);
      cGrad.addColorStop(0, `rgba(255, 255, 255, ${beam * 0.6})`);
      cGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = cGrad;
      ctx.fillRect(cx - beamW * 0.3, strikeY - beamH * 0.7, beamW * 0.6, beamH * 0.7);

      // Wide glow behind beam
      const wGlow = ctx.createRadialGradient(cx, strikeY, 0, cx, strikeY - beamH * 0.3, beamW * 6);
      wGlow.addColorStop(0, `rgba(${col}, ${beam * 0.15})`);
      wGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = wGlow;
      ctx.fillRect(cx - beamW * 6, strikeY - beamH * 0.6, beamW * 12, beamH * 0.6);
    }

    // ── 5b. Combo flames ──
    const comboHeat = Math.min(1, score.streak / 50);
    if (score.streak >= 10) {
      for (let lane = 0; lane < NUM_LANES; lane++) {
        const cx = getLaneX(lane, 1.0);
        const col = laneColors[lane];
        const flicker = 0.65 + 0.35 * Math.sin(now * 0.015 + lane * 1.8) * Math.sin(now * 0.023 + lane * 0.7);
        const flameH = (50 + comboHeat * 120) * dpr * flicker;
        const flameW = (22 + comboHeat * 18) * dpr;

        const outerF = ctx.createRadialGradient(cx, strikeY, 0, cx, strikeY - flameH * 0.3, flameW * 1.8);
        outerF.addColorStop(0, `rgba(${col}, ${comboHeat * 0.3})`);
        outerF.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = outerF;
        ctx.fillRect(cx - flameW * 2.5, strikeY - flameH * 1.5, flameW * 5, flameH * 1.5);

        const flame = ctx.createLinearGradient(cx, strikeY, cx, strikeY - flameH);
        flame.addColorStop(0, `rgba(255, 255, 220, ${comboHeat * 0.6})`);
        flame.addColorStop(0.15, `rgba(255, 140, 30, ${comboHeat * 0.5})`);
        flame.addColorStop(0.4, `rgba(${col}, ${comboHeat * 0.3})`);
        flame.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = flame;
        ctx.beginPath();
        ctx.ellipse(cx, strikeY, flameW, flameH, 0, Math.PI, 0);
        ctx.fill();
      }
    }

    // Strikeline bar
    const slL = getLaneX(-0.5, 1.0);
    const slR = getLaneX(NUM_LANES - 0.5, 1.0);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.05 + pulse * 0.04})`;
    ctx.fillRect(slL, strikeY - 4 * dpr, slR - slL, 8 * dpr);

    // ── 5c. Fret buttons (big, bold, 3D-look) ──
    for (let lane = 0; lane < NUM_LANES; lane++) {
      const cx = getLaneX(lane, 1.0);
      const col = laneColors[lane];
      const flash = laneFlash.current[lane];
      const targetR = 18 * dpr * (1 + pulse * 0.12);

      // Outer glow on hit
      if (flash > 0.02) {
        const hGlow = ctx.createRadialGradient(cx, strikeY, targetR, cx, strikeY, targetR * 4);
        hGlow.addColorStop(0, `rgba(${col}, ${flash * 0.5})`);
        hGlow.addColorStop(1, `rgba(${col}, 0)`);
        ctx.fillStyle = hGlow;
        ctx.beginPath();
        ctx.arc(cx, strikeY, targetR * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dark base disc
      ctx.fillStyle = `rgba(20, 15, 30, ${0.7 + flash * 0.2})`;
      ctx.beginPath();
      ctx.arc(cx, strikeY, targetR, 0, Math.PI * 2);
      ctx.fill();

      // Colored ring (thick)
      ctx.strokeStyle = `rgba(${col}, ${0.5 + flash * 0.4 + pulse * 0.1})`;
      ctx.lineWidth = 3.5 * dpr;
      ctx.beginPath();
      ctx.arc(cx, strikeY, targetR * 0.85, 0, Math.PI * 2);
      ctx.stroke();

      // Inner colored fill (lights up on hit)
      const innerA = 0.1 + flash * 0.6;
      const inner = ctx.createRadialGradient(cx, strikeY - targetR * 0.15, 0, cx, strikeY, targetR * 0.65);
      inner.addColorStop(0, `rgba(${col}, ${innerA * 1.2})`);
      inner.addColorStop(1, `rgba(${col}, ${innerA * 0.3})`);
      ctx.fillStyle = inner;
      ctx.beginPath();
      ctx.arc(cx, strikeY, targetR * 0.65, 0, Math.PI * 2);
      ctx.fill();

      // Specular highlight on button
      ctx.fillStyle = `rgba(255, 255, 255, ${0.08 + flash * 0.15})`;
      ctx.beginPath();
      ctx.ellipse(cx, strikeY - targetR * 0.25, targetR * 0.35, targetR * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Decay flashes & beams
    for (let i = 0; i < NUM_LANES; i++) {
      laneFlash.current[i] *= 0.86;
      laneBeam.current[i] *= 0.92;
    }

    // ── 6. Particles ──
    particlesRef.current = particlesRef.current.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15 * dpr;
      p.life++;
      if (p.life >= p.maxLife) return false;
      const a = 1 - p.life / p.maxLife;
      const sz = (2.5 + (1 - p.life / p.maxLife) * 3.5) * dpr;
      ctx.fillStyle = `rgba(${p.color}, ${a * 0.85})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });

    // ── 7. UI Overlay ──

    // Score
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${42 * dpr}px monospace`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8 * dpr;
    ctx.fillText(score.score.toLocaleString(), width - 24 * dpr, 120 * dpr);

    // Streak
    if (score.streak > 1) {
      ctx.font = `bold ${18 * dpr}px monospace`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(`${score.streak} NOTE STREAK`, width - 24 * dpr, 168 * dpr);
    }

    // Combo & multiplier
    if (score.combo > 0) {
      ctx.font = `bold ${22 * dpr}px monospace`;
      ctx.fillStyle = `rgba(${laneColors[Math.min(score.multiplier - 1, 4)]}, 0.95)`;
      ctx.fillText(`${score.combo}x COMBO`, width - 24 * dpr, 194 * dpr);

      if (score.multiplier > 1) {
        ctx.font = `bold ${16 * dpr}px monospace`;
        ctx.fillStyle = 'rgba(255, 255, 100, 0.9)';
        ctx.fillText(`${score.multiplier}x MULTIPLIER`, width - 24 * dpr, 222 * dpr);
      }
    }

    // Longest streak (below score/combo area)
    if (score.longestStreak > 1) {
      ctx.font = `bold ${18 * dpr}px monospace`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillText(`LONG STREAK: ${score.longestStreak} NOTES`, width - 24 * dpr, 252 * dpr);
    }
    ctx.shadowBlur = 0;

    // Star power bar
    const bX = 20 * dpr, bY = 153 * dpr, bW = 260 * dpr, bH = 24 * dpr;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(bX, bY, bW, bH);
    if (score.starPower > 0) {
      const sp = ctx.createLinearGradient(bX, bY, bX + bW * score.starPower, bY);
      sp.addColorStop(0, 'rgba(60, 130, 255, 0.85)');
      sp.addColorStop(0.5, 'rgba(60, 220, 255, 0.85)');
      sp.addColorStop(1, 'rgba(255, 255, 100, 0.95)');
      ctx.fillStyle = sp;
      ctx.fillRect(bX, bY, bW * score.starPower, bH);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5 * dpr;
    ctx.strokeRect(bX, bY, bW, bH);
    ctx.textAlign = 'left';
    ctx.font = `bold ${14 * dpr}px monospace`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText('STAR POWER', bX, bY + bH + 7 * dpr);

    // Milestone
    const ms = milestoneRef.current;
    if (ms.text && now - ms.time < 1200) {
      const el = now - ms.time;
      const prog = el / 1200;
      let mA: number, mS: number;
      if (prog < 0.15) { mA = prog / 0.15; mS = 0.5 + 0.5 * (prog / 0.15); }
      else if (prog < 0.6) { mA = 1; mS = 1; }
      else { mA = 1 - (prog - 0.6) / 0.4; mS = 1 + (prog - 0.6) * 0.3; }

      const mY = height * 0.38 - (prog > 0.6 ? (prog - 0.6) * 40 * dpr : 0);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.round(50 * dpr * mS)}px monospace`;
      ctx.shadowColor = `rgba(255, 200, 50, 0.8)`;
      ctx.shadowBlur = 25 * dpr * mA;
      ctx.fillStyle = `rgba(255, 255, 100, ${mA})`;
      ctx.fillText(ms.text, vanishX, mY);
      ctx.shadowBlur = 0;
      ctx.restore();

      if (el < 150) {
        ctx.fillStyle = `rgba(255, 255, 200, ${(1 - el / 150) * 0.15})`;
        ctx.fillRect(0, 0, width, height);
      }
    }

    // Hit text
    if (score.lastHitText && now - score.lastHitTime < 500) {
      const el = now - score.lastHitTime;
      const prog = el / 500;
      const tA = 1 - prog;
      const tS = 1 + prog * 0.3;
      const tY = strikeY - 70 * dpr - prog * 35 * dpr;

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.round(30 * dpr * tS)}px monospace`;

      let tc: string;
      if (score.lastHitText === 'MISS') tc = `rgba(255, 70, 70, ${tA})`;
      else if (score.lastHitText === 'PERFECT!') tc = `rgba(255, 255, 80, ${tA})`;
      else if (score.lastHitText === 'GREAT!') tc = `rgba(80, 255, 140, ${tA})`;
      else tc = `rgba(140, 200, 255, ${tA})`;

      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 8 * dpr;
      ctx.fillStyle = tc;
      ctx.fillText(score.lastHitText, vanishX, tY);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }, [audioFeatures, accentColor, isBeat, bpm, stars, spotlights]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
