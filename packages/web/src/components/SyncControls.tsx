import { useStore } from '../store';
import { usePositionTracker } from '../hooks/usePositionTracker';

export default function SyncControls() {
  const position = useStore((s) => s.position);
  const lyrics = useStore((s) => s.lyrics);
  const { adjustOffset, tapSync } = usePositionTracker();

  const posMs = position.elapsedMs + position.offsetMs;
  const posSec = Math.max(0, Math.floor(posMs / 1000));
  const minutes = Math.floor(posSec / 60);
  const seconds = posSec % 60;

  // Find first lyric line to use as sync target
  const firstLyric = lyrics.length > 0 ? lyrics[0] : null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-white/40 tabular-nums font-mono">
        {minutes}:{seconds.toString().padStart(2, '0')}
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

      {position.offsetMs !== 0 && (
        <span className="text-[10px] text-white/30 tabular-nums">
          offset: {position.offsetMs > 0 ? '+' : ''}{(position.offsetMs / 1000).toFixed(1)}s
        </span>
      )}
    </div>
  );
}
