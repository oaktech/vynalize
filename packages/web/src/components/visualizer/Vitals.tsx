import { useRef, useEffect } from 'react';
import { useStore } from '../../store';
import { getVisDpr, applyGlow, clearGlow } from '../../utils/perfConfig';

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

/** Compress dynamic range — same approach as SpectrumBars boost().
 *  Quiet mic signals get amplified, loud signals are tamed. */
function boost(value: number, gain: number): number {
  return Math.min(1, Math.pow(value * gain, 0.55));
}

// ── ECG waveform shape ───────────────────────────────────────
function ecgShape(t: number): number {
  if (t < 0.10) return 0;
  if (t < 0.15) return Math.sin((t - 0.10) / 0.05 * Math.PI) * 0.12;
  if (t < 0.20) return 0;
  if (t < 0.22) return -(t - 0.20) / 0.02 * 0.15;
  if (t < 0.26) return -0.15 + ((t - 0.22) / 0.04) * 1.15;
  if (t < 0.30) return 1.0 - ((t - 0.26) / 0.04) * 1.3;
  if (t < 0.35) return -0.3 + ((t - 0.30) / 0.05) * 0.3;
  if (t < 0.45) return 0;
  if (t < 0.55) return Math.sin((t - 0.45) / 0.10 * Math.PI) * 0.18;
  return 0;
}

// ── Capnography (CO₂) waveform shape ────────────────────────
function co2Shape(t: number): number {
  if (t < 0.35) return 0;                                // inspiration baseline
  if (t < 0.45) return (t - 0.35) / 0.10;                // expiratory upstroke
  if (t < 0.80) return 1.0 + (t - 0.45) * 0.1;           // alveolar plateau (slight rise)
  const peak = 1.0 + 0.35 * 0.1;
  if (t < 0.90) return peak * (1 - (t - 0.80) / 0.10);   // inspiratory downstroke
  return 0;
}

// ── Component ────────────────────────────────────────────────

