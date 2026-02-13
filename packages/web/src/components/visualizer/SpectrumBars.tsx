import { useRef, useEffect } from 'react';
import { useStore } from '../../store';

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

/** Boost quiet signals and compress dynamic range */
function boost(value: number): number {
  return Math.min(1, Math.pow(value * 3.5, 0.6));
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
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
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
    const usableBins = Math.floor(freq.length * 0.6);
    const barCount = Math.min(64, usableBins);
    const binsPerBar = Math.floor(usableBins / barCount);
    const gap = 2 * devicePixelRatio;
    const barWidth = (width - gap * (barCount - 1)) / barCount;

    const [r, g, b] = hexToRgb(accentColor);

    // Initialize smooth bars
    if (!smoothBars.current || smoothBars.current.length !== barCount) {
      smoothBars.current = new Float32Array(barCount);
    }

    // Decay beat flash
    beatFlash.current *= 0.92;
    const flashBoost = beatFlash.current * 0.3;

    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      for (let j = 0; j < binsPerBar; j++) {
        sum += freq[i * binsPerBar + j];
      }
      const raw = sum / binsPerBar / 255;
      const target = boost(raw);

      // Smooth: fast attack, slow decay for fluid motion
      const prev = smoothBars.current[i];
      smoothBars.current[i] = target > prev
        ? prev + (target - prev) * 0.4
        : prev + (target - prev) * 0.15;

      const val = smoothBars.current[i];
      const barHeight = Math.max(2 * devicePixelRatio, val * height * 0.9);

      const x = i * (barWidth + gap);
      const y = height - barHeight;

      // Gradient from accent color to brighter version
      const gradient = ctx.createLinearGradient(x, height, x, y);
      const brightness = Math.min(1, val + flashBoost);
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.4 + brightness * 0.5})`);
      gradient.addColorStop(1, `rgba(${Math.min(255, r + 80)}, ${Math.min(255, g + 80)}, ${Math.min(255, b + 80)}, ${0.8 + brightness * 0.2})`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      const radius = Math.min(barWidth / 2, 4 * devicePixelRatio);
      ctx.roundRect(x, y, barWidth, barHeight, [radius, radius, 0, 0]);
      ctx.fill();

      // Glow on loud bars
      if (val > 0.5) {
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${(val - 0.5) * 0.8})`;
        ctx.shadowBlur = 15 * devicePixelRatio;
        ctx.fill();
        ctx.shadowBlur = 0;
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
