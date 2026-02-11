import { useRef, useEffect, useMemo } from 'react';
import { useStore } from '../../store';
import KaraokeLine from './KaraokeLine';

export default function LyricsView() {
  const lyrics = useStore((s) => s.lyrics);
  const position = useStore((s) => s.position);
  const currentSong = useStore((s) => s.currentSong);
  const accentColor = useStore((s) => s.accentColor);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  const posMs = position.elapsedMs + position.offsetMs;

  // Find current line index
  const currentIndex = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].timeMs <= posMs) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [lyrics, posMs]);

  // Calculate progress through current line
  const lineProgress = useMemo(() => {
    if (currentIndex < 0 || currentIndex >= lyrics.length) return 0;
    const lineStart = lyrics[currentIndex].timeMs;
    const lineEnd =
      currentIndex < lyrics.length - 1
        ? lyrics[currentIndex + 1].timeMs
        : lineStart + 4000;
    const duration = lineEnd - lineStart;
    return Math.max(0, Math.min(1, (posMs - lineStart) / duration));
  }, [currentIndex, lyrics, posMs]);

  // Auto-scroll to active line
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentIndex]);

  if (lyrics.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          {currentSong ? (
            <>
              <p className="text-white/40 text-lg">No synced lyrics found</p>
              <p className="text-white/20 text-sm mt-2">
                for "{currentSong.title}" by {currentSong.artist}
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
        <div className="min-h-full flex flex-col items-center justify-center px-8 py-[40vh]">
          {lyrics.map((line, i) => (
            <div
              key={`${line.timeMs}-${i}`}
              ref={i === currentIndex ? activeLineRef : undefined}
              className="w-full max-w-3xl text-center"
            >
              <KaraokeLine
                text={line.text}
                progress={i === currentIndex ? lineProgress : i < currentIndex ? 1 : 0}
                isActive={i === currentIndex}
                isPast={i < currentIndex}
                accentColor={accentColor}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
