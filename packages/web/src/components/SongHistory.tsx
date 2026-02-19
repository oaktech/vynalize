import { useState } from 'react';
import { useStore } from '../store';

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default function SongHistory() {
  const [isOpen, setIsOpen] = useState(false);
  const songHistory = useStore((s) => s.songHistory);

  if (songHistory.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 text-xs text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
        aria-label="Song history"
        title="Song history"
      >
        History ({songHistory.length})
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 max-h-96 overflow-y-auto bg-black/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl">
          <div className="sticky top-0 bg-black/95 px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-sm font-medium text-white/70">Recently Played</span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-white/30 hover:text-white/60"
              aria-label="Close history"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="divide-y divide-white/5">
            {songHistory.map((entry, i) => (
              <div key={`${entry.song.title}-${entry.identifiedAt}-${i}`} className="flex items-center gap-3 px-4 py-3">
                {entry.song.albumArtUrl ? (
                  <img
                    src={entry.song.albumArtUrl}
                    alt=""
                    className="w-10 h-10 rounded-md object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-md bg-white/10 flex items-center justify-center flex-shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30">
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white/90 truncate">{entry.song.title}</p>
                  <p className="text-xs text-white/40 truncate">{entry.song.artist}</p>
                </div>
                <span className="text-[10px] text-white/25 flex-shrink-0">{timeAgo(entry.identifiedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
