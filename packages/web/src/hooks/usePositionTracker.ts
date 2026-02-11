import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';

export function usePositionTracker() {
  const position = useStore((s) => s.position);
  const setPosition = useStore((s) => s.setPosition);
  const resetPosition = useStore((s) => s.resetPosition);
  const currentSong = useStore((s) => s.currentSong);
  const rafRef = useRef<number>(0);

  // Start tracking when a song is identified
  useEffect(() => {
    if (currentSong && !position.isTracking) {
      setPosition({
        isTracking: true,
        startedAt: performance.now(),
        elapsedMs: 0,
      });
    }
  }, [currentSong, position.isTracking, setPosition]);

  // Reset when song changes
  useEffect(() => {
    resetPosition();
  }, [currentSong?.title, currentSong?.artist, resetPosition]);

  // Update elapsed time each frame
  useEffect(() => {
    if (!position.isTracking || !position.startedAt) return;

    function tick() {
      const elapsed = performance.now() - position.startedAt!;
      setPosition({ elapsedMs: elapsed });
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [position.isTracking, position.startedAt, setPosition]);

  const getCurrentPositionMs = useCallback(() => {
    return position.elapsedMs + position.offsetMs;
  }, [position.elapsedMs, position.offsetMs]);

  const adjustOffset = useCallback(
    (deltaMs: number) => {
      setPosition({ offsetMs: position.offsetMs + deltaMs });
    },
    [position.offsetMs, setPosition]
  );

  const tapSync = useCallback(
    (targetMs: number) => {
      const drift = targetMs - position.elapsedMs;
      setPosition({ offsetMs: drift });
    },
    [position.elapsedMs, setPosition]
  );

  return { getCurrentPositionMs, adjustOffset, tapSync };
}
