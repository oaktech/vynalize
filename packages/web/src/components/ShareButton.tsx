import { useCallback } from 'react';
import { useStore } from '../store';

export default function ShareButton() {
  const currentSong = useStore((s) => s.currentSong);

  const handleShare = useCallback(async () => {
    if (!currentSong) return;

    // Find the visualizer canvas
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    // Create a composite image: canvas + song info overlay
    const w = canvas.width;
    const h = canvas.height;
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d')!;

    // Draw the visualizer frame
    ctx.drawImage(canvas, 0, 0);

    // Semi-transparent overlay at bottom
    const gradH = h * 0.25;
    const grad = ctx.createLinearGradient(0, h - gradH, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h - gradH, w, gradH);

    // Song info text
    const scale = Math.max(1, w / 1920);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(28 * scale)}px sans-serif`;
    ctx.fillText(currentSong.title, 24 * scale, h - 60 * scale);
    ctx.font = `${Math.round(18 * scale)}px sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(currentSong.artist, 24 * scale, h - 32 * scale);

    // Watermark
    ctx.font = `${Math.round(11 * scale)}px sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('Visualized with Vynalize', w - 180 * scale, h - 12 * scale);

    // Convert to blob
    const blob = await new Promise<Blob | null>((resolve) =>
      offscreen.toBlob(resolve, 'image/png'),
    );
    if (!blob) return;

    const file = new File([blob], 'vynalize-now-playing.png', { type: 'image/png' });

    // Try Web Share API first (mobile)
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          title: `${currentSong.title} — ${currentSong.artist}`,
          files: [file],
        });
        return;
      } catch {
        // User cancelled or share failed — fall through to download
      }
    }

    // Fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vynalize-now-playing.png';
    a.click();
    URL.revokeObjectURL(url);
  }, [currentSong]);

  if (!currentSong) return null;

  return (
    <button
      onClick={handleShare}
      className="p-3 sm:p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
      aria-label="Share now playing"
      title="Share screenshot"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    </button>
  );
}
