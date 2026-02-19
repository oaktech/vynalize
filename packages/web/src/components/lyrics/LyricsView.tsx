import { useRef, useEffect, useState, useMemo } from 'react';
import { useStore } from '../../store';
import KaraokeLine from './KaraokeLine';
import QRPrompt from '../QRPrompt';

function findCurrentIndex(lyrics: { timeMs: number }[], posMs: number): number {
  // Binary search for the last line where timeMs <= posMs
  let lo = 0;
  let hi = lyrics.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (lyrics[mid].timeMs <= posMs) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

export default function LyricsView() {
  const lyrics = useStore((s) => s.lyrics);
  const currentSong = useStore((s) => s.currentSong);
  const accentColor = useStore((s) => s.accentColor);
  const remoteConnected = useStore((s) => s.remoteConnected);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(-1);

  // Drive position from store — only re-render when currentIndex changes
  useEffect(() => {
    let active = true;
    let lastIndex = -1;

    function tick() {
      if (!active) return;
      const pos = useStore.getState().position;
      if (pos.startedAt) {
        const elapsed = performance.now() - pos.startedAt;
        const posMs = elapsed + pos.offsetMs;
        const idx = findCurrentIndex(lyrics, posMs);
        if (idx !== lastIndex) {
          lastIndex = idx;
          setCurrentIndex(idx);
        }
      }
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
    return () => { active = false; };
  }, [lyrics]);

  // Detect chorus lines: text that appears more than once (normalized)
  const chorusSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const line of lyrics) {
      const key = line.text.trim().toLowerCase();
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const set = new Set<string>();
    for (const [key, count] of counts) {
      if (count > 1) set.add(key);
    }
    return set;
  }, [lyrics]);

  // Auto-scroll to active line
  const lastScrolledIndex = useRef(-1);
  useEffect(() => {
    if (currentIndex !== lastScrolledIndex.current && activeLineRef.current) {
      lastScrolledIndex.current = currentIndex;
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentIndex]);

  if (lyrics.length === 0) {
    if (!remoteConnected) return <QRPrompt />;
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          {currentSong ? (
            <>
              <p className="text-white/40 text-lg">No synced lyrics found</p>
              <p className="text-white/20 text-sm mt-2">
                for &ldquo;{currentSong.title}&rdquo; by {currentSong.artist}
              </p>
            </>
          ) : (
            <>
              <p className="text-white/40 text-lg">Waiting for song identification...</p>
              <p className="text-white/20 text-sm mt-2">
                Play some music and lyrics will appear here
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {/* Album art background */}
      {currentSong?.albumArtUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.05] blur-3xl scale-110"
          style={{ backgroundImage: `url(${currentSong.albumArtUrl})` }}
        />
      )}

      <div
        ref={containerRef}
        className="absolute inset-0 overflow-y-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="min-h-full flex flex-col items-center justify-center px-4 sm:px-8 py-[40vh]">
          {lyrics.map((line, i) => (
            <div
              key={`${line.timeMs}-${i}`}
              ref={i === currentIndex ? activeLineRef : undefined}
              className="w-full max-w-3xl text-center"
            >
              <KaraokeLine
                text={line.text}
                isActive={i === currentIndex}
                isPast={i < currentIndex}
                isChorus={chorusSet.has(line.text.trim().toLowerCase())}
                accentColor={accentColor}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
