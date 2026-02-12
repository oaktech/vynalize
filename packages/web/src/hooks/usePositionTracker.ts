import { useEffect, useRef } from 'react';
import { useStore } from '../store';

export function usePositionTracker() {
  const setPosition = useStore((s) => s.setPosition);
  const resetPosition = useStore((s) => s.resetPosition);
  const currentSong = useStore((s) => s.currentSong);
  const prevSongRef = useRef<string | null>(null);

  // Start/reset tracking when song changes
  useEffect(() => {
    const songKey = currentSong
      ? `${currentSong.title}::${currentSong.artist}`
      : null;

    if (songKey && songKey !== prevSongRef.current) {
      prevSongRef.current = songKey;
      setPosition({
        isTracking: true,
        startedAt: performance.now(),
        elapsedMs: 0,
        offsetMs: 0,
      });
    } else if (!songKey) {
      prevSongRef.current = null;
      resetPosition();
    }
  }, [currentSong, setPosition, resetPosition]);
}
