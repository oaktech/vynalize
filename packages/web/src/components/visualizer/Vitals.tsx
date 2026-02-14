import { useRef, useEffect } from 'react';
import { useStore } from '../../store';

// ── Config ───────────────────────────────────────────────────

const HISTORY = 300; // frames of scrolling history
const GRID_SPACING = 40; // px (before DPR)

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

// ── ECG waveform shape ───────────────────────────────────────
// Attempt to mimic PQRST complex: flat → small P bump → sharp QRS spike → small T bump → flat
function ecgShape(t: number): number {
  // t in 0..1 represents one heartbeat cycle
  if (t < 0.10) return 0;                                          // baseline
  if (t < 0.15) return Math.sin((t - 0.10) / 0.05 * Math.PI) * 0.12;  // P wave
  if (t < 0.20) return 0;                                          // PR segment
  if (t < 0.22) return -(t - 0.20) / 0.02 * 0.15;                 // Q dip
  if (t < 0.26) return -0.15 + ((t - 0.22) / 0.04) * 1.15;        // R spike up
  if (t < 0.30) return 1.0 - ((t - 0.26) / 0.04) * 1.3;           // S dip
  if (t < 0.35) return -0.3 + ((t - 0.30) / 0.05) * 0.3;          // back to baseline
  if (t < 0.45) return 0;                                          // ST segment
  if (t < 0.55) return Math.sin((t - 0.45) / 0.10 * Math.PI) * 0.18; // T wave
  return 0;                                                         // baseline
}

// ── Component ────────────────────────────────────────────────

