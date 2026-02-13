import { useEffect, useRef } from 'react';
import { useStore } from '../../store';

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
  const playerRef = useRef<YTPlayer | null>(null);
  const containerIdRef = useRef(`yt-player-${Date.now()}`);
  const lastSeekRef = useRef(0);

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

  if (!videoId) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-white/40 text-lg">
          {currentSong ? 'No video available' : 'Waiting for song identification...'}
        </p>
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
