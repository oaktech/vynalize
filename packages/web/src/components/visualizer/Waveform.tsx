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

export default function Waveform({ accentColor }: { accentColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioFeatures = useStore((s) => s.audioFeatures);
  const isBeat = useStore((s) => s.isBeat);
  const glowIntensity = useRef(0);
  const peakRef = useRef(0.01);

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
    if (isBeat) glowIntensity.current = 1;
  }, [isBeat]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioFeatures) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const timeData = audioFeatures.timeData;
    const centerY = height / 2;
    const [r, g, b] = hexToRgb(accentColor);

    glowIntensity.current *= 0.93;
    const glow = glowIntensity.current;

    // Adaptive gain: track peak amplitude and normalize to it
    let currentPeak = 0;
    for (let i = 0; i < timeData.length; i++) {
      const amp = Math.abs(timeData[i] - 128) / 128;
      if (amp > currentPeak) currentPeak = amp;
    }
    // Fast attack, slow decay for peak tracking
    peakRef.current = currentPeak > peakRef.current
      ? currentPeak
      : peakRef.current * 0.997;
    // Gain that normalizes signal to fill ~80% of height, with minimum boost
    const gain = Math.min(12, 0.8 / Math.max(peakRef.current, 0.005));

    // Main waveform
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.7 + glow * 0.3})`;
    ctx.lineWidth = (2.5 + glow * 4) * devicePixelRatio;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (glow > 0.1) {
      ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${glow * 0.7})`;
      ctx.shadowBlur = 25 * glow * devicePixelRatio;
    }

    const sliceWidth = width / timeData.length;
    let x = 0;

    for (let i = 0; i < timeData.length; i++) {
      const raw = (timeData[i] - 128) / 128;
      const v = Math.max(-1, Math.min(1, raw * gain));
      const y = centerY + v * centerY * 0.85;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.stroke();
    ctx.shadowBlur = 0;

    // Filled area under waveform (subtle)
    ctx.lineTo(width, centerY);
    ctx.lineTo(0, centerY);
    ctx.closePath();
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.05)`;
    ctx.fill();

    // Secondary mirror waveform (dimmer, inverted)
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.2)`;
    ctx.lineWidth = 1.5 * devicePixelRatio;
    x = 0;
    for (let i = 0; i < timeData.length; i++) {
      const raw = (timeData[i] - 128) / 128;
      const v = Math.max(-1, Math.min(1, raw * gain));
      const y = centerY - v * centerY * 0.6;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.stroke();

    // Center line
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.1)`;
    ctx.lineWidth = 1 * devicePixelRatio;
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
  }, [audioFeatures, accentColor, isBeat]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
