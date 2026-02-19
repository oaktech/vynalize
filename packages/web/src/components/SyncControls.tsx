import { useState, useEffect } from 'react';
import { useStore } from '../store';

export default function SyncControls() {
  const appMode = useStore((s) => s.appMode);
  const lyrics = useStore((s) => s.lyrics);
  const positionOffsetMs = useStore((s) => s.position.offsetMs);
  const adjustOffset = useStore((s) => s.adjustOffset);
  const videoOffsetMs = useStore((s) => s.videoOffsetMs);
  const adjustVideoOffset = useStore((s) => s.adjustVideoOffset);
  const tapSync = useStore((s) => s.tapSync);
  const [displayTime, setDisplayTime] = useState('0:00');

  const isVideo = appMode === 'video';
  const adjust = isVideo ? adjustVideoOffset : adjustOffset;
  const activeOffsetMs = isVideo ? videoOffsetMs : positionOffsetMs;

  // Update time display at a reasonable rate
  useEffect(() => {
    const interval = setInterval(() => {
      const pos = useStore.getState().position;
      if (pos.startedAt) {
        const elapsed = performance.now() - pos.startedAt;
        const totalMs = elapsed + pos.offsetMs;
        const totalSec = Math.max(0, Math.floor(totalMs / 1000));
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        setDisplayTime(`${min}:${sec.toString().padStart(2, '0')}`);
      }
    }, 250);
    return () => clearInterval(interval);
  }, []);

  // Find first lyric line to use as sync target
  const firstLyric = lyrics.length > 0 ? lyrics[0] : null;

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <span className="text-xs text-white/40 tabular-nums font-mono">
        {displayTime}
      </span>

      {isVideo && (
        <span className="text-[10px] text-white/30 uppercase tracking-wider">
          Video
        </span>
      )}

      <div className="flex items-center gap-1">
        <button
          onClick={() => adjust(-1000)}
          aria-label="Shift sync back 1 second"
          className="px-3 py-2.5 sm:px-2 sm:py-1 text-sm sm:text-xs text-white/50 hover:text-white active:bg-white/15 bg-white/5 hover:bg-white/10 rounded transition-colors"
        >
          -1s
        </button>
        <button
          onClick={() => adjust(-200)}
          aria-label="Shift sync back 0.2 seconds"
          className="px-3 py-2.5 sm:px-2 sm:py-1 text-sm sm:text-xs text-white/50 hover:text-white active:bg-white/15 bg-white/5 hover:bg-white/10 rounded transition-colors"
        >
          -0.2s
        </button>
        <button
          onClick={() => adjust(200)}
          aria-label="Shift sync forward 0.2 seconds"
          className="px-3 py-2.5 sm:px-2 sm:py-1 text-sm sm:text-xs text-white/50 hover:text-white active:bg-white/15 bg-white/5 hover:bg-white/10 rounded transition-colors"
        >
          +0.2s
        </button>
        <button
          onClick={() => adjust(1000)}
          aria-label="Shift sync forward 1 second"
          className="px-3 py-2.5 sm:px-2 sm:py-1 text-sm sm:text-xs text-white/50 hover:text-white active:bg-white/15 bg-white/5 hover:bg-white/10 rounded transition-colors"
        >
          +1s
        </button>
      </div>

      {!isVideo && firstLyric && (
        <button
          onClick={() => tapSync(firstLyric.timeMs)}
          className="px-3 py-2.5 sm:px-3 sm:py-1 text-sm sm:text-xs font-medium text-white/70 hover:text-white active:bg-white/15 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          title={`Tap when you hear: "${firstLyric.text}"`}
        >
          Tap Sync
        </button>
      )}

      {activeOffsetMs !== 0 && (
        <span className="text-[10px] text-white/30 tabular-nums">
          {isVideo ? 'video ' : ''}offset: {activeOffsetMs > 0 ? '+' : ''}{(activeOffsetMs / 1000).toFixed(1)}s
        </span>
      )}
    </div>
  );
}
