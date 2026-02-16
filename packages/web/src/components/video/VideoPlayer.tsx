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
          events?: Record<string, (event: { target: YTPlayer; data: number }) => void>;
        }
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YTPlayer {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  destroy: () => void;
  getPlayerState: () => number;
}

/** Calculate the target video position in seconds.
 *  Prefers checkpoint (saved when video was last unmounted) for accurate resync. */
function getTargetVideoSec(): number | null {
  const { position, videoOffsetMs, videoCheckpoint } = useStore.getState();

  // Use checkpoint if available — more accurate on mode switch back
  if (videoCheckpoint) {
    const elapsed = (performance.now() - videoCheckpoint.at) / 1000;
    return videoCheckpoint.timeSec + elapsed;
  }

  if (!position.startedAt) return null;
  const elapsed = performance.now() - position.startedAt;
  return (elapsed + position.offsetMs + videoOffsetMs) / 1000;
}

let apiLoaded = false;
let apiReady = false;
const readyCallbacks: (() => void)[] = [];

function loadYouTubeAPI(): Promise<void> {
  // Handle HMR: API script already loaded from previous module instance
  if (window.YT?.Player) {
    apiLoaded = true;
    apiReady = true;
    return Promise.resolve();
  }
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
  const videoOffsetMs = useStore((s) => s.videoOffsetMs);
  const setAppMode = useStore((s) => s.setAppMode);
  const playerRef = useRef<YTPlayer | null>(null);
  const containerIdRef = useRef(`yt-player-${Date.now()}`);
  const lastSeekRef = useRef(0);

  // Initialize YouTube player
  useEffect(() => {
    if (!videoId) return;

    let player: YTPlayer | null = null;
    const startSec = Math.max(0, Math.floor(getTargetVideoSec() ?? 0));

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
          start: startSec,
        },
        events: {
          onReady: (event: { target: YTPlayer }) => {
            event.target.mute();
            event.target.playVideo();
            playerRef.current = event.target;

            // Seek to precise sub-second position (start param is integer-only)
            const target = getTargetVideoSec();
            if (target && target > 1) {
              event.target.seekTo(target, true);
              lastSeekRef.current = Date.now();
            }
            // Clear checkpoint after initial seek — drift correction takes over
            useStore.getState().setVideoCheckpoint(null);
          },
          onStateChange: (event: { target: YTPlayer; data: number }) => {
            // YT state 0 = ended
            if (event.data === 0) {
              useStore.getState().setVisualizerMode('synthwave');
              useStore.getState().setAppMode('visualizer');
            }
          },
        },
      });
    });

    return () => {
      if (player) {
        try {
          // Save the video's actual position so we can resync on return
          const timeSec = player.getCurrentTime();
          if (timeSec > 0) {
            useStore.getState().setVideoCheckpoint({ timeSec, at: performance.now() });
          }
          player.destroy();
        } catch {}
      }
      playerRef.current = null;
    };
  }, [videoId]);

  // Immediately seek when video offset is adjusted by the user
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const target = getTargetVideoSec();
    if (!target || target < 1) return;
    player.seekTo(target, true);
    lastSeekRef.current = Date.now();
  }, [videoOffsetMs]);

  // Drift-based sync: read YouTube's actual position, only seek when off by >2s
  useEffect(() => {
    const DRIFT_THRESHOLD = 2; // seconds — only seek if drift exceeds this
    const SEEK_COOLDOWN = 5000; // ms — let YouTube settle after a seek

    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;

      const target = getTargetVideoSec();
      if (!target || target < 1) return;

      const now = Date.now();
      if (now - lastSeekRef.current < SEEK_COOLDOWN) return;

      const actual = player.getCurrentTime();
      const drift = Math.abs(actual - target);

      if (drift > DRIFT_THRESHOLD) {
        player.seekTo(target, true);
        lastSeekRef.current = now;
      }
    }, 1000);
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
