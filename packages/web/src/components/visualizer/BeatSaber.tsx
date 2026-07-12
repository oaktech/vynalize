import { useRef, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import { getVisDpr, applyGlow, clearGlow, useVisualizerLoop, audioRef } from '../../utils/perfConfig';

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

// ── Constants ───────────────────────────────────────────────

const NUM_COLS = 4;
const NUM_ROWS = 3;
const COL_GAIN = [1.5, 2.0, 3.0, 4.0];
const COL_BINS: [number, number][] = [
  [0, 20], [15, 50], [40, 90], [70, 140],
];

const RED_RGB: [number, number, number] = [220, 50, 50];
const BLUE_RGB: [number, number, number] = [50, 120, 255];

// Clears the app shell's top bar (song info / buttons), which overlays
// the canvas — without this the score sits directly behind it.
const TOP_HUD_Y = 100;

const ARROW_DIRS = [
  [0, -1],  // up
  [0, 1],   // down
  [-1, 0],  // left
  [1, 0],   // right
];

// 3D world
const CAMERA_Y = 1.5;
const FOCAL_LENGTH = 5.0;
const SPAWN_Z = 55;
const HIT_Z = 3.0;
const DESPAWN_Z = 1.0;
const BLOCK_SIZE = 0.8;
const BLOCK_HALF = BLOCK_SIZE / 2;
const CORRIDOR_X = 2.5;
const FLOOR_Y = 0;
const CEILING_Y = 3.5;
const FOG_START = 25;
const FOG_END = 55;
const GRID_SPACING = 1.8;
const GRID_LINES = 30;
const LONG_LINES = 9;
const ARCH_SPACING = 5.5;
const ARCH_COUNT = 10;

// Cube face corner indices
const FACE_FRONT = [0, 1, 2, 3] as const;
const FACE_TOP = [3, 2, 6, 7] as const;
const FACE_BOT = [4, 5, 1, 0] as const;
const FACE_LEFT = [4, 0, 3, 7] as const;
const FACE_RIGHT = [1, 5, 6, 2] as const;

const SHADE_FRONT = 1.0;
const SHADE_TOP = 0.7;
const SHADE_BOT = 0.35;
const SHADE_SIDE = 0.45;

function colToX(col: number): number { return col - 1.5; }
function rowToY(row: number): number { return row + 0.5; }

function boost(v: number, col: number): number {
  return Math.min(1, Math.pow(v * COL_GAIN[col], 0.55));
}

function fogAlpha(wz: number): number {
  if (wz <= FOG_START) return 1;
  if (wz >= FOG_END) return 0;
  return 1 - (wz - FOG_START) / (FOG_END - FOG_START);
}

// ── Types ───────────────────────────────────────────────────

interface Block {
  col: number;
  row: number;
  worldX: number;
  worldY: number;
  worldZ: number;
  side: 'red' | 'blue';
  direction: number;
  intensity: number;
  active: boolean;
  hitResult: '' | 'perfect' | 'great' | 'good' | 'miss';
  hitTime: number;
}

interface SliceHalf {
  wx: number; wy: number; wz: number;
  vx: number; vy: number; vz: number;
  rotation: number;
  rotSpeed: number;
  life: number;
  maxLife: number;
  side: 'red' | 'blue';
  size: number;
}

interface Particle {
  wx: number; wy: number; wz: number;
  vx: number; vy: number; vz: number;
  life: number;
  maxLife: number;
  r: number; g: number; b: number;
  size: number;
  glow: boolean;
}

interface ScoreState {
  score: number;
  streak: number;
  combo: number;
  multiplier: number;
  energy: number;
  lastHitText: string;
  lastHitTime: number;
}

interface MilestoneState {
  text: string;
  time: number;
}

interface SaberSwing {
  progress: number;     // 0 = idle, 0→1 = swinging out, 1→2 = returning
  targetX: number;      // screen-space target of the swing
  targetY: number;
  direction: number;    // block's arrow direction (for swing arc)
}

interface ColState {
  prevValue: number;
  lastSpikeTime: number;
}

// ── Component ───────────────────────────────────────────────

export default function BeatSaber({ accentColor }: { accentColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentSong = useStore((s) => s.currentSong);

  const beatPulse = useRef(0);
  const prevBeat = useRef(false);
  const gridScroll = useRef(0);
  const blocksRef = useRef<Block[]>([]);
  const slicesRef = useRef<SliceHalf[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const scoreRef = useRef<ScoreState>({
    score: 0, streak: 0, combo: 0, multiplier: 1, energy: 0.5,
    lastHitText: '', lastHitTime: 0,
  });
  const milestoneRef = useRef<MilestoneState>({ text: '', time: 0 });
  const prevMultiplierRef = useRef(1);
  const colStates = useRef<ColState[]>(
    Array.from({ length: NUM_COLS }, () => ({ prevValue: 0, lastSpikeTime: 0 })),
  );
  const saberFlashL = useRef(0);
  const saberFlashR = useRef(0);
  const saberSwingL = useRef<SaberSwing>({ progress: 0, targetX: 0, targetY: 0, direction: 0 });
  const saberSwingR = useRef<SaberSwing>({ progress: 0, targetX: 0, targetY: 0, direction: 0 });
  // Trail: ring buffer of recent tip positions [x, y, alpha] for each saber
  const TRAIL_LEN = 10;
  const trailL = useRef<Array<[number, number, number]>>([]);
  const trailR = useRef<Array<[number, number, number]>>([]);
  const smoothEnergy = useRef(0);
  const projBuf = useRef(new Float64Array(16));

  // Resize
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

  // Reset on song change
  useEffect(() => {
    scoreRef.current = {
      score: 0, streak: 0, combo: 0, multiplier: 1, energy: 0.5,
      lastHitText: '', lastHitTime: 0,
    };
    prevMultiplierRef.current = 1;
    blocksRef.current = [];
    slicesRef.current = [];
    particlesRef.current = [];
    milestoneRef.current = { text: '', time: 0 };
    saberFlashL.current = 0;
    saberFlashR.current = 0;
  }, [currentSong]);

  // Main render
  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const audioFeatures = audioRef.features;
    if (!audioFeatures) return;

    // Beat detection from shared ref
    if (audioRef.isBeat && !prevBeat.current) beatPulse.current = 1;
    prevBeat.current = audioRef.isBeat;

    const dpr = getVisDpr();
    const now = performance.now();
    const timeSec = now / 1000;

    const [ar, ag, ab] = hexToRgb(accentColor);
    const accentStr = `${ar}, ${ag}, ${ab}`;

    const freq = audioFeatures.frequencyData;

    smoothEnergy.current += (audioFeatures.energy - smoothEnergy.current) * 0.08;
    const energy = smoothEnergy.current;

    beatPulse.current *= 0.88;
    const pulse = beatPulse.current;

    const beatsPerSec = (audioRef.bpm || 120) / 60;
    const blockSpeed = beatsPerSec * 0.3;

    // ── Projection ──────────────────────────────────────────

    const centerX = width * 0.5;
    const centerY = height * 0.45;
    const pixelScale = width * 0.18;

    function project(wx: number, wy: number, wz: number): [number, number] | null {
      if (wz < 0.5) return null;
      const scale = (FOCAL_LENGTH / wz) * pixelScale;
      return [
        centerX + wx * scale,
        centerY - (wy - CAMERA_Y) * scale,
      ];
    }

    function projectCube(wx: number, wy: number, wz: number): boolean {
      const h = BLOCK_HALF;
      const buf = projBuf.current;
      const xs = [wx - h, wx + h, wx + h, wx - h, wx - h, wx + h, wx + h, wx - h];
      const ys = [wy - h, wy - h, wy + h, wy + h, wy - h, wy - h, wy + h, wy + h];
      const zs = [wz - h, wz - h, wz - h, wz - h, wz + h, wz + h, wz + h, wz + h];
      for (let i = 0; i < 8; i++) {
        if (zs[i] < 0.5) return false;
        const scale = (FOCAL_LENGTH / zs[i]) * pixelScale;
        buf[i * 2] = centerX + xs[i] * scale;
        buf[i * 2 + 1] = centerY - (ys[i] - CAMERA_Y) * scale;
      }
      return true;
    }

    function drawFace(
      indices: readonly number[],
      r: number, g: number, b: number,
      shade: number, alpha: number,
    ) {
      const buf = projBuf.current;
      ctx.beginPath();
      ctx.moveTo(buf[indices[0] * 2], buf[indices[0] * 2 + 1]);
      for (let i = 1; i < indices.length; i++) {
        ctx.lineTo(buf[indices[i] * 2], buf[indices[i] * 2 + 1]);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(${(r * shade) | 0}, ${(g * shade) | 0}, ${(b * shade) | 0}, ${alpha})`;
      ctx.fill();
    }

    function strokeFace(indices: readonly number[], color: string, lw: number) {
      const buf = projBuf.current;
      ctx.beginPath();
      ctx.moveTo(buf[indices[0] * 2], buf[indices[0] * 2 + 1]);
      for (let i = 1; i < indices.length; i++) {
        ctx.lineTo(buf[indices[i] * 2], buf[indices[i] * 2 + 1]);
      }
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.stroke();
    }

    // ── Grid scroll ─────────────────────────────────────────

    gridScroll.current += blockSpeed;

    // ── Block spawning ──────────────────────────────────────

    const midEnergy = audioFeatures.mid;
    const highEnergy = audioFeatures.high;

    for (let col = 0; col < NUM_COLS; col++) {
      const [binStart, binEnd] = COL_BINS[col];
      let sum = 0;
      let count = 0;
      for (let b = binStart; b <= binEnd && b < freq.length; b++) {
        sum += freq[b] / 255;
        count++;
      }
      const raw = count > 0 ? sum / count : 0;
      const avg = boost(raw, col);
      const cs = colStates.current[col];
      const delta = avg - cs.prevValue;
      cs.prevValue = avg;

      if (delta > 0.07 && avg > 0.18 && now - cs.lastSpikeTime > 200) {
        cs.lastSpikeTime = now;

        let side: 'red' | 'blue' = col < 2 ? 'red' : 'blue';
        if (Math.random() < 0.2) side = side === 'red' ? 'blue' : 'red';

        let row = 0;
        if (midEnergy > 0.5) row = Math.random() < 0.6 ? 2 : 1;
        else if (midEnergy > 0.25) row = Math.random() < 0.5 ? 1 : 0;

        let direction: number;
        if (highEnergy > 0.4 && Math.random() < 0.4) {
          direction = Math.random() < 0.5 ? 2 : 3;
        } else {
          direction = Math.random() < 0.6 ? 0 : 1;
        }

        blocksRef.current.push({
          col, row,
          worldX: colToX(col), worldY: rowToY(row), worldZ: SPAWN_Z,
          side, direction, intensity: avg,
          active: true, hitResult: '', hitTime: 0,
        });
      }
    }

    // Beat bonus paired blocks
    if (audioRef.isBeat && pulse > 0.8 && blocksRef.current.length < 70) {
      const leftCol = Math.floor(Math.random() * 2);
      const rightCol = 2 + Math.floor(Math.random() * 2);
      const row = Math.floor(Math.random() * NUM_ROWS);
      blocksRef.current.push(
        {
          col: leftCol, row,
          worldX: colToX(leftCol), worldY: rowToY(row), worldZ: SPAWN_Z,
          side: 'red', direction: Math.random() < 0.5 ? 0 : 1,
          intensity: 0.8, active: true, hitResult: '', hitTime: 0,
        },
        {
          col: rightCol, row,
          worldX: colToX(rightCol), worldY: rowToY(row), worldZ: SPAWN_Z,
          side: 'blue', direction: Math.random() < 0.5 ? 0 : 1,
          intensity: 0.8, active: true, hitResult: '', hitTime: 0,
        },
      );
    }

    if (blocksRef.current.length > 80) blocksRef.current = blocksRef.current.slice(-80);

    // ── Block movement & hit detection ──────────────────────

    const score = scoreRef.current;
    const prevMult = prevMultiplierRef.current;

    for (const block of blocksRef.current) {
      if (!block.active) continue;
      if (block.hitResult === '' || block.hitResult === 'miss') {
        block.worldZ -= blockSpeed;
      }

      if (block.worldZ <= HIT_Z && block.hitResult === '') {
        if (Math.random() > 0.08) {
          const closeness = 1 - (HIT_Z - block.worldZ);
          let text: string; let points: number;
          if (closeness > 0.98) { text = 'PERFECT!'; points = 115; block.hitResult = 'perfect'; }
          else if (closeness > 0.95) { text = 'GREAT!'; points = 80; block.hitResult = 'great'; }
          else { text = 'GOOD'; points = 50; block.hitResult = 'good'; }

          score.streak++;
          const newCombo = Math.floor(score.streak / 4);
          if (newCombo > score.combo) score.combo = newCombo;
          if (score.combo >= 14) score.multiplier = 8;
          else if (score.combo >= 6) score.multiplier = 4;
          else if (score.combo >= 2) score.multiplier = 2;
          else score.multiplier = 1;

          score.score += points * score.multiplier;
          score.energy = Math.min(1, score.energy + 0.02);
          score.lastHitText = text;
          score.lastHitTime = now;

          // Flash on hit (swing already started during anticipation)
          if (block.side === 'red') {
            saberFlashL.current = 1;
            // Reset swing to slash-through phase
            saberSwingL.current.progress = 1.01;
          } else {
            saberFlashR.current = 1;
            saberSwingR.current.progress = 1.01;
          }

          if (score.multiplier > prevMult) {
            milestoneRef.current = { text: `${score.multiplier}X MULTIPLIER!`, time: now };
          }
          prevMultiplierRef.current = score.multiplier;

          // Spawn slice halves (world-space 3D)
          const dir = ARROW_DIRS[block.direction];
          slicesRef.current.push(
            {
              wx: block.worldX - dir[0] * 0.3,
              wy: block.worldY - dir[1] * 0.3,
              wz: block.worldZ,
              vx: -dir[0] * 0.08 + (Math.random() - 0.5) * 0.05,
              vy: -dir[1] * 0.08 + 0.06,
              vz: -0.02 - Math.random() * 0.03,
              rotation: 0, rotSpeed: (Math.random() - 0.5) * 0.15,
              life: 0, maxLife: 35, side: block.side, size: BLOCK_SIZE * 0.5,
            },
            {
              wx: block.worldX + dir[0] * 0.3,
              wy: block.worldY + dir[1] * 0.3,
              wz: block.worldZ,
              vx: dir[0] * 0.08 + (Math.random() - 0.5) * 0.05,
              vy: dir[1] * 0.08 + 0.06,
              vz: -0.02 - Math.random() * 0.03,
              rotation: 0, rotSpeed: (Math.random() - 0.5) * 0.15,
              life: 0, maxLife: 35, side: block.side, size: BLOCK_SIZE * 0.5,
            },
          );

          // Spawn particles (world-space 3D)
          const rgb = block.side === 'red' ? RED_RGB : BLUE_RGB;
          for (let p = 0; p < 20; p++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const spd = 0.04 + Math.random() * 0.1;
            particlesRef.current.push({
              wx: block.worldX, wy: block.worldY, wz: block.worldZ,
              vx: Math.sin(phi) * Math.cos(theta) * spd,
              vy: Math.sin(phi) * Math.sin(theta) * spd + 0.02,
              vz: Math.cos(phi) * spd * 0.5,
              life: 0, maxLife: 20 + Math.random() * 15,
              r: rgb[0], g: rgb[1], b: rgb[2],
              size: 1.5 + Math.random() * 2.5, glow: false,
            });
          }
          for (let p = 0; p < 6; p++) {
            const theta = Math.random() * Math.PI * 2;
            const spd = 0.02 + Math.random() * 0.05;
            particlesRef.current.push({
              wx: block.worldX, wy: block.worldY, wz: block.worldZ,
              vx: Math.cos(theta) * spd,
              vy: Math.sin(theta) * spd + 0.01,
              vz: -(Math.random() * 0.03),
              life: 0, maxLife: 25 + Math.random() * 10,
              r: rgb[0], g: rgb[1], b: rgb[2],
              size: 4 + Math.random() * 4, glow: true,
            });
          }
        } else {
          block.hitResult = 'miss';
          score.streak = 0;
          score.combo = 0;
          score.multiplier = 1;
          prevMultiplierRef.current = 1;
          score.energy = Math.max(0, score.energy - 0.05);
          score.lastHitText = 'MISS';
          score.lastHitTime = now;
        }
        block.hitTime = now;
      }
    }

    // Clean up blocks
    blocksRef.current = blocksRef.current.filter((b) => {
      if (!b.active) return false;
      if (b.hitResult === '') return b.worldZ > DESPAWN_Z;
      if (b.hitResult === 'miss') return b.worldZ > DESPAWN_Z;
      return now - b.hitTime < 200;
    });

    if (slicesRef.current.length > 60) slicesRef.current = slicesRef.current.slice(-60);
    if (particlesRef.current.length > 300) particlesRef.current = particlesRef.current.slice(-300);

    // ── Saber anticipation: start swing before block arrives ──
    const ANTIC_Z = 16.0; // start anticipating when block enters this depth
    let nearestRed: Block | null = null;
    let nearestBlue: Block | null = null;
    for (const block of blocksRef.current) {
      if (!block.active || block.hitResult !== '') continue;
      if (block.worldZ > ANTIC_Z) continue;
      if (block.side === 'red' && (!nearestRed || block.worldZ < nearestRed.worldZ)) nearestRed = block;
      if (block.side === 'blue' && (!nearestBlue || block.worldZ < nearestBlue.worldZ)) nearestBlue = block;
    }
    // Start or update wind-up swing toward the nearest approaching block
    function updateSwingTarget(swing: SaberSwing, block: Block, fallbackX: number) {
      const screenPos = project(block.worldX, block.worldY, HIT_Z);
      const tx = screenPos ? screenPos[0] : fallbackX;
      const ty = screenPos ? screenPos[1] : height * 0.68;
      if (swing.progress === 0) {
        swing.progress = 0.01;
      }
      // Continuously update target as block approaches
      swing.targetX = tx;
      swing.targetY = ty;
      swing.direction = block.direction;
    }
    if (nearestRed && saberSwingL.current.progress <= 1) {
      updateSwingTarget(saberSwingL.current, nearestRed, centerX - width * 0.06);
    }
    if (nearestBlue && saberSwingR.current.progress <= 1) {
      updateSwingTarget(saberSwingR.current, nearestBlue, centerX + width * 0.06);
    }

    // ════════════════════════════════════════════════════════
    // DRAW
    // ════════════════════════════════════════════════════════

    // ── 1. Background ──
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#010005');
    bgGrad.addColorStop(0.5, '#05001a');
    bgGrad.addColorStop(1, '#08001a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Accent nebula at vanishing point
    const nebulaA = 0.04 + energy * 0.08 + pulse * 0.06;
    const nebGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, height * 0.6);
    nebGrad.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, ${nebulaA})`);
    nebGrad.addColorStop(0.5, `rgba(${(ar * 0.5) | 0}, ${(ag * 0.3) | 0}, ${ab}, ${nebulaA * 0.4})`);
    nebGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = nebGrad;
    ctx.fillRect(0, 0, width, height);

    // ── 2. Floor grid ──
    const gridAlpha = 0.12 + pulse * 0.08 + energy * 0.06;
    const scrollOffset = gridScroll.current % GRID_SPACING;

    // Scrolling horizontal floor lines
    ctx.lineWidth = 1 * dpr;
    for (let i = 0; i < GRID_LINES; i++) {
      const z = 2 + GRID_SPACING * i + (GRID_SPACING - scrollOffset);
      if (z < 1.5 || z > SPAWN_Z + 2) continue;
      const pL = project(-CORRIDOR_X, FLOOR_Y, z);
      const pR = project(CORRIDOR_X, FLOOR_Y, z);
      if (!pL || !pR) continue;
      const fog = fogAlpha(z);
      const a = gridAlpha * fog;
      if (a < 0.005) continue;
      ctx.strokeStyle = `rgba(${accentStr}, ${a})`;
      ctx.beginPath();
      ctx.moveTo(pL[0], pL[1]);
      ctx.lineTo(pR[0], pR[1]);
      ctx.stroke();
    }

    // Longitudinal floor lines
    for (let i = 0; i <= LONG_LINES; i++) {
      const x = -CORRIDOR_X + (CORRIDOR_X * 2 / LONG_LINES) * i;
      const pNear = project(x, FLOOR_Y, 2);
      const pFar = project(x, FLOOR_Y, SPAWN_Z);
      if (!pNear || !pFar) continue;
      ctx.strokeStyle = `rgba(${accentStr}, ${gridAlpha * 0.5})`;
      ctx.beginPath();
      ctx.moveTo(pNear[0], pNear[1]);
      ctx.lineTo(pFar[0], pFar[1]);
      ctx.stroke();
    }

    // ── 3. Side rails (two-pass neon, no shadowBlur) ──
    const railAlpha = 0.3 + pulse * 0.15 + energy * 0.1;
    for (const xSide of [-CORRIDOR_X, CORRIDOR_X]) {
      const pNear = project(xSide, FLOOR_Y, 2);
      const pFar = project(xSide, FLOOR_Y, SPAWN_Z);
      if (!pNear || !pFar) continue;
      // Glow pass
      ctx.strokeStyle = `rgba(${accentStr}, ${railAlpha * 0.25})`;
      ctx.lineWidth = 6 * dpr;
      ctx.beginPath();
      ctx.moveTo(pNear[0], pNear[1]);
      ctx.lineTo(pFar[0], pFar[1]);
      ctx.stroke();
      // Core pass
      ctx.strokeStyle = `rgba(${accentStr}, ${railAlpha})`;
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.moveTo(pNear[0], pNear[1]);
      ctx.lineTo(pFar[0], pFar[1]);
      ctx.stroke();
    }

    // ── 4. Ceiling lines ──
    const ceilAlpha = 0.15 + pulse * 0.08;
    for (const xSide of [-CORRIDOR_X, CORRIDOR_X]) {
      const pNear = project(xSide, CEILING_Y, 2);
      const pFar = project(xSide, CEILING_Y, SPAWN_Z);
      if (!pNear || !pFar) continue;
      ctx.strokeStyle = `rgba(${accentStr}, ${ceilAlpha * 0.25})`;
      ctx.lineWidth = 4 * dpr;
      ctx.beginPath();
      ctx.moveTo(pNear[0], pNear[1]);
      ctx.lineTo(pFar[0], pFar[1]);
      ctx.stroke();
      ctx.strokeStyle = `rgba(${accentStr}, ${ceilAlpha})`;
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.moveTo(pNear[0], pNear[1]);
      ctx.lineTo(pFar[0], pFar[1]);
      ctx.stroke();
    }

    // ── 5. Neon arches (scrolling doorframes) ──
    const archScroll = gridScroll.current % ARCH_SPACING;
    for (let i = 0; i < ARCH_COUNT; i++) {
      const z = 3 + ARCH_SPACING * i + (ARCH_SPACING - archScroll);
      if (z < 2 || z > SPAWN_Z + 2) continue;
      const fog = fogAlpha(z);
      if (fog < 0.01) continue;
      const archA = fog * (0.3 + pulse * 0.15 + energy * 0.1);

      const pBL = project(-CORRIDOR_X, FLOOR_Y, z);
      const pBR = project(CORRIDOR_X, FLOOR_Y, z);
      const pTL = project(-CORRIDOR_X, CEILING_Y, z);
      const pTR = project(CORRIDOR_X, CEILING_Y, z);
      if (!pBL || !pBR || !pTL || !pTR) continue;

      const archLines: [number[], number[]][] = [
        [pBL, pTL], [pBR, pTR], [pTL, pTR],
      ];
      for (const [la, lb] of archLines) {
        ctx.strokeStyle = `rgba(${accentStr}, ${archA * 0.2})`;
        ctx.lineWidth = Math.max(1, 5 * dpr * fog);
        ctx.beginPath();
        ctx.moveTo(la[0], la[1]);
        ctx.lineTo(lb[0], lb[1]);
        ctx.stroke();
        ctx.strokeStyle = `rgba(${accentStr}, ${archA * 0.8})`;
        ctx.lineWidth = Math.max(0.5, 1.5 * dpr * fog);
        ctx.beginPath();
        ctx.moveTo(la[0], la[1]);
        ctx.lineTo(lb[0], lb[1]);
        ctx.stroke();
      }
    }

    // ── 6. Light pillars ──
    const pillarXs = [-2.3, -1.6, -0.9, -0.2, 0.2, 0.9, 1.6, 2.3];
    for (let i = 0; i < pillarXs.length; i++) {
      const pBot = project(pillarXs[i], FLOOR_Y, 6);
      const pTop = project(pillarXs[i], CEILING_Y, 6);
      if (!pBot || !pTop) continue;
      const pIntensity = 0.06 + energy * 0.12 + pulse * 0.1;
      const flicker = 0.8 + 0.2 * Math.sin(timeSec * 1.5 + i * 1.2);
      const pA = pIntensity * flicker;
      const pGrad = ctx.createLinearGradient(pBot[0], pBot[1], pTop[0], pTop[1]);
      pGrad.addColorStop(0, `rgba(${accentStr}, ${pA})`);
      pGrad.addColorStop(0.3, `rgba(${accentStr}, ${pA * 0.5})`);
      pGrad.addColorStop(1, `rgba(${accentStr}, 0)`);
      ctx.fillStyle = pGrad;
      const pw = 6 * dpr;
      const pcx = (pBot[0] + pTop[0]) / 2;
      ctx.fillRect(pcx - pw / 2, pTop[1], pw, pBot[1] - pTop[1]);
    }

    // ── 7. Blocks (3D cubes, painter's algorithm) ──
    const sortedBlocks = [...blocksRef.current].sort((a, b) => b.worldZ - a.worldZ);

    for (const block of sortedBlocks) {
      if (!block.active) continue;
      const { worldX: bwx, worldY: bwy, worldZ: bwz } = block;
      if (bwz < DESPAWN_Z) continue;
      const fog = fogAlpha(bwz);
      if (fog < 0.01) continue;

      let alpha = fog;
      if (block.hitResult !== '' && block.hitResult !== 'miss') {
        const el = now - block.hitTime;
        alpha *= Math.max(0, 1 - el / 200);
        if (alpha <= 0) continue;
      } else if (block.hitResult === 'miss') {
        alpha *= Math.max(0, (bwz - DESPAWN_Z) / 2);
        if (alpha <= 0) continue;
      }

      if (!projectCube(bwx, bwy, bwz)) continue;

      const rgb = block.side === 'red' ? RED_RGB : BLUE_RGB;

      // Glow halo behind block (subtle, doesn't drown out geometry)
      const ctr = project(bwx, bwy, bwz);
      if (ctr) {
        const glowR = (FOCAL_LENGTH / bwz) * pixelScale * 0.35;
        const gGrad = ctx.createRadialGradient(ctr[0], ctr[1], 0, ctr[0], ctr[1], glowR);
        gGrad.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${0.2 * alpha})`);
        gGrad.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`);
        ctx.fillStyle = gGrad;
        ctx.beginPath();
        ctx.arc(ctr[0], ctr[1], glowR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Face visibility
      const seeTop = CAMERA_Y > bwy + BLOCK_HALF;
      const seeBot = CAMERA_Y < bwy - BLOCK_HALF;
      const seeLeft = 0 < bwx - BLOCK_HALF;
      const seeRight = 0 > bwx + BLOCK_HALF;

      // Draw back faces first, front last
      if (seeTop) drawFace(FACE_TOP, rgb[0], rgb[1], rgb[2], SHADE_TOP, alpha * 0.95);
      if (seeBot) drawFace(FACE_BOT, rgb[0], rgb[1], rgb[2], SHADE_BOT, alpha * 0.95);
      if (seeLeft) drawFace(FACE_LEFT, rgb[0], rgb[1], rgb[2], SHADE_SIDE, alpha * 0.95);
      if (seeRight) drawFace(FACE_RIGHT, rgb[0], rgb[1], rgb[2], SHADE_SIDE, alpha * 0.95);

      // Front face
      drawFace(FACE_FRONT, rgb[0], rgb[1], rgb[2], SHADE_FRONT, alpha * 0.95);

      // Front face neon border (bright edge highlight for 3D pop)
      const borderW = Math.max(1.5, (FOCAL_LENGTH / bwz) * pixelScale * 0.025);
      strokeFace(FACE_FRONT, `rgba(255, 255, 255, ${alpha * 0.7})`, borderW);

      // Inner highlight gradient on front face
      const buf = projBuf.current;
      const ftop = Math.min(buf[1], buf[3], buf[5], buf[7]);
      const fbot = Math.max(buf[1], buf[3], buf[5], buf[7]);
      const hiGrad = ctx.createLinearGradient(centerX, ftop, centerX, fbot);
      hiGrad.addColorStop(0, `rgba(255, 255, 255, ${0.25 * alpha})`);
      hiGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = hiGrad;
      ctx.beginPath();
      ctx.moveTo(buf[FACE_FRONT[0] * 2], buf[FACE_FRONT[0] * 2 + 1]);
      for (let fi = 1; fi < FACE_FRONT.length; fi++) {
        ctx.lineTo(buf[FACE_FRONT[fi] * 2], buf[FACE_FRONT[fi] * 2 + 1]);
      }
      ctx.closePath();
      ctx.fill();

      // Arrow on front face
      if (block.hitResult === '' && bwz < FOG_START) {
        const fcx = (buf[0] + buf[2] + buf[4] + buf[6]) / 4;
        const fcy = (buf[1] + buf[3] + buf[5] + buf[7]) / 4;
        const faceW = Math.hypot(buf[2] - buf[0], buf[3] - buf[1]);
        const arrowSize = faceW * 0.3;

        const adir = ARROW_DIRS[block.direction];
        const angle = Math.atan2(adir[1], adir[0]) - Math.PI / 2;

        ctx.save();
        ctx.translate(fcx, fcy);
        ctx.rotate(angle);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * alpha})`;
        ctx.beginPath();
        ctx.moveTo(0, -arrowSize);
        ctx.lineTo(-arrowSize * 0.6, arrowSize * 0.3);
        ctx.lineTo(-arrowSize * 0.2, arrowSize * 0.3);
        ctx.lineTo(-arrowSize * 0.2, arrowSize);
        ctx.lineTo(arrowSize * 0.2, arrowSize);
        ctx.lineTo(arrowSize * 0.2, arrowSize * 0.3);
        ctx.lineTo(arrowSize * 0.6, arrowSize * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // ── 8. Slice halves (world-space 3D) ──
    slicesRef.current = slicesRef.current.filter((s) => {
      s.wx += s.vx;
      s.wy += s.vy;
      s.wz += s.vz;
      s.vy -= 0.005;
      s.rotation += s.rotSpeed;
      s.life++;
      if (s.life >= s.maxLife) return false;

      const sp = project(s.wx, s.wy, s.wz);
      if (!sp) return false;

      const a = 1 - s.life / s.maxLife;
      const rgb = s.side === 'red' ? RED_RGB : BLUE_RGB;
      const screenSize = (FOCAL_LENGTH / Math.max(0.5, s.wz)) * pixelScale * s.size;

      ctx.save();
      ctx.translate(sp[0], sp[1]);
      ctx.rotate(s.rotation);
      ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a * 0.8})`;
      ctx.fillRect(-screenSize / 2, -screenSize, screenSize, screenSize * 2);
      ctx.restore();

      return true;
    });

    // ── 9. Particles (world-space 3D, additive blending) ──
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    particlesRef.current = particlesRef.current.filter((p) => {
      p.wx += p.vx;
      p.wy += p.vy;
      p.wz += p.vz;
      p.vy -= 0.003;
      p.life++;
      if (p.life >= p.maxLife) return false;

      const pp = project(p.wx, p.wy, p.wz);
      if (!pp) return false;

      const a = 1 - p.life / p.maxLife;
      const screenSize = (FOCAL_LENGTH / Math.max(0.5, p.wz)) * pixelScale * p.size * 0.02;

      if (p.glow) {
        const gGrad = ctx.createRadialGradient(pp[0], pp[1], 0, pp[0], pp[1], screenSize * 2);
        gGrad.addColorStop(0, `rgba(${p.r}, ${p.g}, ${p.b}, ${a * 0.6})`);
        gGrad.addColorStop(1, `rgba(${p.r}, ${p.g}, ${p.b}, 0)`);
        ctx.fillStyle = gGrad;
        ctx.beginPath();
        ctx.arc(pp[0], pp[1], screenSize * 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${a * 0.9})`;
        ctx.beginPath();
        ctx.arc(pp[0], pp[1], Math.max(1, screenSize), 0, Math.PI * 2);
        ctx.fill();
      }

      return true;
    });
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // ── 10. Sabers (screen-space, first-person) ──
    const lFlash = saberFlashL.current;
    const rFlash = saberFlashR.current;

    // Advance swing animations (0→1 wind-up toward block, 1→2 slash-through & return)
    const WINDUP_SPEED = 0.06;   // anticipation (~17 frames to reach target)
    const RETURN_SPEED = 0.12;   // fast slash-through and snap back
    const swL = saberSwingL.current;
    const swR = saberSwingR.current;
    function advanceSwing(sw: SaberSwing) {
      if (sw.progress <= 0) return;
      if (sw.progress <= 1) {
        sw.progress = Math.min(1, sw.progress + WINDUP_SPEED);
      } else {
        sw.progress = Math.min(2, sw.progress + RETURN_SPEED);
        if (sw.progress >= 2) sw.progress = 0;
      }
    }
    advanceSwing(swL);
    advanceSwing(swR);

    // Ease function: fast start then settle for wind-up, fast slash-through return
    function swingEase(p: number): number {
      if (p <= 1) {
        // Wind-up: ease-out (moves quickly at first, settles into position)
        return 1 - (1 - p) * (1 - p);
      }
      // Slash-through & return: fast quadratic
      const ret = p - 1;
      return 1 - ret * ret;
    }

    // Idle sway — always visible, amplified by audio energy
    const swayT = timeSec * 1.2;
    const swayAmp = 0.035 + energy * 0.02;

    function computeSaber(
      side: 'left' | 'right',
      swing: SaberSwing,
      flash: number,
    ): { baseX: number; baseY: number; tipX: number; tipY: number } {
      const sign = side === 'left' ? -1 : 1;
      // Rest positions (tips point toward vanishing point)
      const restBaseX = centerX + sign * width * 0.15;
      const restBaseY = height * 0.85;
      const restTipX = centerX + sign * width * 0.04;
      const restTipY = height * 0.55;

      // Idle sway offset
      const idleOffX = Math.sin(swayT + (side === 'left' ? 0 : Math.PI * 0.7)) * width * swayAmp;
      const idleOffY = Math.cos(swayT * 0.8 + (side === 'left' ? 0.5 : 2.1)) * height * swayAmp * 0.5;

      let tipX = restTipX + idleOffX;
      let tipY = restTipY + idleOffY;
      const baseX = restBaseX + idleOffX * 0.3;
      const baseY = restBaseY + idleOffY * 0.15;

      // Swing toward target block
      if (swing.progress > 0) {
        const t = swingEase(swing.progress);
        tipX = tipX + (swing.targetX - tipX) * t * 0.85;
        tipY = tipY + (swing.targetY - tipY) * t * 0.7;
      }

      return { baseX, baseY, tipX, tipY };
    }

    const leftSaber = computeSaber('left', swL, lFlash);
    const rightSaber = computeSaber('right', swR, rFlash);

    // Record trail positions
    trailL.current.push([leftSaber.tipX, leftSaber.tipY, 1]);
    trailR.current.push([rightSaber.tipX, rightSaber.tipY, 1]);
    if (trailL.current.length > TRAIL_LEN) trailL.current.shift();
    if (trailR.current.length > TRAIL_LEN) trailR.current.shift();

    // Draw trail arcs (additive blending for glow)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    function drawTrail(
      trail: Array<[number, number, number]>,
      rgb: [number, number, number],
      flash: number,
    ) {
      const len = trail.length;
      if (len < 2) return;
      const trailAlpha = flash > 0.1 ? 0.5 + flash * 0.3 : energy * 0.15;
      if (trailAlpha < 0.02) return;

      const [r, g, b] = rgb;
      // Two-layer trail: wide soft bloom + narrow bright core
      for (let i = 1; i < len; i++) {
        const frac = i / len;
        const a = frac * frac * trailAlpha;
        // Outer bloom layer
        const wOuter = (4 + frac * 18 + flash * 10) * dpr;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${a * 0.3})`;
        ctx.lineWidth = wOuter;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1][0], trail[i - 1][1]);
        ctx.lineTo(trail[i][0], trail[i][1]);
        ctx.stroke();
        // Bright core layer
        const wCore = (1 + frac * 6 + flash * 4) * dpr;
        ctx.strokeStyle = `rgba(${Math.min(255, r + 80)}, ${Math.min(255, g + 80)}, ${Math.min(255, b + 80)}, ${a * 0.7})`;
        ctx.lineWidth = wCore;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1][0], trail[i - 1][1]);
        ctx.lineTo(trail[i][0], trail[i][1]);
        ctx.stroke();
      }
    }

    drawTrail(trailL.current, RED_RGB, lFlash);
    drawTrail(trailR.current, BLUE_RGB, rFlash);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // Draw volumetric saber blades + handles
    ctx.lineCap = 'round';

    function drawSaber(
      bx: number, by: number, tx: number, ty: number,
      rgb: [number, number, number],
      flash: number,
    ) {
      const [r, g, b] = rgb;
      const f = flash;

      // ─ Ambient glow: large soft radial at blade midpoint ─
      const mx = (bx + tx) * 0.5;
      const my = (by + ty) * 0.5;
      const bladeLen = Math.hypot(tx - bx, ty - by);
      const ambR = bladeLen * (0.6 + f * 0.3);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const ambGrad = ctx.createRadialGradient(mx, my, 0, mx, my, ambR);
      ambGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.06 + f * 0.04})`);
      ambGrad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${0.02 + f * 0.02})`);
      ambGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = ambGrad;
      ctx.fillRect(mx - ambR, my - ambR, ambR * 2, ambR * 2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();

      // ─ Blade: 6-pass volumetric tube (outer bloom → saturated body → white-hot core) ─
      const passes: [number, number, string][] = [
        // Outer bloom (very wide, very faint)
        [56 * dpr * (1 + f * 0.5), 0.04 + f * 0.03, `${r}, ${g}, ${b}`],
        // Mid bloom
        [36 * dpr * (1 + f * 0.4), 0.08 + f * 0.05, `${r}, ${g}, ${b}`],
        // Saturated body (the visible "tube")
        [24 * dpr * (1 + f * 0.3), 0.35 + f * 0.15, `${r}, ${g}, ${b}`],
        // Inner bright
        [14 * dpr * (1 + f * 0.2), 0.6 + f * 0.2, `${Math.min(255, r + 60)}, ${Math.min(255, g + 60)}, ${Math.min(255, b + 60)}`],
        // Hot core
        [6 * dpr, 0.8 + f * 0.2, `${Math.min(255, r + 140)}, ${Math.min(255, g + 140)}, ${Math.min(255, b + 140)}`],
        // White-hot center
        [2.5 * dpr, 0.95, '255, 255, 255'],
      ];
      for (const [sw, sa, col] of passes) {
        ctx.strokeStyle = `rgba(${col}, ${sa})`;
        ctx.lineWidth = sw;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }

      // ─ Handle: cylindrical grip with pommel ─
      const angle = Math.atan2(ty - by, tx - bx);
      const handleLen = 28 * dpr;
      const handleW = 7 * dpr;
      const gripW = 6 * dpr;
      const pommelR = 4.5 * dpr;

      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(angle);

      // Handle extends opposite to blade direction
      const hDir = -1; // handle extends behind the blade base

      // Grip body (dark metallic gradient)
      const gripGrad = ctx.createLinearGradient(0, -handleW, 0, handleW);
      gripGrad.addColorStop(0, 'rgba(50, 50, 58, 0.95)');
      gripGrad.addColorStop(0.3, 'rgba(90, 90, 100, 0.95)');
      gripGrad.addColorStop(0.5, 'rgba(110, 110, 120, 0.95)');
      gripGrad.addColorStop(0.7, 'rgba(90, 90, 100, 0.95)');
      gripGrad.addColorStop(1, 'rgba(50, 50, 58, 0.95)');
      ctx.fillStyle = gripGrad;

      // Rounded rect for grip
      const gx = hDir * 1 * dpr;
      const gw = hDir * handleLen;
      ctx.beginPath();
      ctx.roundRect(
        Math.min(gx, gx + gw), -gripW,
        Math.abs(gw), gripW * 2,
        2 * dpr,
      );
      ctx.fill();

      // Grip ridges (3 subtle lines across the handle)
      ctx.strokeStyle = 'rgba(40, 40, 48, 0.7)';
      ctx.lineWidth = 1 * dpr;
      for (let i = 1; i <= 3; i++) {
        const rx = hDir * (handleLen * 0.25 * i);
        ctx.beginPath();
        ctx.moveTo(rx, -gripW * 0.8);
        ctx.lineTo(rx, gripW * 0.8);
        ctx.stroke();
      }

      // Guard ring (where blade meets handle)
      ctx.fillStyle = 'rgba(130, 130, 145, 0.9)';
      ctx.beginPath();
      ctx.roundRect(-2 * dpr, -handleW, 4 * dpr, handleW * 2, 1.5 * dpr);
      ctx.fill();

      // Pommel cap (rounded end)
      const pommelX = hDir * (handleLen + 1 * dpr);
      ctx.fillStyle = 'rgba(100, 100, 112, 0.9)';
      ctx.beginPath();
      ctx.arc(pommelX, 0, pommelR, 0, Math.PI * 2);
      ctx.fill();
      // Pommel highlight
      ctx.fillStyle = 'rgba(160, 160, 175, 0.5)';
      ctx.beginPath();
      ctx.arc(pommelX - 0.5 * dpr, -1 * dpr, pommelR * 0.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    drawSaber(
      leftSaber.baseX, leftSaber.baseY, leftSaber.tipX, leftSaber.tipY,
      RED_RGB, lFlash,
    );
    drawSaber(
      rightSaber.baseX, rightSaber.baseY, rightSaber.tipX, rightSaber.tipY,
      BLUE_RGB, rFlash,
    );

    ctx.lineCap = 'butt';
    saberFlashL.current *= 0.86;
    saberFlashR.current *= 0.86;

    // ── 11. Screen effects ──

    // Beat flash overlay
    if (pulse > 0.1) {
      ctx.fillStyle = `rgba(255, 255, 255, ${pulse * 0.04})`;
      ctx.fillRect(0, 0, width, height);
    }

    // Milestone flare
    const ms = milestoneRef.current;
    if (ms.text && now - ms.time < 150) {
      const el = now - ms.time;
      ctx.fillStyle = `rgba(${ar}, ${ag}, ${ab}, ${(1 - el / 150) * 0.12})`;
      ctx.fillRect(0, 0, width, height);
    }

    // ── 12. UI overlay (Beat Saber style: centered) ──

    // Score (top-center)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${42 * dpr}px monospace`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    applyGlow(ctx, 8 * dpr, 'rgba(0, 0, 0, 0.9)');
    ctx.fillText(score.score.toLocaleString(), centerX, TOP_HUD_Y * dpr);

    // Combo & multiplier (below score, centered)
    if (score.combo > 0) {
      ctx.font = `bold ${22 * dpr}px monospace`;
      const mCol = score.multiplier >= 8 ? '255, 200, 50' : score.multiplier >= 4 ? '50, 200, 255' : '200, 200, 200';
      ctx.fillStyle = `rgba(${mCol}, 0.95)`;
      ctx.fillText(`${score.combo}x COMBO`, centerX, (TOP_HUD_Y + 48) * dpr);

      if (score.multiplier > 1) {
        ctx.font = `bold ${16 * dpr}px monospace`;
        ctx.fillStyle = 'rgba(255, 255, 100, 0.9)';
        ctx.fillText(`${score.multiplier}x MULTIPLIER`, centerX, (TOP_HUD_Y + 76) * dpr);
      }
    }

    // Streak (smaller, below combo)
    if (score.streak > 1) {
      ctx.font = `bold ${14 * dpr}px monospace`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillText(`${score.streak} STREAK`, centerX, (TOP_HUD_Y + 98) * dpr);
    }
    clearGlow(ctx);

    // Energy bar (bottom-center)
    const ebW = 200 * dpr;
    const ebH = 12 * dpr;
    const ebX = centerX - ebW / 2;
    const ebY = height - 40 * dpr;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.beginPath();
    ctx.roundRect(ebX, ebY, ebW, ebH, 3 * dpr);
    ctx.fill();

    if (score.energy > 0) {
      const fillW = ebW * score.energy;
      const eGrad = ctx.createLinearGradient(ebX, ebY, ebX + ebW, ebY);
      eGrad.addColorStop(0, 'rgba(220, 50, 50, 0.85)');
      eGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)');
      eGrad.addColorStop(1, 'rgba(50, 120, 255, 0.85)');
      ctx.fillStyle = eGrad;
      ctx.beginPath();
      ctx.roundRect(ebX, ebY, fillW, ebH, 3 * dpr);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.roundRect(ebX, ebY, ebW, ebH, 3 * dpr);
    ctx.stroke();

    ctx.font = `bold ${10 * dpr}px monospace`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillText('ENERGY', centerX, ebY + ebH + 4 * dpr);

    // Hit quality text (center screen, floating up)
    if (score.lastHitText && now - score.lastHitTime < 500) {
      const el = now - score.lastHitTime;
      const prog = el / 500;
      const tA = 1 - prog;
      const tS = 1 + prog * 0.3;
      const tY = height * 0.45 - prog * 40 * dpr;

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.round(30 * dpr * tS)}px monospace`;

      let tc: string;
      if (score.lastHitText === 'MISS') tc = `rgba(255, 70, 70, ${tA})`;
      else if (score.lastHitText === 'PERFECT!') tc = `rgba(255, 255, 80, ${tA})`;
      else if (score.lastHitText === 'GREAT!') tc = `rgba(80, 255, 140, ${tA})`;
      else tc = `rgba(140, 200, 255, ${tA})`;

      applyGlow(ctx, 8 * dpr, 'rgba(0, 0, 0, 0.7)');
      ctx.fillStyle = tc;
      ctx.fillText(score.lastHitText, centerX, tY);
      clearGlow(ctx);
      ctx.restore();
    }

    // Milestone text
    if (ms.text && now - ms.time < 1200) {
      const el = now - ms.time;
      const prog = el / 1200;
      let mA: number, mS: number;
      if (prog < 0.15) { mA = prog / 0.15; mS = 0.5 + 0.5 * (prog / 0.15); }
      else if (prog < 0.6) { mA = 1; mS = 1; }
      else { mA = 1 - (prog - 0.6) / 0.4; mS = 1 + (prog - 0.6) * 0.3; }

      const mY = height * 0.35 - (prog > 0.6 ? (prog - 0.6) * 40 * dpr : 0);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.round(50 * dpr * mS)}px monospace`;
      applyGlow(ctx, 25 * dpr * mA, `rgba(${ar}, ${ag}, ${ab}, 0.8)`);
      ctx.fillStyle = `rgba(255, 255, 255, ${mA})`;
      ctx.fillText(ms.text, centerX, mY);
      clearGlow(ctx);
      ctx.restore();
    }

  }, [accentColor]);

  useVisualizerLoop(canvasRef, draw, [draw]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
