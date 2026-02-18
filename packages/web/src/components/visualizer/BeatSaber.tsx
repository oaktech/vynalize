import { useRef, useEffect } from 'react';
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

const NUM_COLS = 4;
const NUM_ROWS = 3;
const COL_GAIN = [1.5, 2.0, 3.0, 4.0];

function boost(v: number, col: number): number {
  return Math.min(1, Math.pow(v * COL_GAIN[col], 0.55));
}

// Frequency bins per column
const COL_BINS: [number, number][] = [
  [0, 20], [15, 50], [40, 90], [70, 140],
];

// Beat Saber colors
const RED_COLOR = '220, 50, 50';
const BLUE_COLOR = '50, 120, 255';

// Directions: 0=up, 1=down, 2=left, 3=right
const ARROW_DIRS = [
  [0, -1],  // up
  [0, 1],   // down
  [-1, 0],  // left
  [1, 0],   // right
];

// ── Types ───────────────────────────────────────────────────

interface Block {
  col: number;
  row: number;
  z: number;          // 0 = far (spawn), 1 = near (hit zone)
  side: 'red' | 'blue';
  direction: number;  // 0-3
  intensity: number;
  active: boolean;
  hitResult: '' | 'perfect' | 'great' | 'good' | 'miss';
  hitTime: number;
}

interface SliceHalf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  life: number;
  maxLife: number;
  side: 'red' | 'blue';
  width: number;
  height: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
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

interface ColState {
  prevValue: number;
  lastSpikeTime: number;
}

// ── Component ───────────────────────────────────────────────

