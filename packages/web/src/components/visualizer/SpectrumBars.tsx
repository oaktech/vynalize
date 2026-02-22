import { useRef, useEffect } from 'react';
import { useStore } from '../../store';
import { getVisDpr, applyGlow, clearGlow } from '../../utils/perfConfig';

function hexToRgb(color: string): [number, number, number] {
  if (color.startsWith('rgb')) {
    const match = color.match(/(\d+)/g);
    if (match && match.length >= 3) {
      return [parseInt(match[0]), parseInt(match[1]), parseInt(match[2])];
    }
  }
  const hex = color.replace('#', '');
  return [
    parseInt(hex.substring(0, 2), 16),
    parseInt(hex.substring(2, 4), 16),
    parseInt(hex.substring(4, 6), 16),
  ];
}

/** Compress dynamic range with per-bar frequency compensation */
function boost(value: number, barNorm: number): number {
  // Higher bars get more gain to compensate for natural spectral rolloff
  const gain = 1.5 + barNorm * 3.5;
  return Math.min(1, Math.pow(value * gain, 0.55));
}

export default function SpectrumBars({ accentColor }: { accentColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioFeatures = useStore((s) => s.audioFeatures);
  const isBeat = useStore((s) => s.isBeat);
  const beatFlash = useRef(0);
  const smoothBars = useRef<Float32Array | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.clientWidth * getVisDpr();
      canvas.height = canvas.clientHeight * getVisDpr();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (isBeat) beatFlash.current = 1;
  }, [isBeat]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioFeatures) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const freq = audioFeatures.frequencyData;
    const barCount = 64;
    const gap = 2 * getVisDpr();
    const barWidth = (width - gap * (barCount - 1)) / barCount;

    const [r, g, b] = hexToRgb(accentColor);

    // Initialize smooth bars
    if (!smoothBars.current || smoothBars.current.length !== barCount) {
      smoothBars.current = new Float32Array(barCount);
    }

    // Decay beat flash
    beatFlash.current *= 0.92;
    const flashBoost = beatFlash.current * 0.3;

    // Logarithmic frequency mapping — spreads energy evenly across bars
    const minFreq = 1;
    const maxFreq = freq.length * 0.75;
    const logMin = Math.log(minFreq);
    const logMax = Math.log(maxFreq);

    for (let i = 0; i < barCount; i++) {
      const loEdge = Math.exp(logMin + (i / barCount) * (logMax - logMin));
      const hiEdge = Math.exp(logMin + ((i + 1) / barCount) * (logMax - logMin));
      const lo = Math.floor(loEdge);
      const hi = Math.max(lo + 1, Math.floor(hiEdge));

      let sum = 0;
      let count = 0;
      for (let j = lo; j < hi && j < freq.length; j++) {
        sum += freq[j];
        count++;
      }
      const raw = count > 0 ? sum / count / 255 : 0;
      const target = boost(raw, i / (barCount - 1));

      // Smooth: fast attack, slow decay for fluid motion
      const prev = smoothBars.current[i];
      smoothBars.current[i] = target > prev
        ? prev + (target - prev) * 0.4
        : prev + (target - prev) * 0.15;

      const val = smoothBars.current[i];
      const barHeight = Math.max(2 * getVisDpr(), val * height * 0.9);

      const x = i * (barWidth + gap);
      const y = height - barHeight;

      // Gradient from accent color to brighter version
      const gradient = ctx.createLinearGradient(x, height, x, y);
      const brightness = Math.min(1, val + flashBoost);
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.4 + brightness * 0.5})`);
      gradient.addColorStop(1, `rgba(${Math.min(255, r + 80)}, ${Math.min(255, g + 80)}, ${Math.min(255, b + 80)}, ${0.8 + brightness * 0.2})`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      const radius = Math.min(barWidth / 2, 4 * getVisDpr());
      ctx.roundRect(x, y, barWidth, barHeight, [radius, radius, 0, 0]);
      ctx.fill();

      // Glow on loud bars
      if (val > 0.5) {
        applyGlow(ctx, 15 * getVisDpr(), `rgba(${r}, ${g}, ${b}, ${(val - 0.5) * 0.8})`);
        ctx.fill();
        clearGlow(ctx);
      }

      // Reflection
      const reflGradient = ctx.createLinearGradient(x, height, x, height + barHeight * 0.3);
      reflGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.1 + val * 0.1})`);
      reflGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = reflGradient;
      ctx.fillRect(x, height, barWidth, barHeight * 0.3);
    }
  }, [audioFeatures, accentColor, isBeat]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
    />
  );
}
