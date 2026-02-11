import { useEffect } from 'react';
import { useStore } from '../store';

function extractDominantColor(imgUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, 32, 32);
      const data = ctx.getImageData(0, 0, 32, 32).data;

      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        // Skip very dark / very light pixels
        const brightness = data[i] + data[i + 1] + data[i + 2];
        if (brightness > 60 && brightness < 700) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
      }

      if (count === 0) {
        resolve('#8b5cf6');
        return;
      }

      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);

      // Boost saturation slightly
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max - min < 30) {
        resolve('#8b5cf6');
        return;
      }

      resolve(`rgb(${r}, ${g}, ${b})`);
    };
    img.onerror = () => resolve('#8b5cf6');
    img.src = imgUrl;
  });
}

export default function NowPlaying() {
  const currentSong = useStore((s) => s.currentSong);
  const isIdentifying = useStore((s) => s.isIdentifying);
  const setAccentColor = useStore((s) => s.setAccentColor);

  useEffect(() => {
    if (currentSong?.albumArtUrl) {
      extractDominantColor(currentSong.albumArtUrl).then(setAccentColor);
    }
  }, [currentSong?.albumArtUrl, setAccentColor]);

  if (!currentSong && !isIdentifying) return null;

  if (!currentSong && isIdentifying) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-white/5 animate-pulse" />
        <div>
          <div className="h-4 w-32 bg-white/10 rounded animate-pulse mb-1" />
          <div className="h-3 w-24 bg-white/5 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!currentSong) return null;

  return (
    <div className="flex items-center gap-3 max-w-md">
      {currentSong.albumArtUrl ? (
        <img
          src={currentSong.albumArtUrl}
          alt={currentSong.album}
          className="w-12 h-12 rounded-lg shadow-lg object-cover"
        />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white truncate">
          {currentSong.title}
        </p>
        <p className="text-xs text-white/60 truncate">
          {currentSong.artist}
          {currentSong.album && ` — ${currentSong.album}`}
        </p>
      </div>
    </div>
  );
}