export default function Vitals({ accentColor }: { accentColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioFeatures = useStore((s) => s.audioFeatures);
  const isBeat = useStore((s) => s.isBeat);
  const bpm = useStore((s) => s.bpm);

  // Scrolling data buffers
  const ecgBuffer = useRef(new Float32Array(HISTORY));
  const bassBuffer = useRef(new Float32Array(HISTORY));
  const midBuffer = useRef(new Float32Array(HISTORY));
  const highBuffer = useRef(new Float32Array(HISTORY));
  const plethBuffer = useRef(new Float32Array(HISTORY));
  const writeIdx = useRef(0);

  // ECG state
  const beatPhase = useRef(1); // 0..1, starts at 1 (idle)
  const beatActive = useRef(false);
  const beatStrength = useRef(0);
  const beepFlash = useRef(0);

  // Smooth audio for oscillation amplitude
  const smoothAudio = useRef({ bass: 0, mid: 0, high: 0, rms: 0, energy: 0 });
  const prevRms = useRef(0);
  const lastEcgTrigger = useRef(0);

  // Smooth values for readouts
  const smoothBpm = useRef(0);
  const smoothSpO2 = useRef(97);
  const smoothBP = useRef({ sys: 120, dia: 80 });
  const smoothResp = useRef(16);

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

  // Trigger ECG complex on beat
  useEffect(() => {
    if (isBeat) {
      beatPhase.current = 0;
      beatActive.current = true;
      beatStrength.current = 1;
      beepFlash.current = 1;
    }
  }, [isBeat]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioFeatures) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const dpr = devicePixelRatio;
    const [r, g, b] = hexToRgb(accentColor);

    const { rms, bass, mid, high, energy } = audioFeatures;
    const now = performance.now() / 1000;

    // ── Smooth audio values ──
    const sa = smoothAudio.current;
    sa.bass += (bass - sa.bass) * 0.1;
    sa.mid += (mid - sa.mid) * 0.1;
    sa.high += (high - sa.high) * 0.1;
    sa.rms += (rms - sa.rms) * 0.12;
    sa.energy += (energy - sa.energy) * 0.1;

    // ── Detect bass/volume spikes directly for ECG trigger ──
    const rmsDelta = rms - prevRms.current;
    prevRms.current = rms;
    const minEcgGap = 250; // ms between triggers

    if (rmsDelta > 0.01 && now - lastEcgTrigger.current / 1000 > minEcgGap / 1000) {
      beatPhase.current = 0;
      beatActive.current = true;
      beatStrength.current = Math.min(1, rmsDelta * 15);
      beepFlash.current = 1;
      lastEcgTrigger.current = now;
    }

    // ── Advance ECG phase ──
    // Fixed speed: complete the PQRST in ~400ms regardless of BPM
    if (beatActive.current) {
      beatPhase.current += 0.04;
      if (beatPhase.current >= 1) {
        beatPhase.current = 1;
        beatActive.current = false;
      }
    }

    const beatsPerSec = (bpm || 72) / 60;

    // ECG: PQRST spike scaled by beat strength + bass-reactive baseline
    const ecgBeat = beatActive.current
      ? ecgShape(beatPhase.current) * (2.0 + beatStrength.current * 3.0)
      : 0;
    const ecgBaseline =
      Math.sin(now * 1.2) * sa.bass * 0.4 +
      Math.sin(now * 3.7) * sa.bass * 0.2 +
      Math.sin(now * 0.5) * 0.02;
    const ecgVal = ecgBeat + ecgBaseline;

    // Pleth: synthetic pulse wave — sharp rise, slow decay, amplitude from RMS
    const plethPhase = (now * beatsPerSec) % 1;
    const plethShape = plethPhase < 0.15
      ? Math.sin(plethPhase / 0.15 * Math.PI * 0.5) // sharp rise
      : Math.exp(-(plethPhase - 0.15) * 4) * 0.9 + // exponential decay
        Math.sin((plethPhase - 0.15) / 0.2 * Math.PI) * 0.15 * Math.exp(-(plethPhase - 0.15) * 3); // dicrotic notch
    const plethVal = plethShape * (0.3 + sa.rms * 5);

    // EEG channels: synthetic oscillations at characteristic frequencies
    // Delta (bass): slow 1-3Hz waves, amplitude driven by bass
    const deltaVal =
      (Math.sin(now * 1.5 * Math.PI * 2) * 0.5 +
       Math.sin(now * 2.8 * Math.PI * 2) * 0.3 +
       Math.sin(now * 0.7 * Math.PI * 2) * 0.2) * (0.15 + sa.bass * 4);

    // Alpha (mid): 8-12Hz waves, amplitude driven by mid
    const alphaVal =
      (Math.sin(now * 9.5 * Math.PI * 2) * 0.5 +
       Math.sin(now * 11.2 * Math.PI * 2) * 0.3 +
       Math.sin(now * 8.1 * Math.PI * 2) * 0.2) * (0.1 + sa.mid * 4);

    // Beta (high): 15-30Hz waves, amplitude driven by high
    const betaVal =
      (Math.sin(now * 18 * Math.PI * 2) * 0.4 +
       Math.sin(now * 24 * Math.PI * 2) * 0.35 +
       Math.sin(now * 28 * Math.PI * 2) * 0.25) * (0.1 + sa.high * 5);

    // Push to buffers
    const idx = writeIdx.current % HISTORY;
    ecgBuffer.current[idx] = ecgVal;
    plethBuffer.current[idx] = plethVal;
    bassBuffer.current[idx] = deltaVal;
    midBuffer.current[idx] = alphaVal;
    highBuffer.current[idx] = betaVal;
    writeIdx.current++;

    // Beep flash decay
    beepFlash.current *= 0.88;

    // ── Smooth readout values ──
    const targetBpm = bpm || 72;
    smoothBpm.current += (targetBpm - smoothBpm.current) * 0.05;
    smoothSpO2.current += ((95 + energy * 4) - smoothSpO2.current) * 0.02;
    smoothBP.current.sys += ((110 + rms * 40) - smoothBP.current.sys) * 0.03;
    smoothBP.current.dia += ((70 + bass * 30) - smoothBP.current.dia) * 0.03;
    smoothResp.current += ((14 + mid * 8) - smoothResp.current) * 0.02;

    // ── Clear ──
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // ── Grid ──
    const gridPx = GRID_SPACING * dpr;
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.06)`;
    ctx.lineWidth = 1;
    for (let x = gridPx; x < width; x += gridPx) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = gridPx; y < height; y += gridPx) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // ── Draw traces ──
    const traceConfigs = [
      { buffer: ecgBuffer.current, y: 0.15, h: 0.28, color: `rgb(${r}, ${g}, ${b})`, label: 'II', lineW: 3 },
      { buffer: plethBuffer.current, y: 0.42, h: 0.12, color: '#00e5ff', label: 'Pleth', lineW: 2 },
      { buffer: bassBuffer.current, y: 0.58, h: 0.10, color: '#ff4444', label: 'EEG δ', lineW: 1.5 },
      { buffer: midBuffer.current, y: 0.70, h: 0.10, color: '#ffaa00', label: 'EEG α', lineW: 1.5 },
      { buffer: highBuffer.current, y: 0.82, h: 0.10, color: '#44ff88', label: 'EEG β', lineW: 1.5 },
    ];

    const count = Math.min(writeIdx.current, HISTORY);

    for (const trace of traceConfigs) {
      const traceY = height * trace.y;
      const traceH = height * trace.h;

      // Label
      ctx.font = `${11 * dpr}px monospace`;
      ctx.fillStyle = trace.color;
      ctx.globalAlpha = 0.5;
      ctx.fillText(trace.label, 8 * dpr, traceY - 4 * dpr);
      ctx.globalAlpha = 1;

      // Separator line
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.08)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, traceY + traceH + 4 * dpr);
      ctx.lineTo(width, traceY + traceH + 4 * dpr);
      ctx.stroke();

      // Trace
      ctx.beginPath();
      ctx.strokeStyle = trace.color;
      ctx.lineWidth = trace.lineW * dpr;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // Glow
      ctx.shadowColor = trace.color;
      ctx.shadowBlur = 8 * dpr;

      const step = width / HISTORY;
      for (let i = 0; i < count; i++) {
        const bufIdx = (writeIdx.current - count + i + HISTORY) % HISTORY;
        const val = trace.buffer[bufIdx];
        const x = (HISTORY - count + i) * step;
        const y = traceY + traceH * 0.5 - val * traceH * 0.5;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Leading dot (bright pixel at write head)
      if (count > 0) {
        const lastBufIdx = (writeIdx.current - 1 + HISTORY) % HISTORY;
        const lastVal = trace.buffer[lastBufIdx];
        const dotX = (HISTORY - 1) * step;
        const dotY = traceY + traceH * 0.5 - lastVal * traceH * 0.5;

        ctx.beginPath();
        ctx.arc(dotX, dotY, 3 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
      }
    }

    // ── Digital readouts (right side) ──
    const panelX = width - 180 * dpr;
    const flash = beepFlash.current;

    // BPM (large)
    ctx.font = `bold ${48 * dpr}px monospace`;
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.shadowColor = `rgb(${r}, ${g}, ${b})`;
    ctx.shadowBlur = flash * 20 * dpr;
    ctx.fillText(Math.round(smoothBpm.current).toString(), panelX, height * 0.15);
    ctx.shadowBlur = 0;

    ctx.font = `${12 * dpr}px monospace`;
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
    ctx.fillText('HR  bpm', panelX, height * 0.15 + 18 * dpr);

    // Heart icon that beats
    const heartSize = 14 + flash * 8;
    const heartX = panelX + 140 * dpr;
    const heartY = height * 0.15 - 20 * dpr;
    ctx.fillStyle = flash > 0.1
      ? `rgba(${r}, ${g}, ${b}, ${0.5 + flash * 0.5})`
      : `rgba(${r}, ${g}, ${b}, 0.3)`;
    ctx.font = `${heartSize * dpr}px sans-serif`;
    ctx.fillText('♥', heartX, heartY);

    // SpO2
    ctx.font = `bold ${32 * dpr}px monospace`;
    ctx.fillStyle = '#00e5ff';
    ctx.fillText(Math.round(smoothSpO2.current).toString(), panelX, height * 0.38);
    ctx.font = `${12 * dpr}px monospace`;
    ctx.fillStyle = 'rgba(0, 229, 255, 0.5)';
    ctx.fillText('SpO₂  %', panelX, height * 0.38 + 18 * dpr);

    // Blood Pressure
    ctx.font = `bold ${24 * dpr}px monospace`;
    ctx.fillStyle = '#ff4444';
    ctx.fillText(
      `${Math.round(smoothBP.current.sys)}/${Math.round(smoothBP.current.dia)}`,
      panelX, height * 0.56,
    );
    ctx.font = `${12 * dpr}px monospace`;
    ctx.fillStyle = 'rgba(255, 68, 68, 0.5)';
    ctx.fillText('NIBP  mmHg', panelX, height * 0.56 + 18 * dpr);

    // Resp rate
    ctx.font = `bold ${24 * dpr}px monospace`;
    ctx.fillStyle = '#ffaa00';
    ctx.fillText(Math.round(smoothResp.current).toString(), panelX, height * 0.72);
    ctx.font = `${12 * dpr}px monospace`;
    ctx.fillStyle = 'rgba(255, 170, 0, 0.5)';
    ctx.fillText('RESP  br/min', panelX, height * 0.72 + 18 * dpr);

    // ── Beep dot (top right, flashes on beat) ──
    if (flash > 0.05) {
      ctx.beginPath();
      ctx.arc(width - 20 * dpr, 20 * dpr, (6 + flash * 6) * dpr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${flash})`;
      ctx.shadowColor = `rgb(${r}, ${g}, ${b})`;
      ctx.shadowBlur = 20 * flash * dpr;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }, [audioFeatures, accentColor, isBeat, bpm]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