export default function BeatSaber({ accentColor }: { accentColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioFeatures = useStore((s) => s.audioFeatures);
  const isBeat = useStore((s) => s.isBeat);
  const bpm = useStore((s) => s.bpm);
  const currentSong = useStore((s) => s.currentSong);

  const beatPulse = useRef(0);
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
  const smoothEnergy = useRef(0);

  // Resize
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

  // Beat pulse
  useEffect(() => {
    if (isBeat) beatPulse.current = 1;
  }, [isBeat]);

  // Reset on song change
  useEffect(() => {
    scoreRef.current = { score: 0, streak: 0, combo: 0, multiplier: 1, energy: 0.5, lastHitText: '', lastHitTime: 0 };
    prevMultiplierRef.current = 1;
    blocksRef.current = [];
    slicesRef.current = [];
    particlesRef.current = [];
    milestoneRef.current = { text: '', time: 0 };
    saberFlashL.current = 0;
    saberFlashR.current = 0;
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
    const timeSec = now / 1000;

    const [ar, ag, ab] = hexToRgb(accentColor);

    const freq = audioFeatures.frequencyData;

    smoothEnergy.current += (audioFeatures.energy - smoothEnergy.current) * 0.08;
    const energy = smoothEnergy.current;

    beatPulse.current *= 0.88;
    const pulse = beatPulse.current;

    // ── Perspective geometry ──
    const vpX = width * 0.5;
    const vpY = height * 0.18;
    const hitZoneY = height * 0.82;

    // Corridor width at hit zone
    const corridorHalfW = width * 0.38;
    const corridorHalfH = height * 0.15; // half-height of corridor at hit zone

    function zToDepth(z: number): number {
      return Math.pow(z, 1.8);
    }

    function zToCanvasY(z: number): number {
      const d = zToDepth(z);
      return vpY + d * (hitZoneY - vpY);
    }

    function corridorHalfWidth(z: number): number {
      const d = zToDepth(z);
      return d * corridorHalfW;
    }

    function corridorHalfHeight(z: number): number {
      const d = zToDepth(z);
      return d * corridorHalfH;
    }

    // Map block grid position to canvas coordinates
    function blockToCanvas(col: number, row: number, z: number): { x: number; y: number; w: number; h: number } {
      const cy = zToCanvasY(z);
      const hw = corridorHalfWidth(z);
      const hh = corridorHalfHeight(z);

      // 4 columns spread within corridor
      const colW = (hw * 2) / NUM_COLS;
      const x = (vpX - hw) + (col + 0.5) * colW;

      // 3 rows: bottom, middle, top within corridor height
      const rowH = (hh * 2) / NUM_ROWS;
      const y = (cy + hh) - (row + 0.5) * rowH;

      const scale = zToDepth(z);
      const blockW = colW * 0.75;
      const blockH = rowH * 0.75;

      return { x, y, w: Math.max(4, blockW), h: Math.max(4, blockH) };
    }

    const beatsPerSec = (bpm || 120) / 60;
    gridScroll.current += beatsPerSec * 0.012;

    // ── Block spawning ──
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

        // Side assignment: cols 0-1 → left/red, cols 2-3 → right/blue (20% crossover)
        let side: 'red' | 'blue' = col < 2 ? 'red' : 'blue';
        if (Math.random() < 0.2) side = side === 'red' ? 'blue' : 'red';

        // Row weighted by mid energy
        let row = 0;
        if (midEnergy > 0.5) row = Math.random() < 0.6 ? 2 : 1;
        else if (midEnergy > 0.25) row = Math.random() < 0.5 ? 1 : 0;

        // Direction: up/down favored (60%), left/right when high freq
        let direction: number;
        if (highEnergy > 0.4 && Math.random() < 0.4) {
          direction = Math.random() < 0.5 ? 2 : 3;
        } else {
          direction = Math.random() < 0.6 ? 0 : 1;
        }

        blocksRef.current.push({
          col, row, z: 0, side, direction, intensity: avg,
          active: true, hitResult: '', hitTime: 0,
        });
      }
    }

    // Beat bonus: paired blocks
    if (isBeat && pulse > 0.8 && blocksRef.current.length < 70) {
      const leftCol = Math.floor(Math.random() * 2);
      const rightCol = 2 + Math.floor(Math.random() * 2);
      const row = Math.floor(Math.random() * NUM_ROWS);
      blocksRef.current.push(
        { col: leftCol, row, z: 0, side: 'red', direction: Math.random() < 0.5 ? 0 : 1, intensity: 0.8, active: true, hitResult: '', hitTime: 0 },
        { col: rightCol, row, z: 0, side: 'blue', direction: Math.random() < 0.5 ? 0 : 1, intensity: 0.8, active: true, hitResult: '', hitTime: 0 },
      );
    }

    if (blocksRef.current.length > 80) blocksRef.current = blocksRef.current.slice(-80);

    // ── Block scrolling & hit detection ──
    const blockSpeed = beatsPerSec * 0.011;
    const score = scoreRef.current;
    const prevMult = prevMultiplierRef.current;

    for (const block of blocksRef.current) {
      if (!block.active) continue;
      if (block.hitResult === '' || block.hitResult === 'miss') {
        block.z += blockSpeed;
      }

      if (block.z >= 0.95 && block.hitResult === '') {
        if (Math.random() > 0.08) {
          const closeness = 1 - Math.abs(block.z - 1.0);
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

          // Saber flash
          if (block.side === 'red') saberFlashL.current = 1;
          else saberFlashR.current = 1;

          // Multiplier milestone
          if (score.multiplier > prevMult) {
            milestoneRef.current = { text: `${score.multiplier}X MULTIPLIER!`, time: now };
          }
          prevMultiplierRef.current = score.multiplier;

          // Spawn slice halves
          const pos = blockToCanvas(block.col, block.row, block.z);
          const col = block.side === 'red' ? RED_COLOR : BLUE_COLOR;
          const dir = ARROW_DIRS[block.direction];
          slicesRef.current.push(
            {
              x: pos.x - dir[0] * pos.w * 0.3, y: pos.y - dir[1] * pos.h * 0.3,
              vx: -dir[0] * 3 * dpr + (Math.random() - 0.5) * 2 * dpr,
              vy: -dir[1] * 3 * dpr - 2 * dpr,
              rotation: 0, rotSpeed: (Math.random() - 0.5) * 0.15,
              life: 0, maxLife: 30, side: block.side,
              width: pos.w * 0.5, height: pos.h,
            },
            {
              x: pos.x + dir[0] * pos.w * 0.3, y: pos.y + dir[1] * pos.h * 0.3,
              vx: dir[0] * 3 * dpr + (Math.random() - 0.5) * 2 * dpr,
              vy: dir[1] * 3 * dpr - 2 * dpr,
              rotation: 0, rotSpeed: (Math.random() - 0.5) * 0.15,
              life: 0, maxLife: 30, side: block.side,
              width: pos.w * 0.5, height: pos.h,
            },
          );

          // Spawn particles
          for (let p = 0; p < 20; p++) {
            const angle = (Math.PI * 2 * p) / 20 + Math.random() * 0.3;
            const spd = (3 + Math.random() * 6) * dpr;
            particlesRef.current.push({
              x: pos.x, y: pos.y,
              vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 3 * dpr,
              life: 0, maxLife: 20 + Math.random() * 15, color: col,
              size: 1.5 + Math.random() * 2.5, glow: false,
            });
          }
          // Glow particles
          for (let p = 0; p < 6; p++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = (1 + Math.random() * 3) * dpr;
            particlesRef.current.push({
              x: pos.x, y: pos.y,
              vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 1.5 * dpr,
              life: 0, maxLife: 25 + Math.random() * 10, color: col,
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
      if (b.hitResult === '') return true;
      if (b.hitResult === 'miss') return b.z < 1.3;
      return now - b.hitTime < 200;
    });

    // Cap arrays
    if (slicesRef.current.length > 100) slicesRef.current = slicesRef.current.slice(-100);
    if (particlesRef.current.length > 400) particlesRef.current = particlesRef.current.slice(-400);

    // ════════════════════════════════════════════════════════
    // DRAW
    // ════════════════════════════════════════════════════════

    // ── 1. Background ──
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#020008');
    bgGrad.addColorStop(0.5, '#06001a');
    bgGrad.addColorStop(1, '#0a001a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Nebula glow (energy-reactive)
    const nebulaA = 0.04 + energy * 0.08 + pulse * 0.06;
    const nebGrad = ctx.createRadialGradient(vpX, vpY, 0, vpX, vpY, height * 0.6);
    nebGrad.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, ${nebulaA})`);
    nebGrad.addColorStop(0.5, `rgba(${ar * 0.5 | 0}, ${ag * 0.3 | 0}, ${ab}, ${nebulaA * 0.4})`);
    nebGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = nebGrad;
    ctx.fillRect(0, 0, width, height);

    // ── 2. Corridor walls ──
    const hitHW = corridorHalfWidth(1);
    const hitHH = corridorHalfHeight(1);
    const wallAlpha = 0.3 + pulse * 0.15 + energy * 0.1;

    // Helper to draw neon line (glow + core)
    function drawNeonLine(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, alpha: number, coreWidth: number) {
      // Glow pass
      c.strokeStyle = `rgba(${color}, ${alpha * 0.3})`;
      c.lineWidth = coreWidth * 4;
      c.shadowColor = `rgba(${color}, 0.5)`;
      c.shadowBlur = 12 * dpr;
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
      // Core pass
      c.strokeStyle = `rgba(${color}, ${alpha})`;
      c.lineWidth = coreWidth;
      c.shadowBlur = 6 * dpr;
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
      c.shadowBlur = 0;
    }

    const accentStr = `${ar}, ${ag}, ${ab}`;

    // 4 corridor edge lines: VP to hit-zone corners
    const hitL = vpX - hitHW;
    const hitR = vpX + hitHW;
    const hitTop = hitZoneY - hitHH;
    const hitBot = hitZoneY + hitHH;

    drawNeonLine(ctx, vpX, vpY, hitL, hitTop, accentStr, wallAlpha, 1.5 * dpr); // top-left
    drawNeonLine(ctx, vpX, vpY, hitR, hitTop, accentStr, wallAlpha, 1.5 * dpr); // top-right
    drawNeonLine(ctx, vpX, vpY, hitL, hitBot, accentStr, wallAlpha * 0.6, 1 * dpr); // bot-left
    drawNeonLine(ctx, vpX, vpY, hitR, hitBot, accentStr, wallAlpha * 0.6, 1 * dpr); // bot-right

    // ── 3. Floor/ceiling grid ──
    const gridAlpha = 0.12 + pulse * 0.08 + energy * 0.06;

    // Scrolling horizontal lines on floor/ceiling
    ctx.lineWidth = 1 * dpr;
    for (let i = 0; i < 20; i++) {
      const zt = ((i / 20) + gridScroll.current) % 1;
      const cy = zToCanvasY(zt);
      const hw = corridorHalfWidth(zt);
      const hh = corridorHalfHeight(zt);
      const a = gridAlpha * zt; // fade in as they approach

      // Floor line
      ctx.strokeStyle = `rgba(${accentStr}, ${a})`;
      ctx.beginPath();
      ctx.moveTo(vpX - hw, cy + hh);
      ctx.lineTo(vpX + hw, cy + hh);
      ctx.stroke();

      // Ceiling line
      ctx.strokeStyle = `rgba(${accentStr}, ${a * 0.6})`;
      ctx.beginPath();
      ctx.moveTo(vpX - hw, cy - hh);
      ctx.lineTo(vpX + hw, cy - hh);
      ctx.stroke();
    }

    // Converging vertical lines on floor (4 lines for column dividers)
    for (let c = 0; c <= NUM_COLS; c++) {
      const frac = c / NUM_COLS;
      // At z=1 (near)
      const x1 = hitL + frac * (hitR - hitL);
      const y1 = hitBot;
      // At z≈0 (far), everything converges to VP
      ctx.strokeStyle = `rgba(${accentStr}, ${gridAlpha * 0.5})`;
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.moveTo(vpX, vpY);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    // ── 4. Light pillars ──
    const pillarPositions = [-0.95, -0.55, -0.15, 0.15, 0.55, 0.95];
    for (let i = 0; i < pillarPositions.length; i++) {
      const px = vpX + pillarPositions[i] * hitHW;
      const pIntensity = 0.06 + energy * 0.12 + pulse * 0.1;
      const flicker = 0.8 + 0.2 * Math.sin(timeSec * 1.5 + i * 1.2);
      const pillarA = pIntensity * flicker;

      const pGrad = ctx.createLinearGradient(px, hitBot, px, vpY);
      pGrad.addColorStop(0, `rgba(${accentStr}, ${pillarA})`);
      pGrad.addColorStop(0.3, `rgba(${accentStr}, ${pillarA * 0.5})`);
      pGrad.addColorStop(1, `rgba(${accentStr}, 0)`);
      ctx.fillStyle = pGrad;
      ctx.fillRect(px - 3 * dpr, vpY, 6 * dpr, hitBot - vpY);
    }

    // ── 5. Blocks (sorted far-to-near) ──
    const sortedBlocks = [...blocksRef.current].sort((a, b) => a.z - b.z);

    for (const block of sortedBlocks) {
      if (block.z > 1.3) continue;

      const pos = blockToCanvas(block.col, block.row, Math.min(block.z, 1));
      const col = block.side === 'red' ? RED_COLOR : BLUE_COLOR;
      const scale = zToDepth(Math.min(block.z, 1));

      let alpha = 1;
      if (block.hitResult !== '' && block.hitResult !== 'miss') {
        const el = now - block.hitTime;
        alpha = 1 - el / 200;
        if (alpha <= 0) continue;
      } else if (block.hitResult === 'miss') {
        alpha = Math.max(0, 1 - (block.z - 1) / 0.3);
        if (alpha <= 0) continue;
      }

      const bw = pos.w;
      const bh = pos.h;
      const cornerR = Math.max(2, 4 * scale * dpr);

      // Glow halo
      ctx.shadowColor = `rgba(${col}, 0.6)`;
      ctx.shadowBlur = 15 * dpr * scale;

      // Block body
      ctx.fillStyle = `rgba(${col}, ${0.85 * alpha})`;
      ctx.beginPath();
      ctx.roundRect(pos.x - bw / 2, pos.y - bh / 2, bw, bh, cornerR);
      ctx.fill();

      // Neon border
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * alpha})`;
      ctx.lineWidth = Math.max(1, 1.5 * scale * dpr);
      ctx.beginPath();
      ctx.roundRect(pos.x - bw / 2, pos.y - bh / 2, bw, bh, cornerR);
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Inner highlight
      const innerGrad = ctx.createLinearGradient(pos.x, pos.y - bh / 2, pos.x, pos.y + bh / 2);
      innerGrad.addColorStop(0, `rgba(255, 255, 255, ${0.15 * alpha})`);
      innerGrad.addColorStop(0.5, `rgba(255, 255, 255, 0)`);
      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.roundRect(pos.x - bw / 2, pos.y - bh / 2, bw, bh, cornerR);
      ctx.fill();

      // Directional arrow
      if (block.hitResult === '' && scale > 0.15) {
        const dir = ARROW_DIRS[block.direction];
        const arrowSize = Math.min(bw, bh) * 0.3;
        ctx.save();
        ctx.translate(pos.x, pos.y);
        // Rotate based on direction
        const angle = Math.atan2(dir[1], dir[0]) - Math.PI / 2;
        ctx.rotate(angle);

        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * alpha})`;
        ctx.beginPath();
        // Arrow pointing up (rotated by angle)
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

    // ── 6. Slice halves ──
    slicesRef.current = slicesRef.current.filter((s) => {
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.3 * dpr; // gravity
      s.rotation += s.rotSpeed;
      s.life++;
      if (s.life >= s.maxLife) return false;

      const a = 1 - s.life / s.maxLife;
      const col = s.side === 'red' ? RED_COLOR : BLUE_COLOR;

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      ctx.fillStyle = `rgba(${col}, ${a * 0.8})`;
      ctx.fillRect(-s.width / 2, -s.height / 2, s.width, s.height);
      ctx.restore();

      return true;
    });

    // ── 7. Hit zone + sabers ──
    const hitLineY = hitZoneY;

    // Hit zone line
    drawNeonLine(ctx, hitL, hitLineY, hitR, hitLineY, '255, 255, 255', 0.25 + pulse * 0.15, 2 * dpr);

    // Left saber (red)
    const saberLen = height * 0.12;
    const saberBaseW = 4 * dpr;
    const lFlash = saberFlashL.current;
    const rFlash = saberFlashR.current;

    // Left saber
    const lSaberX = vpX - hitHW * 0.35;
    const lSaberW = saberBaseW * (1 + lFlash * 1.5);
    ctx.shadowColor = `rgba(${RED_COLOR}, 0.8)`;
    ctx.shadowBlur = (8 + lFlash * 20) * dpr;
    const lGrad = ctx.createLinearGradient(lSaberX, hitLineY, lSaberX, hitLineY - saberLen);
    lGrad.addColorStop(0, `rgba(${RED_COLOR}, ${0.9 + lFlash * 0.1})`);
    lGrad.addColorStop(0.6, `rgba(${RED_COLOR}, 0.6)`);
    lGrad.addColorStop(1, `rgba(${RED_COLOR}, 0.1)`);
    ctx.fillStyle = lGrad;
    ctx.fillRect(lSaberX - lSaberW / 2, hitLineY - saberLen, lSaberW, saberLen);
    // Bright core
    ctx.fillStyle = `rgba(255, 200, 200, ${0.6 + lFlash * 0.4})`;
    ctx.fillRect(lSaberX - lSaberW * 0.2, hitLineY - saberLen * 0.8, lSaberW * 0.4, saberLen * 0.8);
    // Handle
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(80, 80, 90, 0.9)';
    ctx.fillRect(lSaberX - 3 * dpr, hitLineY, 6 * dpr, 14 * dpr);

    // Right saber (blue)
    const rSaberX = vpX + hitHW * 0.35;
    const rSaberW = saberBaseW * (1 + rFlash * 1.5);
    ctx.shadowColor = `rgba(${BLUE_COLOR}, 0.8)`;
    ctx.shadowBlur = (8 + rFlash * 20) * dpr;
    const rGrad = ctx.createLinearGradient(rSaberX, hitLineY, rSaberX, hitLineY - saberLen);
    rGrad.addColorStop(0, `rgba(${BLUE_COLOR}, ${0.9 + rFlash * 0.1})`);
    rGrad.addColorStop(0.6, `rgba(${BLUE_COLOR}, 0.6)`);
    rGrad.addColorStop(1, `rgba(${BLUE_COLOR}, 0.1)`);
    ctx.fillStyle = rGrad;
    ctx.fillRect(rSaberX - rSaberW / 2, hitLineY - saberLen, rSaberW, saberLen);
    // Bright core
    ctx.fillStyle = `rgba(200, 200, 255, ${0.6 + rFlash * 0.4})`;
    ctx.fillRect(rSaberX - rSaberW * 0.2, hitLineY - saberLen * 0.8, rSaberW * 0.4, saberLen * 0.8);
    // Handle
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(80, 80, 90, 0.9)';
    ctx.fillRect(rSaberX - 3 * dpr, hitLineY, 6 * dpr, 14 * dpr);

    // Decay saber flash
    saberFlashL.current *= 0.86;
    saberFlashR.current *= 0.86;

    // ── 8. Particles ──
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    particlesRef.current = particlesRef.current.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12 * dpr;
      p.life++;
      if (p.life >= p.maxLife) return false;
      const a = 1 - p.life / p.maxLife;

      if (p.glow) {
        const gGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * dpr * 2);
        gGrad.addColorStop(0, `rgba(${p.color}, ${a * 0.6})`);
        gGrad.addColorStop(1, `rgba(${p.color}, 0)`);
        ctx.fillStyle = gGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * dpr * 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(${p.color}, ${a * 0.9})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      return true;
    });
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // ── 9. Screen effects ──

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

    // ── 10. UI overlay ──

    // Score (top-right)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${42 * dpr}px monospace`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8 * dpr;
    ctx.fillText(score.score.toLocaleString(), width - 24 * dpr, 24 * dpr);

    // Streak
    if (score.streak > 1) {
      ctx.font = `bold ${18 * dpr}px monospace`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(`${score.streak} STREAK`, width - 24 * dpr, 72 * dpr);
    }

    // Combo & multiplier
    if (score.combo > 0) {
      ctx.font = `bold ${22 * dpr}px monospace`;
      const mCol = score.multiplier >= 8 ? '255, 200, 50' : score.multiplier >= 4 ? '50, 200, 255' : '200, 200, 200';
      ctx.fillStyle = `rgba(${mCol}, 0.95)`;
      ctx.fillText(`${score.combo}x COMBO`, width - 24 * dpr, 98 * dpr);

      if (score.multiplier > 1) {
        ctx.font = `bold ${16 * dpr}px monospace`;
        ctx.fillStyle = 'rgba(255, 255, 100, 0.9)';
        ctx.fillText(`${score.multiplier}x MULTIPLIER`, width - 24 * dpr, 126 * dpr);
      }
    }
    ctx.shadowBlur = 0;

    // Energy bar (top-left)
    const ebX = 20 * dpr;
    const ebY = 24 * dpr;
    const ebW = 200 * dpr;
    const ebH = 18 * dpr;

    // Bar background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.beginPath();
    ctx.roundRect(ebX, ebY, ebW, ebH, 4 * dpr);
    ctx.fill();

    // Energy fill (red → white → blue gradient)
    if (score.energy > 0) {
      const fillW = ebW * score.energy;
      const eGrad = ctx.createLinearGradient(ebX, ebY, ebX + ebW, ebY);
      eGrad.addColorStop(0, 'rgba(220, 50, 50, 0.85)');
      eGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)');
      eGrad.addColorStop(1, 'rgba(50, 120, 255, 0.85)');
      ctx.fillStyle = eGrad;
      ctx.beginPath();
      ctx.roundRect(ebX, ebY, fillW, ebH, 4 * dpr);
      ctx.fill();
    }

    // Bar border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.roundRect(ebX, ebY, ebW, ebH, 4 * dpr);
    ctx.stroke();

    // Energy label
    ctx.textAlign = 'left';
    ctx.font = `bold ${12 * dpr}px monospace`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('ENERGY', ebX, ebY + ebH + 6 * dpr);

    // Milestone text
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
      ctx.shadowColor = `rgba(${ar}, ${ag}, ${ab}, 0.8)`;
      ctx.shadowBlur = 25 * dpr * mA;
      ctx.fillStyle = `rgba(255, 255, 255, ${mA})`;
      ctx.fillText(ms.text, vpX, mY);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Hit quality text
    if (score.lastHitText && now - score.lastHitTime < 500) {
      const el = now - score.lastHitTime;
      const prog = el / 500;
      const tA = 1 - prog;
      const tS = 1 + prog * 0.3;
      const tY = hitLineY - 60 * dpr - prog * 30 * dpr;

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
      ctx.fillText(score.lastHitText, vpX, tY);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }, [audioFeatures, accentColor, isBeat, bpm]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
