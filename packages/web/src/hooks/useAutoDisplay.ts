import { useEffect } from 'react';
import { useStore } from '../store';

/**
 * Auto-switches display mode based on content availability.
 * Priority: video > lyrics > visualizer
 *
 * Waits for video search to complete before falling back to lyrics,
 * so the display doesn't flash lyrics then jump to video.
 */
export function useAutoDisplay() {
  const currentSong = useStore((s) => s.currentSong);
  const videoId = useStore((s) => s.videoId);
  const videoSearching = useStore((s) => s.videoSearching);
  const lyrics = useStore((s) => s.lyrics);
  const setAppMode = useStore((s) => s.setAppMode);

  useEffect(() => {
    if (!currentSong) return;

    // Priority 1: Video available — show it immediately
    if (videoId) {
      setAppMode('video');
      return;
    }

    // Still searching for video — stay on visualizer, don't commit to lyrics yet
    if (videoSearching) return;

    // Priority 2: No video, but lyrics available
    if (lyrics.length > 0) {
      setAppMode('lyrics');
      return;
    }

    // Priority 3: Nothing available — visualizer fallback
    setAppMode('visualizer');
  }, [currentSong, videoId, videoSearching, lyrics, setAppMode]);
}
