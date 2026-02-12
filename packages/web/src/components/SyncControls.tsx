import { useState, useEffect } from 'react';
import { useStore } from '../store';

export default function SyncControls() {
  const lyrics = useStore((s) => s.lyrics);
  const offsetMs = useStore((s) => s.position.offsetMs);
  const adjustOffset = useStore((s) => s.adjustOffset);
  const tapSync = useStore((s) => s.tapSync);
  const [displayTime, setDisplayTime] = useState('0:00');

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
    <div className="flex items-center gap-3">
      <span className="text-xs text-white/40 tabular-nums font-mono">
        {displayTime}
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => adjustOffset(-1000)}
          className="px-2 py-1 text-xs text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors"
        >
          -1s
        </button>
        <button
          onClick={() => adjustOffset(-200)}
          className="px-2 py-1 text-xs text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors"
        >
          -0.2s
        </button>
        <button
          onClick={() => adjustOffset(200)}
          className="px-2 py-1 text-xs text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors"
        >
          +0.2s
        </button>
        <button
          onClick={() => adjustOffset(1000)}
          className="px-2 py-1 text-xs text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors"
        >
          +1s
        </button>
      </div>

      {firstLyric && (
        <button
          onClick={() => tapSync(firstLyric.timeMs)}
          className="px-3 py-1 text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          title={`Tap when you hear: "${firstLyric.text}"`}
        >
          Tap Sync
        </button>
      )}

      {offsetMs !== 0 && (
        <span className="text-[10px] text-white/30 tabular-nums">
          offset: {offsetMs > 0 ? '+' : ''}{(offsetMs / 1000).toFixed(1)}s
        </span>
      )}
    </div>
  );
}
