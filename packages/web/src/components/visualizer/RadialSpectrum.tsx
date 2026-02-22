import { useRef, useEffect, useCallback } from 'react';
import { getVisDpr, getLowPowerCount, useVisualizerLoop, audioRef } from '../../utils/perfConfig';

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

/** Compress dynamic range — same approach as SpectrumBars boost().
 *  Quiet mic signals get amplified, loud signals are tamed. */
function boost(value: number, gain: number = 3.5): number {
  return Math.min(1, Math.pow(value * gain, 0.55));
}

export default function RadialSpectrum({ accentColor }: { accentColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotation = useRef(0);
  const pulseScale = useRef(1);
  const smooth = useRef({ bass: 0, mid: 0, energy: 0 });
  const prevBeat = useRef(false);

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

  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const audioFeatures = audioRef.features;
    if (!audioFeatures) return;

    // Beat edge detection from shared ref
    if (audioRef.isBeat && !prevBeat.current) pulseScale.current = 1.25;
    prevBeat.current = audioRef.isBeat;

    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.18;
    const maxBarLength = Math.min(width, height) * 0.3;

    const [r, g, b] = hexToRgb(accentColor);

    // Smooth audio (fast attack, slow decay — matches SpectrumBars)
    const s = smooth.current;
    const rawBass = audioFeatures.bass;
    const rawMid = audioFeatures.mid;
    const rawEnergy = audioFeatures.energy;
    s.bass += (rawBass - s.bass) * (rawBass > s.bass ? 0.4 : 0.15);
    s.mid += (rawMid - s.mid) * (rawMid > s.mid ? 0.4 : 0.15);
    s.energy += (rawEnergy - s.energy) * (rawEnergy > s.energy ? 0.4 : 0.15);

    // Lower-mid blend — registers strongest through mic
    const bLowMid = boost(s.bass * 0.4 + s.mid * 0.6, 6.0);

    // Rotation speed based on BPM, modulated by lower mids
    const bpm = audioRef.bpm;
    const speed = bpm ? (bpm / 120) * 0.005 : 0.003;
    rotation.current += speed * (1 + bLowMid * 1.5);

    // Decay pulse
    pulseScale.current += (1 - pulseScale.current) * 0.06;
    const scale = pulseScale.current + bLowMid * 0.08;

    const freq = audioFeatures.frequencyData;
    const barCount = getLowPowerCount(128, 48);
    const binsPerBar = Math.floor((freq.length * 0.5) / barCount);
    const angleStep = (Math.PI * 2) / barCount;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation.current);
    ctx.scale(scale, scale);

    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      for (let j = 0; j < binsPerBar; j++) {
        sum += freq[i * binsPerBar + j];
      }
      const raw = sum / binsPerBar / 255;
      const val = boost(raw);
      const barLength = val * maxBarLength;

      const angle = i * angleStep;
      const x1 = Math.cos(angle) * baseRadius;
      const y1 = Math.sin(angle) * baseRadius;
      const x2 = Math.cos(angle) * (baseRadius + barLength);
      const y2 = Math.sin(angle) * (baseRadius + barLength);

      const alpha = 0.3 + val * 0.7;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.lineWidth = (2 + val * 3) * getVisDpr();
      ctx.lineCap = 'round';
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Mirror bars (inner)
      const innerLength = val * maxBarLength * 0.5;
      const x3 = Math.cos(angle) * (baseRadius - innerLength);
      const y3 = Math.sin(angle) * (baseRadius - innerLength);
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.4})`;
      ctx.lineWidth = 1.5 * getVisDpr();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x3, y3);
      ctx.stroke();
    }

    // Center circle glow — driven by lower mids
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, baseRadius);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.2 + bLowMid * 0.5})`);
    gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${0.1 + bLowMid * 0.25})`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, [accentColor]);

  useVisualizerLoop(canvasRef, draw, [draw]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
