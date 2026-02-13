import { useEffect } from 'react';
import { useStore } from '../store';
import { searchMusicVideo } from '../services/videoApi';

export function useVideoSearch() {
  const currentSong = useStore((s) => s.currentSong);
  const setVideoId = useStore((s) => s.setVideoId);
  const setVideoSearching = useStore((s) => s.setVideoSearching);
  const setVideoOffsetMs = useStore((s) => s.setVideoOffsetMs);

  useEffect(() => {
    if (!currentSong) {
      setVideoId(null);
      setVideoSearching(false);
      return;
    }

    let cancelled = false;
    setVideoSearching(true);
    setVideoId(null);
    setVideoOffsetMs(0);

    searchMusicVideo(currentSong.artist, currentSong.title)
      .then((id) => {
        if (cancelled) return;
        setVideoId(id);
        setVideoSearching(false);
      })
      .catch(() => {
        if (cancelled) return;
        setVideoId(null);
        setVideoSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentSong, setVideoId, setVideoSearching]);
}
