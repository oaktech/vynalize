import { useEffect } from 'react';
import { useStore } from '../store';

export function usePositionTracker() {
  const currentSong = useStore((s) => s.currentSong);
  const resetPosition = useStore((s) => s.resetPosition);

  // Reset position when song is cleared
  useEffect(() => {
    if (!currentSong) {
      resetPosition();
    }
  }, [currentSong, resetPosition]);
}
