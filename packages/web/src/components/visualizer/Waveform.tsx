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

    // Draw waveform
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.6 + glow * 0.4})`;
    ctx.lineWidth = (2 + glow * 3) * devicePixelRatio;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Glow effect
    if (glow > 0.1) {
      ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${glow * 0.6})`;
      ctx.shadowBlur = 20 * glow * devicePixelRatio;
    }

    const sliceWidth = width / timeData.length;
    let x = 0;

    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i] / 128.0 - 1;
      const y = centerY + v * centerY * 0.8;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.stroke();
    ctx.shadowBlur = 0;

    // Secondary mirror waveform (dimmer)
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.15)`;
    ctx.lineWidth = 1 * devicePixelRatio;
    x = 0;
    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i] / 128.0 - 1;
      const y = centerY - v * centerY * 0.5;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.stroke();

    // Center line
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.08)`;
    ctx.lineWidth = 1 * devicePixelRatio;
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
  }, [audioFeatures, accentColor, isBeat]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
