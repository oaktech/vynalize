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

const POINTS = 200;
const CYCLES = 4; // clean, even wave cycles across the screen

export default function Waveform({ accentColor }: { accentColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioFeatures = useStore((s) => s.audioFeatures);
  const isBeat = useStore((s) => s.isBeat);
  const bpm = useStore((s) => s.bpm);
  const beatPulse = useRef(0);
  const smoothAmp = useRef(0.15);

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
    if (isBeat) beatPulse.current = 1;
  }, [isBeat]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioFeatures) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const centerY = height / 2;
    const [r, g, b] = hexToRgb(accentColor);
    const { rms } = audioFeatures;

    // Beat pulse
    beatPulse.current *= 0.8;
    const pulse = beatPulse.current;

    // Smooth amplitude — follows volume, spikes on beats
    const targetAmp = Math.min(0.95, 0.25 + rms * 4.5 + pulse * 0.7);
    smoothAmp.current += (targetAmp - smoothAmp.current) * 0.08;
    const amp = smoothAmp.current;

    // Phase scrolls at BPM — 3 cycles every 4 beats
    const beatsPerSec = (bpm || 120) / 60;
    const phase = (performance.now() / 1000) * beatsPerSec * Math.PI * 2;

    // Smooth pseudo-random envelope — big variation in peak heights
    function envelope(t: number): number {
      return 0.4
        + Math.sin(t * 1.7 + phase * 0.3) * 0.3
        + Math.sin(t * 3.1 - phase * 0.2) * 0.2
        + Math.sin(t * 5.3 + phase * 0.15) * 0.1;
    }

    // Clean sine wave with gentle harmonic, modulated by envelope
    function wave(t: number): number {
      const main = Math.sin(t * CYCLES * Math.PI * 2 + phase);
      const harmonic = Math.sin(t * CYCLES * 2 * Math.PI * 2 + phase * 2) * 0.12;
      return (main + harmonic) * envelope(t);
    }

    // Beat glow
    if (pulse > 0.05) {
      ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${pulse * 0.6})`;
      ctx.shadowBlur = 25 * pulse * devicePixelRatio;
    }

    // Main wave
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.75 + pulse * 0.25})`;
    ctx.lineWidth = (2 + pulse * 3) * devicePixelRatio;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (let i = 0; i <= POINTS; i++) {
      const t = i / POINTS;
      const y = centerY + wave(t) * amp * centerY;
      if (i === 0) ctx.moveTo(0, y);
      else ctx.lineTo(t * width, y);
    }
    ctx.stroke();

    // Soft fill between wave and center
    ctx.lineTo(width, centerY);
    ctx.lineTo(0, centerY);
    ctx.closePath();
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.03 + pulse * 0.05})`;
    ctx.fill();

    ctx.shadowBlur = 0;

    // Mirror (inverted, softer)
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.12 + pulse * 0.08})`;
    ctx.lineWidth = 1.5 * devicePixelRatio;
    for (let i = 0; i <= POINTS; i++) {
      const t = i / POINTS;
      const y = centerY - wave(t) * amp * centerY * 0.45;
      if (i === 0) ctx.moveTo(0, y);
      else ctx.lineTo(t * width, y);
    }
    ctx.stroke();

    // Center line
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.06)`;
    ctx.lineWidth = 1 * devicePixelRatio;
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
  }, [audioFeatures, accentColor, isBeat, bpm]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
