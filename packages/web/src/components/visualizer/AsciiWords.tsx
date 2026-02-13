import { useRef, useEffect, useState, useCallback } from 'react';
import { useStore } from '../../store';

const RAMP = ' .·:;+=xX$@';
const RAMP_LAST = RAMP.length - 1;

const BASE_PX = 10;
const CHAR_W = BASE_PX * 0.6;
const CHAR_H = BASE_PX;
const DENSITY = 5;

// Reuse one canvas — willReadFrequently keeps data in CPU, avoids GPU readback
let _canvas: HTMLCanvasElement | null = null;
let _ctx: CanvasRenderingContext2D | null = null;

function getCtx() {
  if (!_ctx) {
    _canvas = document.createElement('canvas');
    _ctx = _canvas.getContext('2d', { willReadFrequently: true })!;
  }
  return _ctx;
}

const cache = new Map<string, { art: string; cols: number; rows: number }>();

type AsciiResult = { art: string; cols: number; rows: number };
const EMPTY: AsciiResult = { art: '', cols: 0, rows: 0 };

function textToAscii(text: string): AsciiResult {
  if (!text.trim()) return EMPTY;

  const cached = cache.get(text);
  if (cached) return cached;

  const ctx = getCtx();
  const canvas = _canvas!;

  const word = text.toUpperCase();
  const fontSize = 160;
  const font = `900 ${fontSize}px Impact, "Arial Black", sans-serif`;

  ctx.font = font;
  const m = ctx.measureText(word);
  const pad = fontSize * 0.1;

  canvas.width = Math.ceil(m.width + pad * 2);
  canvas.height = Math.ceil(fontSize * 1.2);

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = font;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(word, pad, fontSize);

  const cols = Math.ceil(canvas.width / DENSITY);
  const rows = Math.max(1, Math.ceil(canvas.height / (DENSITY / 0.45)));
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const cw = canvas.width;

  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    const yOff = Math.floor((r / rows) * canvas.height) * cw;
    const chars: string[] = [];
    for (let c = 0; c < cols; c++) {
      const sx = Math.floor((c / cols) * cw);
      const b = data[(yOff + sx) * 4];
      chars.push(RAMP[(b * RAMP_LAST + 127) >> 8]);
    }
    lines.push(chars.join(''));
  }

  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();

  const result: AsciiResult = { art: lines.join('\n'), cols, rows: lines.length };

  if (cache.size >= 50) cache.delete(cache.keys().next().value!);
  cache.set(text, result);

  return result;
}

function stripPunctuation(w: string): string {
  return w.replace(/[^a-zA-Z0-9']/g, '');
}

function hexToHsl(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

export default function AsciiWords({ accentColor }: { accentColor: string }) {
  const currentSong = useStore((s) => s.currentSong);
  const isBeat = useStore((s) => s.isBeat);

  const containerRef = useRef<HTMLDivElement>(null);
  const [asciiData, setAsciiData] = useState(EMPTY);
  const [scale, setScale] = useState(1);
  const [displayColor, setDisplayColor] = useState(accentColor);
  const currentWordRef = useRef('');
  const hueOffset = useRef(0);

  // Shift hue on each beat
  useEffect(() => {
    if (!isBeat) return;
    hueOffset.current = (hueOffset.current + 35 + Math.random() * 25) % 360;
    const [h, s, l] = hexToHsl(accentColor);
    const newH = (h + hueOffset.current) % 360;
    setDisplayColor(`hsl(${newH}, ${s}%, ${l}%)`);
  }, [isBeat, accentColor]);

  // Reset color when accent color changes (new song)
  useEffect(() => {
    hueOffset.current = 0;
    setDisplayColor(accentColor);
  }, [accentColor]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || asciiData.cols === 0) return;

    const update = () => {
      const cw = el.clientWidth * 0.88;
      const ch = el.clientHeight * 0.6;
      setScale(Math.min(cw / (asciiData.cols * CHAR_W), ch / (asciiData.rows * CHAR_H), 8));
    };

    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [asciiData]);

  // Word tracking — throttled to avoid blocking main thread
  const updateWord = useCallback(() => {
    const { position, lyrics } = useStore.getState();
    let newWord = '';

    if (!position.startedAt || lyrics.length === 0) {
      newWord = currentSong?.title || '';
    } else {
      const posMs = performance.now() - position.startedAt + position.offsetMs;

      let idx = 0;
      for (let i = lyrics.length - 1; i >= 0; i--) {
        if (lyrics[i].timeMs <= posMs) { idx = i; break; }
      }

      const line = lyrics[idx];
      const next = lyrics[idx + 1];
      const words = line.text.split(/\s+/).map(stripPunctuation).filter((w) => w.length > 0);

      if (words.length > 0) {
        const dur = (next ? next.timeMs : line.timeMs + 4000) - line.timeMs;
        const progress = Math.max(0, Math.min(0.999, (posMs - line.timeMs) / dur));
        newWord = words[Math.floor(progress * words.length)];
      }
    }

    if (newWord && newWord !== currentWordRef.current) {
      currentWordRef.current = newWord;
      setAsciiData(textToAscii(newWord));
    }
  }, [currentSong]);

  // Poll for word changes at 10Hz instead of every frame
  useEffect(() => {
    const id = setInterval(updateWord, 100);
    updateWord();
    return () => clearInterval(id);
  }, [updateWord]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-hidden"
    >
      <pre
        className="select-none"
        style={{
          fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", "Cascadia Code", "Menlo", monospace',
          fontSize: `${BASE_PX}px`,
          lineHeight: '1',
          letterSpacing: '0.05em',
          color: displayColor,
          whiteSpace: 'pre',
          textAlign: 'center',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          transition: 'transform 0.3s ease-out, color 0.15s ease-out, filter 0.15s ease-out',
          filter: `drop-shadow(0 0 8px ${displayColor})`,
        }}
      >
        {asciiData.art}
      </pre>
    </div>
  );
}
