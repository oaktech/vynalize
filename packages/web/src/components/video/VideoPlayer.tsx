import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { searchMusicVideo } from '../../services/videoApi';

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        config: {
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: Record<string, (event: { target: YTPlayer }) => void>;
        }
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YTPlayer {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  destroy: () => void;
  getPlayerState: () => number;
}

let apiLoaded = false;
let apiReady = false;
const readyCallbacks: (() => void)[] = [];

function loadYouTubeAPI(): Promise<void> {
  if (apiReady) return Promise.resolve();
  return new Promise((resolve) => {
    if (apiLoaded) {
      readyCallbacks.push(resolve);
      return;
    }
    apiLoaded = true;
    readyCallbacks.push(resolve);

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      apiReady = true;
      readyCallbacks.forEach((cb) => cb());
      readyCallbacks.length = 0;
    };
  });
}

export default function VideoPlayer() {
  const currentSong = useStore((s) => s.currentSong);
  const videoId = useStore((s) => s.videoId);
  const setVideoId = useStore((s) => s.setVideoId);
  const playerRef = useRef<YTPlayer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerIdRef = useRef(`yt-player-${Date.now()}`);
  const lastSeekRef = useRef(0);

  // Search for video when song changes
  useEffect(() => {
    if (!currentSong) {
      setVideoId(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    searchMusicVideo(currentSong.artist, currentSong.title).then((id) => {
      if (cancelled) return;
      setLoading(false);
      if (id) {
        setVideoId(id);
      } else {
        setError('No video found');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentSong, setVideoId]);

  // Initialize YouTube player
  useEffect(() => {
    if (!videoId) return;

    let player: YTPlayer | null = null;

    loadYouTubeAPI().then(() => {
      player = new window.YT.Player(containerIdRef.current, {
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          fs: 0,
          iv_load_policy: 3,
        },
        events: {
          onReady: (event: { target: YTPlayer }) => {
            event.target.mute();
            event.target.playVideo();
            playerRef.current = event.target;
          },
        },
      });
    });

    return () => {
      if (player) {
        try {
          player.destroy();
        } catch {}
      }
      playerRef.current = null;
    };
  }, [videoId]);

  // Sync position periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (!playerRef.current) return;
      const pos = useStore.getState().position;
      if (!pos.startedAt) return;

      const elapsed = performance.now() - pos.startedAt;
      const totalMs = elapsed + pos.offsetMs;
      const posSec = totalMs / 1000;
      const now = Date.now();

      if (now - lastSeekRef.current > 10000 && posSec > 1) {
        playerRef.current.seekTo(posSec, true);
        lastSeekRef.current = now;
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [videoId]);

  if (!currentSong) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-white/40 text-lg">Waiting for song identification...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-white/40 text-sm">Searching for music video...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/40 text-lg">{error}</p>
          <p className="text-white/20 text-sm mt-2">
            for "{currentSong.title}" by {currentSong.artist}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <div className="w-full h-full max-w-[177.78vh] max-h-[56.25vw]">
        <div
          id={containerIdRef.current}
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
