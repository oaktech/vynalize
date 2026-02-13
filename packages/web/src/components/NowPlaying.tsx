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
        <div className="w-14 h-14 md:w-16 md:h-16 rounded-lg bg-white/5 animate-pulse" />
        <div>
          <div className="h-5 w-36 bg-white/10 rounded animate-pulse mb-1.5" />
          <div className="h-3.5 w-28 bg-white/5 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!currentSong) return null;

  return (
    <div className="flex items-center gap-5 max-w-2xl">
      {currentSong.albumArtUrl ? (
        <img
          src={currentSong.albumArtUrl}
          alt={currentSong.album}
          className="w-20 h-20 md:w-24 md:h-24 rounded-xl shadow-2xl object-cover flex-shrink-0 ring-1 ring-white/10"
        />
      ) : (
        <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xl md:text-2xl font-bold text-white truncate leading-tight">
          {currentSong.title}
        </p>
        <p className="text-base md:text-lg text-white/70 truncate mt-1">
          {currentSong.artist}
        </p>
        {currentSong.album && (
          <p className="text-sm text-white/40 truncate mt-0.5">
            {currentSong.album}
          </p>
        )}
      </div>
    </div>
  );
}
