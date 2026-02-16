import { useEffect } from 'react';
import { useStore } from '../store';
import { fetchLyrics } from '../services/lyricsApi';

export function useLyrics() {
  const currentSong = useStore((s) => s.currentSong);
  const setLyrics = useStore((s) => s.setLyrics);

  useEffect(() => {
    if (!currentSong) {
      setLyrics([]);
      return;
    }

    let cancelled = false;

    // Clear stale lyrics immediately so the previous song's lyrics don't linger
    setLyrics([]);

    fetchLyrics(currentSong.artist, currentSong.title).then((lines) => {
      if (!cancelled) {
        setLyrics(lines);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentSong, setLyrics]);
}
