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

export default function RadialSpectrum({ accentColor }: { accentColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioFeatures = useStore((s) => s.audioFeatures);
  const bpm = useStore((s) => s.bpm);
  const isBeat = useStore((s) => s.isBeat);
  const rotation = useRef(0);
  const pulseScale = useRef(1);

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
    if (isBeat) pulseScale.current = 1.15;
  }, [isBeat]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioFeatures) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.2;
    const maxBarLength = Math.min(width, height) * 0.25;

    const [r, g, b] = hexToRgb(accentColor);

    // Rotation speed based on BPM or default
    const speed = bpm ? (bpm / 120) * 0.005 : 0.003;
    rotation.current += speed;

    // Decay pulse
    pulseScale.current += (1 - pulseScale.current) * 0.08;
    const scale = pulseScale.current;

    const freq = audioFeatures.frequencyData;
    const barCount = 128;
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
      const avg = sum / binsPerBar / 255;
      const barLength = avg * maxBarLength;

      const angle = i * angleStep;
      const x1 = Math.cos(angle) * baseRadius;
      const y1 = Math.sin(angle) * baseRadius;
      const x2 = Math.cos(angle) * (baseRadius + barLength);
      const y2 = Math.sin(angle) * (baseRadius + barLength);

      const alpha = 0.3 + avg * 0.7;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.lineWidth = (2 + avg * 2) * devicePixelRatio;
      ctx.lineCap = 'round';
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Mirror bars (inner)
      const innerLength = avg * maxBarLength * 0.4;
      const x3 = Math.cos(angle) * (baseRadius - innerLength);
      const y3 = Math.sin(angle) * (baseRadius - innerLength);
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.4})`;
      ctx.lineWidth = 1.5 * devicePixelRatio;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x3, y3);
      ctx.stroke();
    }

    // Center circle glow
    const rms = audioFeatures.rms;
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, baseRadius);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.15 + rms * 0.3})`);
    gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${0.05 + rms * 0.1})`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, [audioFeatures, accentColor, bpm, isBeat]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
