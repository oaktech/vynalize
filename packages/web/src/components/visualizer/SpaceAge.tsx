import { useRef, useEffect, useMemo } from 'react';
import { useStore } from '../../store';

// ── Config ───────────────────────────────────────────────────

const STAR_COUNT = 200;

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
    y: Math.random(),
    size: 0.5 + Math.random() * 1.5,
    speed: 0.3 + Math.random() * 0.7,
  }));
}

// ── LED dots along borders ──────────────────────────────────

interface LedDot {
  t: number; // normalized position along edge
  pos: 'top' | 'bottom' | 'divider';
  panelEdge: number; // which panel divider (0-2 for dividers)
}

function createLedDots(): LedDot[] {
  const dots: LedDot[] = [];
  // Top edge: ~35 dots
  for (let i = 0; i < 35; i++) {
    dots.push({ t: i / 34, pos: 'top', panelEdge: 0 });
  }
  // Bottom edge: ~35 dots
  for (let i = 0; i < 35; i++) {
    dots.push({ t: i / 34, pos: 'bottom', panelEdge: 0 });
  }
  // 3 inter-panel dividers: ~24 dots each
  for (let d = 0; d < 3; d++) {
    for (let i = 0; i < 24; i++) {
      dots.push({ t: i / 23, pos: 'divider', panelEdge: d });
    }
  }
  return dots;
}

// ── Constellations (accurate shapes with edge connections) ──

interface ConstellationDef {
  stars: { x: number; y: number }[];
  edges: [number, number][];
}

const CONSTELLATIONS: ConstellationDef[] = [
  // Big Dipper (handle → bowl, closing back to junction)
  {
    stars: [
      { x: 0.15, y: 0.14 }, // 0: Alkaid (handle tip)
      { x: 0.27, y: 0.10 }, // 1: Mizar
      { x: 0.40, y: 0.13 }, // 2: Alioth
      { x: 0.52, y: 0.18 }, // 3: Megrez (junction)
      { x: 0.68, y: 0.15 }, // 4: Dubhe
      { x: 0.66, y: 0.28 }, // 5: Merak
      { x: 0.50, y: 0.30 }, // 6: Phecda
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]],
  },
  // Little Dipper (handle from Polaris → bowl, closing back)
  {
    stars: [
      { x: 0.75, y: 0.08 }, // 0: Polaris
      { x: 0.65, y: 0.13 }, // 1: Yildun
      { x: 0.52, y: 0.16 }, // 2: Epsilon UMi
      { x: 0.40, y: 0.22 }, // 3: Zeta UMi (junction)
      { x: 0.28, y: 0.19 }, // 4: Eta UMi
      { x: 0.30, y: 0.32 }, // 5: Pherkad
      { x: 0.42, y: 0.34 }, // 6: Kochab
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]],
  },
  // Orion (shoulders → belt → feet, branching)
  {
    stars: [
      { x: 0.28, y: 0.08 }, // 0: Betelgeuse (left shoulder)
      { x: 0.67, y: 0.10 }, // 1: Bellatrix (right shoulder)
      { x: 0.37, y: 0.21 }, // 2: Alnitak (belt left)
      { x: 0.47, y: 0.22 }, // 3: Alnilam (belt center)
      { x: 0.57, y: 0.21 }, // 4: Mintaka (belt right)
      { x: 0.30, y: 0.38 }, // 5: Saiph (left foot)
      { x: 0.64, y: 0.36 }, // 6: Rigel (right foot)
    ],
    edges: [[0,1],[0,2],[2,3],[3,4],[1,4],[2,5],[4,6]],
  },
  // Cassiopeia (W shape)
  {
    stars: [
      { x: 0.14, y: 0.22 }, // 0: Epsilon Cas
      { x: 0.30, y: 0.08 }, // 1: Delta Cas
      { x: 0.47, y: 0.24 }, // 2: Gamma Cas (center)
      { x: 0.62, y: 0.06 }, // 3: Schedar
      { x: 0.78, y: 0.18 }, // 4: Caph
    ],
    edges: [[0,1],[1,2],[2,3],[3,4]],
  },
  // Scorpius (curving tail with stinger)
  {
    stars: [
      { x: 0.12, y: 0.10 }, // 0: Dschubba (head)
      { x: 0.20, y: 0.14 }, // 1: Acrab
      { x: 0.30, y: 0.16 }, // 2: Antares (heart)
      { x: 0.40, y: 0.20 }, // 3: Tau Sco
      { x: 0.50, y: 0.26 }, // 4: Epsilon Sco
      { x: 0.60, y: 0.32 }, // 5: Mu Sco
      { x: 0.70, y: 0.34 }, // 6: Zeta Sco
      { x: 0.78, y: 0.30 }, // 7: Lambda (stinger curves up)
      { x: 0.84, y: 0.24 }, // 8: Upsilon (stinger tip)
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8]],
  },
  // Corona Borealis (Northern Crown arc)
  {
    stars: [
      { x: 0.15, y: 0.28 }, // 0: Theta CrB
      { x: 0.25, y: 0.16 }, // 1: Beta CrB
      { x: 0.40, y: 0.10 }, // 2: Alphecca (brightest)
      { x: 0.55, y: 0.12 }, // 3: Gamma CrB
      { x: 0.68, y: 0.20 }, // 4: Delta CrB
      { x: 0.78, y: 0.30 }, // 5: Epsilon CrB
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5]],
  },
];