export default function Vitals({ accentColor }: { accentColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioFeatures = useStore((s) => s.audioFeatures);
  const isBeat = useStore((s) => s.isBeat);
  const bpm = useStore((s) => s.bpm);

  // Sweep data buffers
  const ecgBuffer = useRef(new Float32Array(HISTORY));
  const plethBuffer = useRef(new Float32Array(HISTORY));
  const respBuffer = useRef(new Float32Array(HISTORY));
  const co2Buffer = useRef(new Float32Array(HISTORY));
  const writeIdx = useRef(0);

  // ECG state
  const beatPhase = useRef(1); // 0..1, starts at 1 (idle)
  const beatActive = useRef(false);
  const beatStrength = useRef(0);
  const beepFlash = useRef(0);
  const plethPhase = useRef(1); // 0..1, reset on beat

  // Smooth audio for oscillation amplitude
  const smoothAudio = useRef({ bass: 0, mid: 0, high: 0, rms: 0, energy: 0 });
  const prevBassEnergy = useRef(0);
  const lastTrigger = useRef(0);

  // Phase accumulators for resp & CO₂ (stable, no modulo jumps)
  const respPhaseRef = useRef(0);
  const co2PhaseRef = useRef(0.3); // offset from resp

  // Smooth values for readouts
  const smoothBpm = useRef(0);
  const smoothSpO2 = useRef(97);
  const smoothResp = useRef(16);
  const smoothEtco2 = useRef(38);

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

  // Trigger ECG complex on beat
  useEffect(() => {
    if (isBeat) {
      beatPhase.current = 0;
      beatActive.current = true;
      beatStrength.current = 1;
      beepFlash.current = 1;
      plethPhase.current = -0.08; // small delay for pulse transit time
    }
  }, [isBeat]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioFeatures) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const dpr = getVisDpr();
    const [r, g, b] = hexToRgb(accentColor);

    const { rms, bass, mid, high, energy } = audioFeatures;
    const now = performance.now() / 1000;

    // ── Smooth audio values (fast attack, slow decay — matches SpectrumBars) ──
    const sa = smoothAudio.current;
    sa.bass += (bass - sa.bass) * (bass > sa.bass ? 0.4 : 0.15);
    sa.mid += (mid - sa.mid) * (mid > sa.mid ? 0.4 : 0.15);
    sa.high += (high - sa.high) * (high > sa.high ? 0.4 : 0.15);
    sa.rms += (rms - sa.rms) * (rms > sa.rms ? 0.4 : 0.15);
    sa.energy += (energy - sa.energy) * (energy > sa.energy ? 0.4 : 0.15);

    // Compressed band energies — boost quiet mic signals into visible range
    const bBass = boost(sa.bass, 3.5);
    const bMid = boost(sa.mid, 4.0);
    const bHigh = boost(sa.high, 5.0);  // highs roll off most, need most gain
    const bRms = boost(sa.rms, 3.0);

    // ── Detect beats from raw FFT bins (Guitar Hero approach) ──
    const freq = audioFeatures.frequencyData;
    // Sub-bass + bass bins (0-35) with high gain for ambient mic
    let bassSum = 0;
    for (let b = 0; b <= 35; b++) bassSum += freq[b] / 255;
    const bassAvg = bassSum / 36;
    const bassBoosted = Math.min(1, Math.pow(bassAvg * 5.0, 0.55));
    const bassDelta = bassBoosted - prevBassEnergy.current;
    prevBassEnergy.current = bassBoosted;

    if (bassDelta > 0.03 && bassBoosted > 0.08 && now - lastTrigger.current > 0.18) {
      beatPhase.current = 0;
      beatActive.current = true;
      beatStrength.current = Math.min(1, bassDelta * 8);
      beepFlash.current = 1;
      plethPhase.current = -0.08;
      lastTrigger.current = now;
    }

    // ── Advance ECG phase ──
    if (beatActive.current) {
      beatPhase.current += 0.04;
      if (beatPhase.current >= 1) {
        beatPhase.current = 1;
        beatActive.current = false;
      }
    }

    // ECG: PQRST spike scaled by beat strength + bass-reactive baseline
    const ecgBeat = beatActive.current
      ? ecgShape(beatPhase.current) * (2.0 + beatStrength.current * 3.0)
      : 0;
    const ecgBaseline =
      Math.sin(now * 1.2) * bBass * 0.3 +
      Math.sin(now * 3.7) * bBass * 0.15 +
      Math.sin(now * 0.5) * 0.02;
    const ecgVal = ecgBeat + ecgBaseline;

    // Pleth: beat-synced pulse wave — triggers after each ECG spike
    if (plethPhase.current < 1) plethPhase.current += 0.025;
    const pp = Math.max(0, plethPhase.current);
    const plethWave = pp < 0.15
      ? Math.sin(pp / 0.15 * Math.PI * 0.5)
      : pp < 1 ? Math.exp(-(pp - 0.15) * 3.5) * 0.9 +
        Math.sin((pp - 0.15) / 0.25 * Math.PI) * 0.15 * Math.exp(-(pp - 0.15) * 2.5)
      : 0;
    const plethVal = plethWave * (0.5 + bRms * 2.5);

    // Respiration: audio-reactive sinusoidal via phase accumulator
    const respRate = 24 + sa.energy * 16; // 24-40 br/min, faster with energy
    const respAdvance = (respRate / 60) / 60; // per-frame at ~60fps
    respPhaseRef.current = (respPhaseRef.current + respAdvance) % 1;
    const rp = respPhaseRef.current;
    const respVal = (rp < 0.4
      ? Math.sin(rp / 0.4 * Math.PI * 0.5)
      : Math.cos((rp - 0.4) / 0.6 * Math.PI * 0.5)
    ) * (0.8 + bBass * 0.7);

    // Capnography (CO₂): plateau waveform via phase accumulator
    co2PhaseRef.current = (co2PhaseRef.current + respAdvance) % 1;
    const co2Val = co2Shape(co2PhaseRef.current) * (0.8 + bMid * 0.6);

    // Push to buffers
    const idx = writeIdx.current % HISTORY;
    ecgBuffer.current[idx] = ecgVal;
    plethBuffer.current[idx] = plethVal;
    respBuffer.current[idx] = respVal;
    co2Buffer.current[idx] = co2Val;
    writeIdx.current++;

    // Beep flash decay
    beepFlash.current *= 0.88;

    // ── Smooth readout values ──
    const targetBpm = bpm || 72;
    smoothBpm.current += (targetBpm - smoothBpm.current) * 0.05;
    smoothSpO2.current += ((95 + energy * 4) - smoothSpO2.current) * 0.02;
    smoothResp.current += ((14 + sa.energy * 8) - smoothResp.current) * 0.02;
    smoothEtco2.current += ((35 + energy * 10) - smoothEtco2.current) * 0.02;

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

    // ── Draw traces (sweep mode) ──
    const headIdx = (writeIdx.current - 1 + HISTORY) % HISTORY;
    const eraseSlots = Math.floor(HISTORY * 0.03);
    const step = width / HISTORY;
    const filled = Math.min(writeIdx.current, HISTORY);
    const wrapped = writeIdx.current >= HISTORY;

    // No overlay — the gap in the trace lines provides the sweep break

    const traceConfigs = [
      { buffer: ecgBuffer.current, y: 0.10, h: 0.24, rgb: `${r}, ${g}, ${b}`, label: 'II', lineW: 3 },
      { buffer: plethBuffer.current, y: 0.36, h: 0.18, rgb: '0, 229, 255', label: 'Pleth', lineW: 2.5 },
      { buffer: respBuffer.current, y: 0.56, h: 0.18, rgb: '255, 170, 0', label: 'Resp', lineW: 2 },
      { buffer: co2Buffer.current, y: 0.76, h: 0.18, rgb: '170, 140, 255', label: 'CO₂', lineW: 2 },
    ];

    const maxAge = wrapped ? HISTORY - eraseSlots : Math.max(filled, 1);

    // Phosphor decay passes: layered dim → medium → bright
    const phosphorPasses = [
      { ageFrac: 1.0, alpha: 0.25, glow: 0 },
      { ageFrac: 0.85, alpha: 0.30, glow: 0 },
      { ageFrac: 0.80, alpha: 0.40, glow: 8 },
    ];

    for (const trace of traceConfigs) {
      const traceY = height * trace.y;
      const traceH = height * trace.h;

      // Label
      ctx.font = `${11 * dpr}px monospace`;
      ctx.fillStyle = `rgb(${trace.rgb})`;
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

      // Trace with phosphor decay — 3 passes, each brighter for newer data
      for (const pass of phosphorPasses) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${trace.rgb}, ${pass.alpha})`;
        ctx.lineWidth = trace.lineW * dpr;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        if (pass.glow > 0) {
          applyGlow(ctx, pass.glow * dpr, `rgb(${trace.rgb})`);
        }

        let drawing = false;
        for (let i = 0; i < filled; i++) {
          if (wrapped) {
            const distAhead = (i - headIdx + HISTORY) % HISTORY;
            if (distAhead >= 1 && distAhead <= eraseSlots) {
              drawing = false;
              continue;
            }
          }

          const age = (headIdx - i + HISTORY) % HISTORY;
          if (age > maxAge * pass.ageFrac) {
            drawing = false;
            continue;
          }

          const val = trace.buffer[i];
          const x = i * step;
          const y = traceY + traceH * 0.5 - val * traceH * 0.5;

          if (!drawing) { ctx.moveTo(x, y); drawing = true; }
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        clearGlow(ctx);
      }

      // Leading dot at cursor position
      if (filled > 0) {
        const dotIdx = wrapped ? headIdx : filled - 1;
        const lastVal = trace.buffer[dotIdx];
        const dotX = dotIdx * step;
        const dotY = traceY + traceH * 0.5 - lastVal * traceH * 0.5;

        ctx.beginPath();
        ctx.arc(dotX, dotY, 3.5 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        applyGlow(ctx, 14 * dpr, `rgb(${trace.rgb})`);
        ctx.fill();
        clearGlow(ctx);
      }
    }

    // ── Digital readouts (right side) ──
    const panelX = width - 180 * dpr;
    const flash = beepFlash.current;

    // BPM (large)
    ctx.font = `bold ${48 * dpr}px monospace`;
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    applyGlow(ctx, flash * 20 * dpr, `rgb(${r}, ${g}, ${b})`);
    ctx.fillText(Math.round(smoothBpm.current).toString(), panelX, height * 0.12);
    clearGlow(ctx);

    ctx.font = `${12 * dpr}px monospace`;
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
    ctx.fillText('HR  bpm', panelX, height * 0.12 + 18 * dpr);

    // Heart icon that beats
    const heartSize = 14 + flash * 8;
    const heartX = panelX + 140 * dpr;
    const heartY = height * 0.12 - 20 * dpr;
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

    // Resp rate
    ctx.font = `bold ${28 * dpr}px monospace`;
    ctx.fillStyle = '#ffaa00';
    ctx.fillText(Math.round(smoothResp.current).toString(), panelX, height * 0.58);
    ctx.font = `${12 * dpr}px monospace`;
    ctx.fillStyle = 'rgba(255, 170, 0, 0.5)';
    ctx.fillText('RESP  br/min', panelX, height * 0.58 + 18 * dpr);

    // EtCO₂
    ctx.font = `bold ${28 * dpr}px monospace`;
    ctx.fillStyle = '#aa8cff';
    ctx.fillText(Math.round(smoothEtco2.current).toString(), panelX, height * 0.78);
    ctx.font = `${12 * dpr}px monospace`;
    ctx.fillStyle = 'rgba(170, 140, 255, 0.5)';
    ctx.fillText('EtCO₂  mmHg', panelX, height * 0.78 + 18 * dpr);

    // ── Beep dot (top right, flashes on beat) ──
    if (flash > 0.05) {
      ctx.beginPath();
      ctx.arc(width - 20 * dpr, 20 * dpr, (6 + flash * 6) * dpr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${flash})`;
      applyGlow(ctx, 20 * flash * dpr, `rgb(${r}, ${g}, ${b})`);
      ctx.fill();
      clearGlow(ctx);
    }
  }, [audioFeatures, accentColor, isBeat, bpm]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
