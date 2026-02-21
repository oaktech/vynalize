import { useRef, useEffect, useMemo } from 'react';
import { useStore } from '../../store';

// ── Pittsburgh Colors ────────────────────────────────────────
const GOLD = [255, 185, 15] as const;       // Pittsburgh gold
const BRIDGE_YELLOW = [255, 200, 40] as const;
const RIVER_DARK = [8, 18, 35] as const;
const SKY_TOP = [2, 2, 12] as const;
const SKY_MID = [8, 8, 25] as const;

// ── Config ───────────────────────────────────────────────────
const STAR_COUNT = 200;
const PARTICLE_MAX = 80;
const WINDOW_FLICKER_RATE = 0.02;

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
  const bpm = useStore((s) => s.bpm);

  const beatPulse = useRef(0);
  const smooth = useRef({ rms: 0, bass: 0, mid: 0, high: 0, energy: 0 });
  const particles = useRef<GoldParticle[]>([]);
  const windowStates = useRef<WindowState[][] | null>(null);
  const timeRef = useRef(0);
  const waterPhase = useRef(0);

  const stars = useMemo(() => createStars(STAR_COUNT), []);
  const buildings = useMemo(() => createSkyline(), []);

  // Initialize window states
  useEffect(() => {
    if (!windowStates.current) {
      windowStates.current = buildings.map((b) =>
        Array.from({ length: b.windowRows * b.windowCols }, () => ({
          lit: Math.random() > 0.3,
          brightness: 0.3 + Math.random() * 0.7,
          flickerTimer: Math.random() * 200,
        })),
      );
    }
  }, [buildings]);

  // Canvas resize
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

  // ── Main render ────────────────────────────────────────────
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

    // Smooth values
    const s = smooth.current;
    s.rms += (rms - s.rms) * 0.12;
    s.bass += (bass - s.bass) * 0.1;
    s.mid += (mid - s.mid) * 0.1;
    s.high += (high - s.high) * 0.1;
    s.energy += (energy - s.energy) * 0.1;

    // Beat pulse decay
    beatPulse.current *= 0.88;
    const pulse = beatPulse.current;

    timeRef.current += 1;
    const time = timeRef.current;

    // Layout
    const skylineBase = height * 0.55;   // Where buildings sit
    const waterTop = skylineBase;         // Water starts here
    const waterBottom = height;

    // ════════════════════════════════════════════════════════════
    // 1. SKY — Deep Pittsburgh night
    // ════════════════════════════════════════════════════════════

    const skyGrad = ctx.createLinearGradient(0, 0, 0, skylineBase);
    skyGrad.addColorStop(0, `rgb(${SKY_TOP[0]}, ${SKY_TOP[1]}, ${SKY_TOP[2]})`);
    skyGrad.addColorStop(0.5, `rgb(${SKY_MID[0]}, ${SKY_MID[1]}, ${SKY_MID[2]})`);
    // Subtle gold glow on horizon
    const horizonGlow = 0.05 + pulse * 0.08 + s.energy * 0.04;
    skyGrad.addColorStop(0.85, `rgba(${GOLD[0]}, ${GOLD[1]}, ${GOLD[2]}, ${horizonGlow})`);
    skyGrad.addColorStop(1, `rgba(${GOLD[0]}, ${GOLD[1]}, ${GOLD[2]}, ${horizonGlow * 0.5})`);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, skylineBase);

    // ════════════════════════════════════════════════════════════
    // 2. STARS
    // ════════════════════════════════════════════════════════════

    for (const star of stars) {
      const twinkle = 0.3 + 0.7 * Math.sin(time * 0.05 * star.twinkleSpeed + star.phase);
      const bright = twinkle * (0.5 + s.high * 0.5);
      const sz = star.size * dpr * (0.8 + pulse * 0.2);
      ctx.beginPath();
      ctx.arc(star.x * width, star.y * height, sz, 0, Math.PI * 2);
      // Some stars are gold-tinted
      if (star.phase > 4) {
        ctx.fillStyle = `rgba(${GOLD[0]}, ${GOLD[1]}, ${GOLD[2]}, ${Math.min(1, bright * 0.6)})`;
      } else {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, bright * 0.6)})`;
      }
      ctx.fill();
    }

    // ════════════════════════════════════════════════════════════
    // 3. CITY GLOW — Ambient golden light behind skyline
    // ════════════════════════════════════════════════════════════

    const glowIntensity = 0.15 + pulse * 0.2 + s.energy * 0.1;
    const cityGlow = ctx.createRadialGradient(
      width * 0.45, skylineBase, 0,
      width * 0.45, skylineBase, width * 0.5,
    );
    cityGlow.addColorStop(0, `rgba(${GOLD[0]}, ${GOLD[1]}, ${GOLD[2]}, ${glowIntensity})`);
    cityGlow.addColorStop(0.4, `rgba(${GOLD[0]}, ${GOLD[1]}, ${GOLD[2]}, ${glowIntensity * 0.3})`);
    cityGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = cityGlow;
    ctx.fillRect(0, skylineBase * 0.3, width, skylineBase * 0.7);

    // ════════════════════════════════════════════════════════════
    // 4. BUILDINGS — Pittsburgh skyline silhouettes with windows
    // ════════════════════════════════════════════════════════════

    const winStates = windowStates.current;

    buildings.forEach((b, bi) => {
      const bx = b.x * width;
      const bw = b.w * width;
      const bh = b.h * height * (1 + pulse * 0.02 + s.bass * 0.02);
      const by = skylineBase - bh;

      // Frequency-reactive: taller buildings respond more
      const freqIdx = Math.floor((bi / buildings.length) * freq.length * 0.3);
      const freqVal = (freq[freqIdx] || 0) / 255;
      const freqBump = freqVal * bh * 0.04;

      const finalH = bh + freqBump;
      const finalY = skylineBase - finalH;

      // Building body — dark with subtle gold edge
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(bx - bw / 2, finalY, bw, finalH);

      // Building type specific tops
      if (b.type === 'ppg') {
        // PPG Place — gothic spires
        const spireH = finalH * 0.12;
        ctx.beginPath();
        ctx.moveTo(bx - bw / 2, finalY);
        ctx.lineTo(bx - bw * 0.3, finalY - spireH * 0.4);
        ctx.lineTo(bx - bw * 0.15, finalY);
        ctx.lineTo(bx, finalY - spireH);
        ctx.lineTo(bx + bw * 0.15, finalY);
        ctx.lineTo(bx + bw * 0.3, finalY - spireH * 0.4);
        ctx.lineTo(bx + bw / 2, finalY);
        ctx.closePath();
        ctx.fillStyle = '#0a0a0a';
        ctx.fill();
        // Spire glow
        ctx.strokeStyle = `rgba(${GOLD[0]}, ${GOLD[1]}, ${GOLD[2]}, ${0.3 + pulse * 0.3})`;
        ctx.lineWidth = 1 * dpr;
        ctx.stroke();
      } else if (b.type === 'cathedral') {
        // Cathedral of Learning — pointed gothic top
        const spireH = finalH * 0.15;
        ctx.beginPath();
        ctx.moveTo(bx - bw / 2, finalY);
        ctx.lineTo(bx - bw * 0.3, finalY - spireH * 0.3);
        ctx.lineTo(bx - bw * 0.1, finalY - spireH * 0.6);
        ctx.lineTo(bx, finalY - spireH);
        ctx.lineTo(bx + bw * 0.1, finalY - spireH * 0.6);
        ctx.lineTo(bx + bw * 0.3, finalY - spireH * 0.3);
        ctx.lineTo(bx + bw / 2, finalY);
        ctx.closePath();
        ctx.fillStyle = '#0a0a0a';
        ctx.fill();
        ctx.strokeStyle = `rgba(${GOLD[0]}, ${GOLD[1]}, ${GOLD[2]}, ${0.25 + pulse * 0.3})`;
        ctx.lineWidth = 1 * dpr;
        ctx.stroke();
      } else if (b.type === 'ussteel') {
        // US Steel Tower — triangular crown
        const crownH = finalH * 0.06;
        ctx.beginPath();
        ctx.moveTo(bx - bw / 2, finalY);
        ctx.lineTo(bx - bw * 0.35, finalY - crownH);
        ctx.lineTo(bx + bw * 0.35, finalY - crownH);
        ctx.lineTo(bx + bw / 2, finalY);
        ctx.closePath();
        ctx.fillStyle = '#0a0a0a';
        ctx.fill();
        // Antenna
        ctx.beginPath();
        ctx.moveTo(bx, finalY - crownH);
        ctx.lineTo(bx, finalY - crownH - finalH * 0.08);
        ctx.strokeStyle = `rgba(${GOLD[0]}, ${GOLD[1]}, ${GOLD[2]}, ${0.5 + pulse * 0.3})`;
        ctx.lineWidth = 1.5 * dpr;
        ctx.stroke();
        // Blinking light on antenna
        const blinkPhase = Math.sin(time * 0.08) > 0.3;
        if (blinkPhase) {
          ctx.beginPath();
          ctx.arc(bx, finalY - crownH - finalH * 0.08, 2.5 * dpr, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 50, 50, ${0.8 + pulse * 0.2})`;
          ctx.fill();
          ctx.shadowColor = 'rgba(255, 50, 50, 0.6)';
          ctx.shadowBlur = 6 * dpr;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      } else if (b.type === 'spire' || b.type === 'tower') {
        // Simple antenna or flat top with small spire
        const spH = finalH * 0.05;
        ctx.beginPath();
        ctx.moveTo(bx, finalY);
        ctx.lineTo(bx, finalY - spH);
        ctx.strokeStyle = `rgba(${GOLD[0]}, ${GOLD[1]}, ${GOLD[2]}, 0.3)`;
        ctx.lineWidth = 1 * dpr;
        ctx.stroke();
      }

      // Building edge highlights (gold trim)
      ctx.strokeStyle = `rgba(${GOLD[0]}, ${GOLD[1]}, ${GOLD[2]}, ${0.1 + pulse * 0.1})`;
      ctx.lineWidth = 0.5 * dpr;
      ctx.strokeRect(bx - bw / 2, finalY, bw, finalH);

      // ── Windows ──
      if (winStates) {
        const ws = winStates[bi];
        const marginX = bw * 0.15;
        const marginY = finalH * 0.06;
        const winAreaW = bw - marginX * 2;
        const winAreaH = finalH - marginY * 2;
        const cellW = winAreaW / b.windowCols;
        const cellH = winAreaH / b.windowRows;
        const winW = cellW * 0.55;
        const winH = cellH * 0.5;

        for (let row = 0; row < b.windowRows; row++) {
          for (let col = 0; col < b.windowCols; col++) {
            const idx = row * b.windowCols + col;
            const win = ws[idx];

            // Flicker logic
            win.flickerTimer -= 1;
            if (win.flickerTimer <= 0) {
              win.flickerTimer = 100 + Math.random() * 400;
              if (Math.random() < WINDOW_FLICKER_RATE) {
                win.lit = !win.lit;
              }
              // On beat, light up more windows
              if (pulse > 0.3 && !win.lit && Math.random() < 0.15) {
                win.lit = true;
                win.brightness = 0.8 + Math.random() * 0.2;
              }
            }

            if (!win.lit) continue;

            const wx = bx - bw / 2 + marginX + col * cellW + (cellW - winW) / 2;
            const wy = finalY + marginY + row * cellH + (cellH - winH) / 2;

            // Window glow intensity varies with energy
            const winBright = win.brightness * (0.5 + s.energy * 0.3 + pulse * 0.2);
            const goldMix = 0.6 + Math.random() * 0.4;

            ctx.fillStyle = `rgba(${Math.floor(lerp(255, GOLD[0], goldMix))}, ${Math.floor(lerp(220, GOLD[1], goldMix))}, ${Math.floor(lerp(100, GOLD[2], goldMix))}, ${winBright * 0.85})`;
            ctx.fillRect(wx, wy, winW, winH);

            // Subtle window glow
            if (winBright > 0.6) {
              ctx.shadowColor = `rgba(${GOLD[0]}, ${GOLD[1]}, ${GOLD[2]}, 0.3)`;
              ctx.shadowBlur = 3 * dpr;
              ctx.fillRect(wx, wy, winW, winH);
              ctx.shadowBlur = 0;
            }
          }
        }
      }
    });

    // ════════════════════════════════════════════════════════════
    // 5. BRIDGES — Pittsburgh's iconic yellow bridges
    // ════════════════════════════════════════════════════════════

    const bridgeY = skylineBase - height * 0.02;

    // Draw three bridges (the Three Sisters!)
    const bridgeConfigs = [
      { x1: width * 0.15, x2: width * 0.35, sag: 0.035 },  // Roberto Clemente Bridge
      { x1: width * 0.42, x2: width * 0.62, sag: 0.03 },   // Andy Warhol Bridge
      { x1: width * 0.68, x2: width * 0.88, sag: 0.032 },  // Rachel Carson Bridge
    ];

    bridgeConfigs.forEach((bridge, bridgeIdx) => {
      const { x1, x2, sag } = bridge;
      const span = x2 - x1;

      // Bridge deck
      const deckH = 3 * dpr;
      ctx.fillStyle = `rgba(${BRIDGE_YELLOW[0]}, ${BRIDGE_YELLOW[1]}, ${BRIDGE_YELLOW[2]}, ${0.7 + pulse * 0.15})`;
      ctx.fillRect(x1, bridgeY - deckH / 2, span, deckH);

      // Bridge deck glow
      ctx.shadowColor = `rgba(${BRIDGE_YELLOW[0]}, ${BRIDGE_YELLOW[1]}, ${BRIDGE_YELLOW[2]}, ${0.4 + pulse * 0.3})`;
      ctx.shadowBlur = 8 * dpr;
      ctx.fillRect(x1, bridgeY - deckH / 2, span, deckH);
      ctx.shadowBlur = 0;

      // Suspension cables — catenary curve
      const cablePoints = 40;
      const towerH = height * 0.08;
      const sagAmount = height * sag * (1 + s.bass * 0.15);

      // Two towers
      const towerPositions = [x1 + span * 0.15, x2 - span * 0.15];
      towerPositions.forEach((tx) => {
        ctx.beginPath();
        ctx.moveTo(tx, bridgeY);
        ctx.lineTo(tx, bridgeY - towerH);
        ctx.strokeStyle = `rgba(${BRIDGE_YELLOW[0]}, ${BRIDGE_YELLOW[1]}, ${BRIDGE_YELLOW[2]}, ${0.8 + pulse * 0.1})`;
        ctx.lineWidth = 2.5 * dpr;
        ctx.stroke();
      });

      // Main cables (parabolic)
      ctx.beginPath();
      for (let i = 0; i <= cablePoints; i++) {
        const t = i / cablePoints;
        const cx = x1 + t * span;
        // Parabolic sag
        const sagT = 4 * t * (1 - t); // peaks at 0.5
        // Cable goes from tower top, sags in middle
        const towerOffset = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
        const cy = bridgeY - towerH * (1 - towerOffset) - towerH * towerOffset + sagAmount * sagT;

        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }
      ctx.strokeStyle = `rgba(${BRIDGE_YELLOW[0]}, ${BRIDGE_YELLOW[1]}, ${BRIDGE_YELLOW[2]}, ${0.6 + pulse * 0.2})`;
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();

      // Vertical suspender cables
      const suspenderCount = 12;
      for (let i = 1; i < suspenderCount; i++) {
        const t = i / suspenderCount;
        const sx = x1 + t * span;
        const sagT = 4 * t * (1 - t);
        const towerOffset = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
        const cableY = bridgeY - towerH * (1 - towerOffset) - towerH * towerOffset + sagAmount * sagT;

        ctx.beginPath();
        ctx.moveTo(sx, cableY);
        ctx.lineTo(sx, bridgeY);
        ctx.strokeStyle = `rgba(${BRIDGE_YELLOW[0]}, ${BRIDGE_YELLOW[1]}, ${BRIDGE_YELLOW[2]}, ${0.25 + pulse * 0.1})`;
        ctx.lineWidth = 0.7 * dpr;
        ctx.stroke();
      }

      // Bridge lights — audio reactive
      const lightCount = 8;
      for (let i = 0; i <= lightCount; i++) {
        const t = i / lightCount;
        const lx = x1 + t * span;

        // Light intensity varies with frequency
        const freqBin = Math.floor((bridgeIdx * lightCount + i) / (3 * lightCount) * freq.length * 0.5);
        const freqIntensity = (freq[freqBin] || 0) / 255;
        const lightBright = 0.3 + freqIntensity * 0.5 + pulse * 0.2;

        // Small light on deck
        ctx.beginPath();
        ctx.arc(lx, bridgeY - deckH, 1.5 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${GOLD[0]}, ${GOLD[1]}, ${GOLD[2]}, ${lightBright})`;
        ctx.fill();

        // Light glow
        const lgGrad = ctx.createRadialGradient(lx, bridgeY - deckH, 0, lx, bridgeY - deckH, 10 * dpr * lightBright);
        lgGrad.addColorStop(0, `rgba(${GOLD[0]}, ${GOLD[1]}, ${GOLD[2]}, ${lightBright * 0.4})`);
        lgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = lgGrad;
        ctx.beginPath();
        ctx.arc(lx, bridgeY - deckH, 10 * dpr * lightBright, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // ════════════════════════════════════════════════════════════
    // 6. WATER — Three Rivers with reflections
    // ════════════════════════════════════════════════════════════

    // Water background
    const waterGrad = ctx.createLinearGradient(0, waterTop, 0, waterBottom);
    waterGrad.addColorStop(0, `rgb(${RIVER_DARK[0]}, ${RIVER_DARK[1]}, ${RIVER_DARK[2]})`);
    waterGrad.addColorStop(1, `rgb(${Math.floor(RIVER_DARK[0] * 0.5)}, ${Math.floor(RIVER_DARK[1] * 0.5)}, ${Math.floor(RIVER_DARK[2] * 0.5)})`);
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, waterTop, width, waterBottom - waterTop);

    // Reflection of city glow in water
    waterPhase.current += 0.03 + s.bass * 0.02;
    const reflGlowIntensity = 0.08 + pulse * 0.12 + s.energy * 0.06;
    const reflGlow = ctx.createRadialGradient(
      width * 0.45, waterTop, 0,
      width * 0.45, waterTop, width * 0.4,
    );
    reflGlow.addColorStop(0, `rgba(${GOLD[0]}, ${GOLD[1]}, ${GOLD[2]}, ${reflGlowIntensity})`);
    reflGlow.addColorStop(0.5, `rgba(${GOLD[0]}, ${GOLD[1]}, ${GOLD[2]}, ${reflGlowIntensity * 0.2})`);
    reflGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = reflGlow;
    ctx.fillRect(0, waterTop, width, (waterBottom - waterTop) * 0.5);

    // Water ripple lines — audio reactive
    const rippleCount = 18;
    for (let i = 0; i < rippleCount; i++) {
      const t = (i + 0.5) / rippleCount;
      const ry = waterTop + t * (waterBottom - waterTop);
      const waveAmp = (3 + s.bass * 8 + pulse * 4) * dpr;
      const waveFreq = 0.008 + s.mid * 0.003;
      const alpha = (1 - t) * (0.06 + pulse * 0.06 + s.bass * 0.04);

      ctx.beginPath();
      for (let x = 0; x < width; x += 3) {
        const wave = Math.sin(x * waveFreq + waterPhase.current + i * 0.8) * waveAmp * (1 - t);
        if (x === 0) ctx.moveTo(x, ry + wave);
        else ctx.lineTo(x, ry + wave);
      }
      ctx.strokeStyle = `rgba(${GOLD[0]}, ${GOLD[1]}, ${GOLD[2]}, ${alpha})`;
      ctx.lineWidth = 0.8 * dpr;
      ctx.stroke();
    }

    // Bridge reflections in water (golden streaks)
    bridgeConfigs.forEach((bridge) => {
      const { x1, x2 } = bridge;
      const midX = (x1 + x2) / 2;

      // Golden reflection streak
      const streakGrad = ctx.createLinearGradient(0, waterTop, 0, waterTop + (waterBottom - waterTop) * 0.6);
      streakGrad.addColorStop(0, `rgba(${BRIDGE_YELLOW[0]}, ${BRIDGE_YELLOW[1]}, ${BRIDGE_YELLOW[2]}, ${0.12 + pulse * 0.08})`);
      streakGrad.addColorStop(0.5, `rgba(${BRIDGE_YELLOW[0]}, ${BRIDGE_YELLOW[1]}, ${BRIDGE_YELLOW[2]}, ${0.04 + pulse * 0.03})`);
      streakGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = streakGrad;

      // Wavy reflection
      const reflW = (x2 - x1) * 0.3;
      ctx.beginPath();
      for (let y = waterTop; y < waterTop + (waterBottom - waterTop) * 0.6; y += 2) {
        const wobble = Math.sin(y * 0.02 + waterPhase.current) * 8 * dpr;
        const spread = 1 + (y - waterTop) / (waterBottom - waterTop) * 0.5;
        ctx.rect(midX - reflW * spread / 2 + wobble, y, reflW * spread, 1.5);
      }
      ctx.fill();
    });

    // ════════════════════════════════════════════════════════════
    // 7. GOLD PARTICLES — Rise from city on beats
    // ════════════════════════════════════════════════════════════

    // Spawn particles on beats
    if (pulse > 0.5) {
      const spawnCount = Math.floor(3 + pulse * 5);
      for (let i = 0; i < spawnCount && particles.current.length < PARTICLE_MAX; i++) {
        particles.current.push({
          x: width * (0.1 + Math.random() * 0.8),
          y: skylineBase - Math.random() * height * 0.15,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -(1 + Math.random() * 3),
          size: 1 + Math.random() * 2.5,
          life: 0,
          maxLife: 60 + Math.random() * 80,
          brightness: 0.5 + Math.random() * 0.5,
        });
      }
    }

    // Update and draw particles
    particles.current = particles.current.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy -= 0.02; // Float upward faster over time
      p.vx *= 0.99;
      p.life++;

      if (p.life >= p.maxLife) return false;

      const progress = p.life / p.maxLife;
      const alpha = progress < 0.1 ? progress / 0.1 : 1 - Math.pow((progress - 0.1) / 0.9, 2);
      const sz = p.size * dpr * (1 - progress * 0.5);

      ctx.beginPath();
      ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${GOLD[0]}, ${GOLD[1]}, ${GOLD[2]}, ${alpha * p.brightness})`;
      ctx.fill();

      // Glow
      if (alpha > 0.3) {
        ctx.shadowColor = `rgba(${GOLD[0]}, ${GOLD[1]}, ${GOLD[2]}, ${alpha * 0.5})`;
        ctx.shadowBlur = 4 * dpr;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      return true;
    });

    // ════════════════════════════════════════════════════════════
    // 8. FREQUENCY BARS — Golden bars along the bottom of the water
    // ════════════════════════════════════════════════════════════

    const barCount = 64;
    const barW = (width / barCount) * 0.6;
    const barGap = width / barCount;
    const maxBarH = (waterBottom - waterTop) * 0.35;

    for (let i = 0; i < barCount; i++) {
      const freqIdx = Math.floor((i / barCount) * freq.length * 0.6);
      const val = (freq[freqIdx] || 0) / 255;
      const barH = val * maxBarH * (0.6 + s.energy * 0.4);

      if (barH < 1) continue;

      const bx = i * barGap + (barGap - barW) / 2;
      const by = waterBottom - barH;
      const barAlpha = 0.15 + val * 0.25;

      ctx.fillStyle = `rgba(${GOLD[0]}, ${GOLD[1]}, ${GOLD[2]}, ${barAlpha})`;
      ctx.fillRect(bx, by, barW, barH);
    }

    // ════════════════════════════════════════════════════════════
    // 9. BEAT FLASH — Golden flash on big beats
    // ════════════════════════════════════════════════════════════

    if (pulse > 0.15) {
      // Full-screen golden flash
      ctx.fillStyle = `rgba(${GOLD[0]}, ${GOLD[1]}, ${GOLD[2]}, ${pulse * 0.06})`;
      ctx.fillRect(0, 0, width, height);

      // Radial burst from city center
      const burstGrad = ctx.createRadialGradient(
        width * 0.45, skylineBase, 0,
        width * 0.45, skylineBase, width * 0.35 * pulse,
      );
      burstGrad.addColorStop(0, `rgba(${GOLD[0]}, ${GOLD[1]}, ${GOLD[2]}, ${pulse * 0.12})`);
      burstGrad.addColorStop(0.5, `rgba(${GOLD[0]}, ${GOLD[1]}, ${GOLD[2]}, ${pulse * 0.04})`);
      burstGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = burstGrad;
      ctx.fillRect(0, 0, width, height);
    }

    // ════════════════════════════════════════════════════════════
    // 10. Vignette — Dark edges
    // ════════════════════════════════════════════════════════════

    // Top vignette
    const vigTop = ctx.createLinearGradient(0, 0, 0, height * 0.15);
    vigTop.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
    vigTop.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = vigTop;
    ctx.fillRect(0, 0, width, height * 0.15);

    // Side vignettes
    const vigLeft = ctx.createLinearGradient(0, 0, width * 0.1, 0);
    vigLeft.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
    vigLeft.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = vigLeft;
    ctx.fillRect(0, 0, width * 0.1, height);

    const vigRight = ctx.createLinearGradient(width, 0, width * 0.9, 0);
    vigRight.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
    vigRight.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = vigRight;
    ctx.fillRect(width * 0.9, 0, width * 0.1, height);

  }, [audioFeatures, accentColor, isBeat, bpm, stars, buildings]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