const CONSTELLATION_DRAW = 4; // seconds to trace all points
const CONSTELLATION_HOLD = 5; // seconds fully visible
const CONSTELLATION_FADE = 0.6; // seconds to fade out

// ── Pre-computed alien structure heights ─────────────────────

const SPIRE_POSITIONS = [0.15, 0.3, 0.55, 0.8];
const SPIRE_HEIGHTS = [0.09, 0.085, 0.095, 0.08];
const DOME_POSITIONS = [0.4, 0.7];

// ── Component ────────────────────────────────────────────────

export default function SpaceAge({ accentColor }: { accentColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioFeatures = useStore((s) => s.audioFeatures);
  const isBeat = useStore((s) => s.isBeat);
  const bpm = useStore((s) => s.bpm);

  const beatPulse = useRef(0);
  const smooth = useRef({ rms: 0, bass: 0, mid: 0, high: 0, energy: 0 });
  const exhaustParticles = useRef<
    { x: number; y: number; vy: number; alpha: number; size: number }[]
  >([]);
  const cometAngle = useRef(0);
  const accretionAngle = useRef(0);
  const shootingStars = useRef<
    { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; panel: number }[]
  >([]);
  const lastShootingStar = useRef(0);

  const stars = useMemo(() => createStars(STAR_COUNT), []);
  const ledDots = useMemo(() => createLedDots(), []);

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

  // Beat tracking
  useEffect(() => {
    if (isBeat) beatPulse.current = 1;
  }, [isBeat]);

  // Main render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioFeatures) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const dpr = devicePixelRatio;
    const [ar, ag, ab] = hexToRgb(accentColor);
    const now = performance.now() / 1000;

    const { rms, bass, mid, high, energy } = audioFeatures;

    // Smooth audio (fast attack, slow decay — matches SpectrumBars)
    const s = smooth.current;
    s.rms += (rms - s.rms) * (rms > s.rms ? 0.4 : 0.15);
    s.bass += (bass - s.bass) * (bass > s.bass ? 0.4 : 0.15);
    s.mid += (mid - s.mid) * (mid > s.mid ? 0.4 : 0.15);
    s.high += (high - s.high) * (high > s.high ? 0.4 : 0.15);
    s.energy += (energy - s.energy) * (energy > s.energy ? 0.4 : 0.15);

    // Beat pulse decay
    beatPulse.current *= 0.85;
    const pulse = beatPulse.current;

    const beatsPerSec = (bpm || 120) / 60;
    const panelW = width / 4;
    const panelH = height;
    const horizonY = panelH * 0.52;

    // ── Clear + shared starfield ──
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    for (const star of stars) {
      const twinkle =
        0.4 + 0.6 * Math.sin(now * star.speed + star.x * 100);
      const sz = star.size * dpr * (0.8 + pulse * 0.2);
      ctx.beginPath();
      ctx.arc(star.x * width, star.y * height, sz, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, twinkle * 0.5)})`;
      ctx.fill();
    }

    // ════════════════════════════════════════════════════════════
    // PANEL 1 (position 3): Rocket Launch (pink/magenta, bass-reactive)
    // ════════════════════════════════════════════════════════════
    ctx.save();
    ctx.beginPath();
    ctx.rect(panelW * 2, 0, panelW, panelH);
    ctx.clip();

    const p1x = panelW * 2;

    // Sky (dark space)
    const p1Sky = ctx.createLinearGradient(p1x, 0, p1x, horizonY);
    p1Sky.addColorStop(0, '#0f0014');
    p1Sky.addColorStop(1, '#2a001e');
    ctx.fillStyle = p1Sky;
    ctx.fillRect(p1x, 0, panelW, horizonY);

    // Vivid pink/magenta horizon bands
    const p1Colors = [
      '#660033', '#990055', '#cc0066', '#ee2288',
      '#ff55bb', '#ff44aa', '#ee1188', '#bb0066',
    ];
    const p1BandH = (panelH - horizonY) / p1Colors.length;
    for (let b = 0; b < p1Colors.length; b++) {
      ctx.fillStyle = p1Colors[b];
      ctx.fillRect(p1x, horizonY + b * p1BandH, panelW, p1BandH + 1);
    }

    // Jagged mountain terrain
    const terrainY1 = panelH * 0.78;
    ctx.beginPath();
    ctx.moveTo(p1x, panelH);
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const mtnH =
        (Math.abs(Math.sin(t * 7.3 + 0.5)) * 0.35 +
          Math.abs(Math.sin(t * 13.1 + 1.2)) * 0.25 +
          Math.abs(Math.sin(t * 23.7 + 0.3)) * 0.15) *
        panelH *
        0.12;
      ctx.lineTo(p1x + t * panelW, terrainY1 - mtnH);
    }
    ctx.lineTo(p1x + panelW, panelH);
    ctx.closePath();
    ctx.fillStyle = '#0a000a';
    ctx.fill();

    // Rocket
    const rocketBaseY = panelH * 0.45;
    const rocketOsc = Math.sin(now * 1.5) * panelH * 0.015;
    const bassBoost = s.bass * panelH * 0.05 + pulse * panelH * 0.03;
    const rocketY = rocketBaseY + rocketOsc - bassBoost;
    const rocketX = p1x + panelW * 0.5;
    const rocketW = panelW * 0.08;
    const rocketH = panelH * 0.18;

    // Body
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(rocketX - rocketW / 2, rocketY, rocketW, rocketH);

    // Nose cone
    ctx.beginPath();
    ctx.moveTo(rocketX, rocketY - rocketH * 0.25);
    ctx.lineTo(rocketX - rocketW / 2, rocketY);
    ctx.lineTo(rocketX + rocketW / 2, rocketY);
    ctx.closePath();
    ctx.fillStyle = '#ff3388';
    ctx.fill();

    // Left fin
    ctx.beginPath();
    ctx.moveTo(rocketX - rocketW / 2, rocketY + rocketH);
    ctx.lineTo(rocketX - rocketW, rocketY + rocketH + rocketH * 0.15);
    ctx.lineTo(rocketX - rocketW / 2, rocketY + rocketH * 0.75);
    ctx.closePath();
    ctx.fillStyle = '#ff3388';
    ctx.fill();

    // Right fin
    ctx.beginPath();
    ctx.moveTo(rocketX + rocketW / 2, rocketY + rocketH);
    ctx.lineTo(rocketX + rocketW, rocketY + rocketH + rocketH * 0.15);
    ctx.lineTo(rocketX + rocketW / 2, rocketY + rocketH * 0.75);
    ctx.closePath();
    ctx.fillStyle = '#ff3388';
    ctx.fill();

    // Porthole
    ctx.beginPath();
    ctx.arc(rocketX, rocketY + rocketH * 0.3, rocketW * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = '#66ccff';
    ctx.fill();
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();

    // Exhaust plume (4 concentric flame shapes)
    const exhaustLen = (s.bass + pulse) * panelH * 0.15 + panelH * 0.06;
    const flameBase = rocketY + rocketH;
    const flameColors = [
      'rgba(255,255,255,0.9)',
      'rgba(255,150,200,0.7)',
      'rgba(200,0,100,0.5)',
      'rgba(100,0,50,0.3)',
    ];
    const flameWidths = [0.3, 0.5, 0.7, 1.0];
    for (let f = flameColors.length - 1; f >= 0; f--) {
      const fw = rocketW * flameWidths[f];
      const fl = exhaustLen * (0.5 + f * 0.2);
      ctx.beginPath();
      ctx.moveTo(rocketX - fw, flameBase);
      ctx.quadraticCurveTo(
        rocketX - fw * 0.5,
        flameBase + fl * 0.6,
        rocketX,
        flameBase + fl,
      );
      ctx.quadraticCurveTo(
        rocketX + fw * 0.5,
        flameBase + fl * 0.6,
        rocketX + fw,
        flameBase,
      );
      ctx.closePath();
      ctx.fillStyle = flameColors[f];
      ctx.shadowColor = '#ff66aa';
      ctx.shadowBlur = (f === 0 ? 20 : 10) * dpr;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Exhaust particles
    if (Math.random() < 0.3 + s.bass * 0.7) {
      exhaustParticles.current.push({
        x: rocketX + (Math.random() - 0.5) * rocketW * 0.8,
        y: flameBase + exhaustLen * 0.5,
        vy: 1 + Math.random() * 2,
        alpha: 0.8,
        size: 1 + Math.random() * 2,
      });
    }
    if (exhaustParticles.current.length > 15) {
      exhaustParticles.current = exhaustParticles.current.slice(-15);
    }
    exhaustParticles.current = exhaustParticles.current.filter((p) => {
      p.y += p.vy * dpr;
      p.alpha -= 0.02;
      if (p.alpha <= 0 || p.y > panelH) return false;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * dpr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,180,220,${p.alpha})`;
      ctx.fill();
      return true;
    });

    // Constellation sequential draw → hold → fade
    const conCycle = CONSTELLATION_DRAW + CONSTELLATION_HOLD + CONSTELLATION_FADE;
    const conTime = now % (conCycle * CONSTELLATIONS.length);
    const conIdx = Math.floor(conTime / conCycle) % CONSTELLATIONS.length;
    const conElapsed = conTime - conIdx * conCycle;
    const con = CONSTELLATIONS[conIdx];
    const numStars = con.stars.length;

    let drawProg: number;
    let fadeAlpha: number;
    if (conElapsed < CONSTELLATION_DRAW) {
      drawProg = conElapsed / CONSTELLATION_DRAW;
      fadeAlpha = 1;
    } else if (conElapsed < CONSTELLATION_DRAW + CONSTELLATION_HOLD) {
      drawProg = 1;
      fadeAlpha = 1;
    } else {
      drawProg = 1;
      fadeAlpha = 1 - (conElapsed - CONSTELLATION_DRAW - CONSTELLATION_HOLD) / CONSTELLATION_FADE;
    }

    const pointProg = drawProg * (numStars - 1);
    const litUpTo = Math.floor(pointProg); // stars 0..litUpTo fully visible
    const frac = pointProg - litUpTo;
    const nextStar = litUpTo + 1;
    const lineAlpha = fadeAlpha * (0.25 + pulse * 0.5);

    // Draw complete edges (both endpoints fully lit)
    ctx.strokeStyle = `rgba(255,200,255,${lineAlpha})`;
    ctx.lineWidth = 1 * dpr;
    for (const [a, b] of con.edges) {
      if (a <= litUpTo && b <= litUpTo) {
        ctx.beginPath();
        ctx.moveTo(p1x + con.stars[a].x * panelW, con.stars[a].y * panelH);
        ctx.lineTo(p1x + con.stars[b].x * panelW, con.stars[b].y * panelH);
        ctx.stroke();
      }
    }

    // Draw edges being traced (one end is the appearing star)
    if (nextStar < numStars && frac > 0) {
      for (const [a, b] of con.edges) {
        let fromIdx: number, toIdx: number;
        if (a === nextStar && b <= litUpTo) { fromIdx = b; toIdx = a; }
        else if (b === nextStar && a <= litUpTo) { fromIdx = a; toIdx = b; }
        else continue;
        const fx = p1x + con.stars[fromIdx].x * panelW;
        const fy = con.stars[fromIdx].y * panelH;
        const tx = p1x + con.stars[toIdx].x * panelW;
        const ty = con.stars[toIdx].y * panelH;
        ctx.strokeStyle = `rgba(255,200,255,${lineAlpha})`;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + (tx - fx) * frac, fy + (ty - fy) * frac);
        ctx.stroke();
      }
    }

    // Draw fully lit star dots
    for (let i = 0; i <= litUpTo && i < numStars; i++) {
      const age = pointProg - i;
      const pop = age < 0.5 ? 1 + (0.5 - age) * 1.4 : 1;
      const px = p1x + con.stars[i].x * panelW;
      const py = con.stars[i].y * panelH;
      if (age < 0.8) {
        ctx.beginPath();
        ctx.arc(px, py, 6 * dpr * pop, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,200,255,${fadeAlpha * (0.8 - age) * 0.4})`;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(px, py, 2.5 * dpr * Math.min(pop, 1.3), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,220,255,${fadeAlpha * Math.min(1, (0.6 + pulse * 0.4) * pop)})`;
      ctx.fill();
    }

    // Draw appearing star with pop-in glow
    if (nextStar < numStars && frac > 0) {
      const px = p1x + con.stars[nextStar].x * panelW;
      const py = con.stars[nextStar].y * panelH;
      const pop = 1 + (1 - frac) * 0.7;
      ctx.beginPath();
      ctx.arc(px, py, 6 * dpr * pop, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,200,255,${fadeAlpha * frac * 0.35})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, 2.5 * dpr * Math.min(pop, 1.3), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,220,255,${fadeAlpha * frac * (0.6 + pulse * 0.4)})`;
      ctx.fill();
    }

    // Vignette
    const vig1 = ctx.createRadialGradient(
      p1x + panelW / 2, panelH / 2, panelW * 0.2,
      p1x + panelW / 2, panelH / 2, panelW * 0.7,
    );
    vig1.addColorStop(0, 'rgba(0,0,0,0)');
    vig1.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = vig1;
    ctx.fillRect(p1x, 0, panelW, panelH);

    ctx.restore();

    // ════════════════════════════════════════════════════════════
    // PANEL 2: Comet/Meteorite (deep blue, mid-reactive)
    // ════════════════════════════════════════════════════════════
    ctx.save();
    ctx.beginPath();
    ctx.rect(panelW, 0, panelW, panelH);
    ctx.clip();

    const p2x = panelW;

    // Sky (dark space)
    const p2Sky = ctx.createLinearGradient(p2x, 0, p2x, horizonY);
    p2Sky.addColorStop(0, '#000010');
    p2Sky.addColorStop(1, '#000828');
    ctx.fillStyle = p2Sky;
    ctx.fillRect(p2x, 0, panelW, horizonY);

    // Vivid blue/cyan horizon bands
    const p2Colors = [
      '#001155', '#0033aa', '#0055dd', '#0077ff',
      '#2299ff', '#0088ff', '#0055cc', '#003399',
    ];
    const p2BandH = (panelH - horizonY) / p2Colors.length;
    for (let b = 0; b < p2Colors.length; b++) {
      ctx.fillStyle = p2Colors[b];
      ctx.fillRect(p2x, horizonY + b * p2BandH, panelW, p2BandH + 1);
    }

    // Rolling hills
    const terrainY2 = panelH * 0.82;
    ctx.beginPath();
    ctx.moveTo(p2x, panelH);
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const hillH =
        (Math.sin(t * Math.PI * 2.5 + 1.0) * 0.5 + 0.5) * panelH * 0.06;
      ctx.lineTo(p2x + t * panelW, terrainY2 - hillH);
    }
    ctx.lineTo(p2x + panelW, panelH);
    ctx.closePath();
    ctx.fillStyle = '#020210';
    ctx.fill();

    // Comet position (arcs across panel)
    cometAngle.current += beatsPerSec * 0.005;
    const cometX = p2x + panelW * (0.3 + 0.4 * Math.sin(cometAngle.current * 0.7));
    const cometY = panelH * (0.2 + 0.15 * Math.cos(cometAngle.current * 0.5));
    const cometR = (12 + s.mid * 15 + pulse * 8) * dpr;

    // Satellite dishes pointing at comet
    const dishes = [
      { x: p2x + panelW * 0.2, y: terrainY2 - panelH * 0.04 },
      { x: p2x + panelW * 0.6, y: terrainY2 - panelH * 0.02 },
      { x: p2x + panelW * 0.85, y: terrainY2 - panelH * 0.03 },
    ];
    for (const dish of dishes) {
      const angle = Math.atan2(cometY - dish.y, cometX - dish.x);
      ctx.save();
      ctx.translate(dish.x, dish.y);
      ctx.rotate(angle);
      // Pole
      ctx.fillStyle = '#334';
      ctx.fillRect(-2 * dpr, -1 * dpr, 15 * dpr, 2 * dpr);
      // Dish (half-ellipse)
      ctx.beginPath();
      ctx.ellipse(15 * dpr, 0, 6 * dpr, 10 * dpr, 0, -Math.PI / 2, Math.PI / 2);
      ctx.fillStyle = '#556';
      ctx.fill();
      ctx.restore();
      // Base triangle
      ctx.beginPath();
      ctx.moveTo(dish.x - 5 * dpr, dish.y);
      ctx.lineTo(dish.x + 5 * dpr, dish.y);
      ctx.lineTo(dish.x, dish.y + 12 * dpr);
      ctx.closePath();
      ctx.fillStyle = '#334';
      ctx.fill();
    }

    // Debris trail (two-tone: blue ion + orange dust)
    const trailLen = 30;
    for (let i = trailLen; i >= 0; i--) {
      const t = i / trailLen;
      const tx = cometX - t * panelW * 0.35;
      const ty = cometY + t * panelH * 0.12 + Math.sin(t * 5 + now) * 8;
      const shimmer = 0.3 + 0.3 * Math.sin(now * 3 + i * 0.5);
      const sz = cometR * (1 - t * 0.8) * 0.3;
      // Blue ion
      ctx.beginPath();
      ctx.arc(tx, ty - 3 * dpr, sz, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100,150,255,${(1 - t) * shimmer * 0.5})`;
      ctx.fill();
      // Orange dust
      ctx.beginPath();
      ctx.arc(tx, ty + 3 * dpr, sz * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,160,60,${(1 - t) * shimmer * 0.3})`;
      ctx.fill();
    }

    // Comet body
    const cometGlow = ctx.createRadialGradient(
      cometX, cometY, 0,
      cometX, cometY, cometR * 2.5,
    );
    cometGlow.addColorStop(0, 'rgba(255,255,255,0.9)');
    cometGlow.addColorStop(0.3, 'rgba(100,180,255,0.6)');
    cometGlow.addColorStop(1, 'rgba(0,40,120,0)');
    ctx.fillStyle = cometGlow;
    ctx.beginPath();
    ctx.arc(cometX, cometY, cometR * 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cometX, cometY, cometR, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#4488ff';
    ctx.shadowBlur = 20 * dpr;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Beat sparkles
    if (pulse > 0.3) {
      const sparkCount = 8 + Math.floor(pulse * 4);
      for (let i = 0; i < sparkCount; i++) {
        const a = (i / sparkCount) * Math.PI * 2 + now * 2;
        const dist = cometR * (1.5 + pulse * 2);
        const sx = cometX + Math.cos(a) * dist;
        const sy = cometY + Math.sin(a) * dist;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${pulse * 0.8})`;
        ctx.fill();
      }
    }

    // Vignette
    const vig2 = ctx.createRadialGradient(
      p2x + panelW / 2, panelH / 2, panelW * 0.2,
      p2x + panelW / 2, panelH / 2, panelW * 0.7,
    );
    vig2.addColorStop(0, 'rgba(0,0,0,0)');
    vig2.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = vig2;
    ctx.fillRect(p2x, 0, panelW, panelH);

    ctx.restore();

    // ════════════════════════════════════════════════════════════
    // PANEL 3 (position 1): Eclipse (warm amber/orange, high-reactive)
    // ════════════════════════════════════════════════════════════
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, panelW, panelH);
    ctx.clip();

    const p3x = 0;

    // Sky (dark space)
    const p3Sky = ctx.createLinearGradient(p3x, 0, p3x, horizonY);
    p3Sky.addColorStop(0, '#0a0500');
    p3Sky.addColorStop(1, '#1a0800');
    ctx.fillStyle = p3Sky;
    ctx.fillRect(p3x, 0, panelW, horizonY);

    // Vivid orange/amber horizon bands
    const p3Colors = [
      '#882200', '#bb4400', '#dd6600', '#ff8800',
      '#ffaa22', '#ff9911', '#dd6600', '#aa3300',
    ];
    const p3BandH = (panelH - horizonY) / p3Colors.length;
    for (let b = 0; b < p3Colors.length; b++) {
      ctx.fillStyle = p3Colors[b];
      ctx.fillRect(p3x, horizonY + b * p3BandH, panelW, p3BandH + 1);
    }

    // Mesa terrain (3 layers with parallax)
    const mesaColors = ['#0a0400', '#080300', '#050200'];
    const mesaYBase = [panelH * 0.8, panelH * 0.83, panelH * 0.86];
    for (let layer = 0; layer < 3; layer++) {
      ctx.beginPath();
      ctx.moveTo(p3x, panelH);
      const mY = mesaYBase[layer];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const mesa = Math.max(
          (Math.sin(t * Math.PI * 1.5 + layer * 2) > 0.3 ? 1 : 0) *
            panelH * 0.04 * (1 - layer * 0.3),
          (Math.sin(t * Math.PI * 3 + layer * 1.5 + 0.7) > 0.5 ? 1 : 0) *
            panelH * 0.025 * (1 - layer * 0.2),
        );
        ctx.lineTo(p3x + t * panelW, mY - mesa);
      }
      ctx.lineTo(p3x + panelW, panelH);
      ctx.closePath();
      ctx.fillStyle = mesaColors[layer];
      ctx.fill();
    }

    // Eclipse
    const eclCenterX = p3x + panelW * 0.5;
    const eclCenterY = panelH * 0.38;
    const sunBase = panelW * 0.18;

    // Compressed audio for sun reactivity — quiet mic signals boosted into visible range
    const bHigh = boost(s.high, 5.0);
    const bBass = boost(s.bass, 3.5);

    const sunRadius = sunBase * (1 + pulse * 0.15 + bHigh * 0.15);
    const moonOffset = Math.sin(now * 0.1) * sunBase * 0.15;

    // Corona (3 concentric radial gradients — pulse size & brightness)
    const coronaBright = 0.3 + bHigh * 1.8 + pulse * 1.2;
    for (let c = 2; c >= 0; c--) {
      const cRadius = sunRadius * (2.5 + c * 0.8 + pulse * 0.6);
      const cGrad = ctx.createRadialGradient(
        eclCenterX, eclCenterY, sunRadius * 0.8,
        eclCenterX, eclCenterY, cRadius,
      );
      cGrad.addColorStop(0, `rgba(255,180,50,${Math.min(1, coronaBright * 0.2 / (c + 1))})`);
      cGrad.addColorStop(0.5, `rgba(255,120,20,${Math.min(1, coronaBright * 0.12 / (c + 1))})`);
      cGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.arc(eclCenterX, eclCenterY, cRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Corona ray triangles — longer on beats, rotate steadily
    const rayCount = 12;
    for (let i = 0; i < rayCount; i++) {
      const a = (i / rayCount) * Math.PI * 2 + now * 0.15;
      const rayLen = sunRadius * (0.6 + bHigh * 2.0 + pulse * 1.2);
      const rayW = 0.09 + pulse * 0.03;
      ctx.beginPath();
      ctx.moveTo(
        eclCenterX + Math.cos(a - rayW) * sunRadius,
        eclCenterY + Math.sin(a - rayW) * sunRadius,
      );
      ctx.lineTo(
        eclCenterX + Math.cos(a) * (sunRadius + rayLen),
        eclCenterY + Math.sin(a) * (sunRadius + rayLen),
      );
      ctx.lineTo(
        eclCenterX + Math.cos(a + rayW) * sunRadius,
        eclCenterY + Math.sin(a + rayW) * sunRadius,
      );
      ctx.closePath();
      ctx.fillStyle = `rgba(255,160,40,${0.06 + coronaBright * 0.08})`;
      ctx.fill();
    }

    // Sun disk — glow pulses on beat
    ctx.shadowColor = '#ff8800';
    ctx.shadowBlur = (10 + pulse * 25 + bHigh * 20) * dpr;
    const sunGrad = ctx.createRadialGradient(
      eclCenterX, eclCenterY, 0,
      eclCenterX, eclCenterY, sunRadius,
    );
    sunGrad.addColorStop(0, '#ffcc44');
    sunGrad.addColorStop(0.7, '#ff8822');
    sunGrad.addColorStop(1, '#cc5500');
    ctx.beginPath();
    ctx.arc(eclCenterX, eclCenterY, sunRadius, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Moon disk (eclipse) — size stays fixed so crescent shifts on pulse
    ctx.beginPath();
    ctx.arc(
      eclCenterX + moonOffset,
      eclCenterY - sunBase * 0.05,
      sunBase * 0.92,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = '#000';
    ctx.fill();

    // Solar prominences — larger + more reactive
    const promAngles = [0.5, 2.3, 4.1];
    for (const pa of promAngles) {
      const pLen = sunRadius * (0.12 + bHigh * 0.5 + pulse * 0.3);
      const pxp = eclCenterX + Math.cos(pa) * sunRadius;
      const pyp = eclCenterY + Math.sin(pa) * sunRadius;
      const ex = eclCenterX + Math.cos(pa) * (sunRadius + pLen);
      const ey = eclCenterY + Math.sin(pa) * (sunRadius + pLen);
      const cxp = eclCenterX + Math.cos(pa + 0.3) * (sunRadius + pLen * 0.7);
      const cyp = eclCenterY + Math.sin(pa + 0.3) * (sunRadius + pLen * 0.7);
      ctx.beginPath();
      ctx.moveTo(pxp, pyp);
      ctx.quadraticCurveTo(cxp, cyp, ex, ey);
      ctx.strokeStyle = `rgba(255,140,30,${0.4 + pulse * 0.5 + bHigh * 0.4})`;
      ctx.lineWidth = (2 + pulse * 2) * dpr;
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur = (8 + pulse * 12) * dpr;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Vignette
    const vig3 = ctx.createRadialGradient(
      p3x + panelW / 2, panelH / 2, panelW * 0.2,
      p3x + panelW / 2, panelH / 2, panelW * 0.7,
    );
    vig3.addColorStop(0, 'rgba(0,0,0,0)');
    vig3.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = vig3;
    ctx.fillRect(p3x, 0, panelW, panelH);

    ctx.restore();

    // ════════════════════════════════════════════════════════════
    // PANEL 4: Black Hole (green, energy/rms-reactive)
    // ════════════════════════════════════════════════════════════
    ctx.save();
    ctx.beginPath();
    ctx.rect(panelW * 3, 0, panelW, panelH);
    ctx.clip();

    const p4x = panelW * 3;

    // Sky (dark space)
    const p4Sky = ctx.createLinearGradient(p4x, 0, p4x, horizonY);
    p4Sky.addColorStop(0, '#000a00');
    p4Sky.addColorStop(1, '#001a05');
    ctx.fillStyle = p4Sky;
    ctx.fillRect(p4x, 0, panelW, horizonY);

    // Vivid green horizon bands
    const p4Colors = [
      '#004400', '#006622', '#009933', '#22bb44',
      '#44dd66', '#22cc44', '#009933', '#005522',
    ];
    const p4BandH = (panelH - horizonY) / p4Colors.length;
    for (let b = 0; b < p4Colors.length; b++) {
      ctx.fillStyle = p4Colors[b];
      ctx.fillRect(p4x, horizonY + b * p4BandH, panelW, p4BandH + 1);
    }

    // Alien structures (silhouettes at bottom)
    const structY = panelH * 0.82;

    // Spires
    for (let si = 0; si < SPIRE_POSITIONS.length; si++) {
      const spireH = panelH * SPIRE_HEIGHTS[si];
      const sw = panelW * 0.015;
      const sx = p4x + SPIRE_POSITIONS[si] * panelW;
      ctx.beginPath();
      ctx.moveTo(sx - sw, structY);
      ctx.lineTo(sx, structY - spireH);
      ctx.lineTo(sx + sw, structY);
      ctx.closePath();
      ctx.fillStyle = '#000a00';
      ctx.fill();
    }

    // Domes
    for (const dx of DOME_POSITIONS) {
      const domeR = panelW * 0.04;
      ctx.beginPath();
      ctx.arc(p4x + dx * panelW, structY, domeR, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = '#000a00';
      ctx.fill();
    }

    // Antenna
    ctx.beginPath();
    ctx.moveTo(p4x + 0.9 * panelW, structY);
    ctx.lineTo(p4x + 0.9 * panelW, structY - panelH * 0.1);
    ctx.strokeStyle = '#003300';
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(
      p4x + 0.9 * panelW,
      structY - panelH * 0.1,
      3 * dpr,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = '#00ff44';
    ctx.fill();

    // Ground plane
    ctx.fillStyle = '#000800';
    ctx.fillRect(p4x, structY, panelW, panelH - structY);

    // Black hole center
    const bhX = p4x + panelW * 0.5;
    const bhY = panelH * 0.4;
    const bhR = panelW * 0.08;

    // Accretion disk
    accretionAngle.current += beatsPerSec * 0.02 * (1 + s.energy * 2);
    const diskArcs = 12;
    for (let i = 0; i < diskArcs; i++) {
      const arcAngle = accretionAngle.current + (i / diskArcs) * Math.PI * 2;
      const outerR = bhR * (2.5 + i * 0.15);
      const t = i / diskArcs;
      ctx.beginPath();
      ctx.ellipse(bhX, bhY, outerR, outerR * 0.35, arcAngle, 0, Math.PI * 0.4);
      ctx.strokeStyle = `rgba(${Math.floor(50 + 200 * (1 - t))},255,${Math.floor(50 + 100 * (1 - t))},${0.3 - t * 0.15})`;
      ctx.lineWidth = (2.5 - t * 1.5) * dpr;
      ctx.shadowColor = '#00ff44';
      ctx.shadowBlur = 6 * dpr;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Photon ring
    const ringBright = s.rms + pulse;
    ctx.beginPath();
    ctx.arc(bhX, bhY, bhR * 1.2, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0,255,68,${0.4 + ringBright * 0.4})`;
    ctx.lineWidth = 2.5 * dpr;
    ctx.shadowColor = '#00ff44';
    ctx.shadowBlur = 15 * dpr * (0.5 + ringBright);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Black hole center (solid black)
    ctx.beginPath();
    ctx.arc(bhX, bhY, bhR, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();

    // Gravitational lensing arcs
    for (let i = 0; i < 3; i++) {
      const lensAngle = Math.PI * 0.3 * i + now * 0.3;
      const lensR = bhR * (2.8 + i * 0.5);
      ctx.beginPath();
      ctx.arc(bhX, bhY, lensR, lensAngle, lensAngle + Math.PI * 0.3);
      const shimmer = 0.15 + 0.1 * Math.sin(now * 2 + i * 1.5);
      ctx.strokeStyle = `rgba(0,200,60,${shimmer})`;
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();
    }

    // Energy jets (on strong beats)
    if (pulse > 0.6) {
      const jetLen = pulse * panelH * 0.3;
      const jetW = bhR * 0.3;
      // Top jet
      const topJetGrad = ctx.createLinearGradient(bhX, bhY, bhX, bhY - jetLen);
      topJetGrad.addColorStop(0, `rgba(0,255,100,${pulse * 0.7})`);
      topJetGrad.addColorStop(1, 'rgba(0,255,100,0)');
      ctx.beginPath();
      ctx.moveTo(bhX - jetW, bhY);
      ctx.lineTo(bhX, bhY - jetLen);
      ctx.lineTo(bhX + jetW, bhY);
      ctx.closePath();
      ctx.fillStyle = topJetGrad;
      ctx.shadowColor = '#00ff44';
      ctx.shadowBlur = 10 * dpr;
      ctx.fill();
      // Bottom jet
      const botJetGrad = ctx.createLinearGradient(bhX, bhY, bhX, bhY + jetLen);
      botJetGrad.addColorStop(0, `rgba(0,255,100,${pulse * 0.7})`);
      botJetGrad.addColorStop(1, 'rgba(0,255,100,0)');
      ctx.beginPath();
      ctx.moveTo(bhX - jetW, bhY);
      ctx.lineTo(bhX, bhY + jetLen);
      ctx.lineTo(bhX + jetW, bhY);
      ctx.closePath();
      ctx.fillStyle = botJetGrad;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Vignette
    const vig4 = ctx.createRadialGradient(
      p4x + panelW / 2, panelH / 2, panelW * 0.2,
      p4x + panelW / 2, panelH / 2, panelW * 0.7,
    );
    vig4.addColorStop(0, 'rgba(0,0,0,0)');
    vig4.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = vig4;
    ctx.fillRect(p4x, 0, panelW, panelH);

    ctx.restore();

    // ════════════════════════════════════════════════════════════
    // Shooting Stars (one at a time, confined to panels)
    // ════════════════════════════════════════════════════════════
    // Spawn one every 10-15 seconds
    if (now - lastShootingStar.current > 10 + Math.random() * 5) {
      lastShootingStar.current = now;
      const panel = Math.floor(Math.random() * 4);
      const pLeft = panel * panelW;
      const startX = pLeft + Math.random() * panelW;
      const startY = Math.random() * horizonY * 0.35;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const angle = (0.1 + Math.random() * 0.6) * dir;
      const speed = panelW * (0.006 + Math.random() * 0.008);
      shootingStars.current.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed * dir,
        vy: Math.abs(Math.sin(angle)) * speed + speed * 0.2,
        life: 0,
        maxLife: 20 + Math.random() * 40,
        size: 1.5 + Math.random() * 1.5,
        panel,
      });
    }

    // Update and draw
    shootingStars.current = shootingStars.current.filter((ss) => {
      ss.x += ss.vx;
      ss.y += ss.vy;
      ss.life++;

      const pLeft = ss.panel * panelW;
      const pRight = pLeft + panelW;

      // Kill if past horizon, left panel, or fizzled out
      if (ss.y >= horizonY || ss.life >= ss.maxLife || ss.x < pLeft || ss.x > pRight)
        return false;

      const progress = ss.life / ss.maxLife;
      const alpha = progress < 0.15 ? progress / 0.15 : 1 - (progress - 0.15) / 0.85;
      const tailLen = 45 * dpr;

      const vel = Math.sqrt(ss.vx * ss.vx + ss.vy * ss.vy) || 1;
      const tx = (-ss.vx / vel) * tailLen * alpha;
      const ty = (-ss.vy / vel) * tailLen * alpha;

      const grad = ctx.createLinearGradient(ss.x, ss.y, ss.x + tx, ss.y + ty);
      grad.addColorStop(0, `rgba(255,255,255,${alpha * 0.9})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');

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
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fill();

      return true;
    });

    // ════════════════════════════════════════════════════════════
    // LED Border Dots
    // ════════════════════════════════════════════════════════════
    const ledWave = now * beatsPerSec * 0.5;
    for (let i = 0; i < ledDots.length; i++) {
      const dot = ledDots[i];
      let dx: number, dy: number;
      if (dot.pos === 'top') {
        dx = dot.t * width;
        dy = 3 * dpr;
      } else if (dot.pos === 'bottom') {
        dx = dot.t * width;
        dy = height - 3 * dpr;
      } else {
        dx = (dot.panelEdge + 1) * panelW;
        dy = dot.t * height;
      }

      const chase = 0.3 + 0.4 * Math.sin(ledWave * Math.PI * 2 - i * 0.15);
      const beatFlash = pulse * 0.5;
      const bright = Math.min(1, chase + beatFlash);

      ctx.beginPath();
      ctx.arc(dx, dy, 2.5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${ar},${ag},${ab},${bright})`;
      ctx.shadowColor = `rgb(${ar},${ag},${ab})`;
      ctx.shadowBlur = 6 * dpr * bright;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // ════════════════════════════════════════════════════════════
    // Postcard Frames
    // ════════════════════════════════════════════════════════════
    const frameAlpha = 0.15 + pulse * 0.1;
    ctx.strokeStyle = `rgba(255,255,255,${frameAlpha})`;
    ctx.lineWidth = 1.5 * dpr;
    for (let p = 0; p < 4; p++) {
      const fx = p * panelW + 2 * dpr;
      const fy = 2 * dpr;
      const fw = panelW - 4 * dpr;
      const fh = panelH - 4 * dpr;
      ctx.strokeRect(fx, fy, fw, fh);
    }
  }, [audioFeatures, accentColor, isBeat, bpm, stars, ledDots]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
