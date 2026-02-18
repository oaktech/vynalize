import { useEffect, useRef, useCallback } from 'react';
import { useAudioCapture } from './hooks/useAudioCapture';
import { useAudioAnalysis } from './hooks/useAudioAnalysis';
import { useBeatDetection } from './hooks/useBeatDetection';
import { useSongId } from './hooks/useSongId';
import { useLyrics } from './hooks/useLyrics';
import { useVideoSearch } from './hooks/useVideoSearch';
import { useAutoDisplay } from './hooks/useAutoDisplay';
import { usePositionTracker } from './hooks/usePositionTracker';
import { useWsCommands } from './hooks/useWsCommands';
import { useStore } from './store';
import AppShell from './components/AppShell';
import RemoteControl from './components/RemoteControl';

function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="w-screen h-dvh flex items-center justify-center bg-black px-6">
      <div className="text-center max-w-md w-full">
        <img
          src="/vynalize-logo.png"
          alt="Vynalize"
          className="w-full max-w-72 sm:max-w-96 mx-auto mb-6 sm:mb-8"
        />
        <p className="text-white/40 text-sm mb-6 sm:mb-8 leading-relaxed px-2">
          A companion display for your analog listening experience.
          Visualizations, lyrics, and music videos — all driven by what's playing.
        </p>

        <button
          onClick={onStart}
          className="group relative px-8 py-4 sm:py-3 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 hover:border-white/20 rounded-2xl transition-all duration-300 w-full sm:w-auto"
        >
          <span className="flex items-center justify-center gap-3 text-white/80 group-hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            Start Listening
          </span>
        </button>

        <p className="text-white/20 text-xs mt-4">
          Requires microphone access to hear your music
        </p>
      </div>
    </div>
  );
}

function ActiveApp() {
  useWsCommands('display');
  useAudioAnalysis();
  useBeatDetection();
  useSongId();
  useLyrics();
  useVideoSearch();
  useAutoDisplay();
  usePositionTracker();

  return (
    <>
      <SessionOverlay />
      <AppShell />
    </>
  );
}

/** Session code overlay — shown until a remote connects, reappears if it disconnects */
function SessionOverlay() {
  const sessionId = useStore((s) => s.sessionId);
  const remoteConnected = useStore((s) => s.remoteConnected);

  if (!sessionId || remoteConnected) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-40 px-4 py-2 sm:px-5 sm:py-2.5 bg-black/70 backdrop-blur-md rounded-2xl border border-white/10 flex items-center gap-2 sm:gap-3"
      style={{ top: `max(3.5rem, calc(env(safe-area-inset-top) + 3rem))` }}
    >
      <span className="text-[10px] sm:text-xs text-white/40 uppercase tracking-wide">Session</span>
      <span className="text-xl sm:text-2xl font-mono font-bold text-white/90 tracking-[0.2em]">{sessionId}</span>
    </div>
  );
}

/** Display route — same as standalone but with WebSocket + auto-hide + auto-fullscreen */
function DisplayApp() {
  useWsCommands('display');
  useAudioAnalysis();
  useBeatDetection();
  useSongId();
  useLyrics();
  useVideoSearch();
  useAutoDisplay();
  usePositionTracker();

  const setControlsVisible = useStore((s) => s.setControlsVisible);
  const hideTimer = useRef<number>(0);

  // Auto-hide controls after 3s on display route
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 3000);
  }, [setControlsVisible]);

  useEffect(() => {
    // Auto-fullscreen on display route
    const tryFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    // Need a user gesture first — fullscreen on first click
    const handler = () => {
      tryFullscreen();
      window.removeEventListener('click', handler);
    };
    window.addEventListener('click', handler);

    // Start with controls hidden
    const t = window.setTimeout(() => setControlsVisible(false), 3000);

    return () => {
      window.removeEventListener('click', handler);
      clearTimeout(t);
      clearTimeout(hideTimer.current);
    };
  }, [setControlsVisible, resetHideTimer]);

  return (
    <>
      <SessionOverlay />
      <AppShell />
    </>
  );
}

/** Standalone app — original `/` route (laptop with mic) */
function StandaloneApp() {
  const isListening = useStore((s) => s.isListening);
  const { start } = useAudioCapture();

  if (!isListening) {
    return <StartScreen onStart={start} />;
  }

  return <ActiveApp />;
}

/** Display app — `/display` route (Pi kiosk) */
function DisplayRoute() {
  const isListening = useStore((s) => s.isListening);
  const { start } = useAudioCapture();
  const autostart = new URLSearchParams(window.location.search).has('autostart');

  useEffect(() => {
    if (autostart && !isListening) {
      start();
    }
  }, [autostart, isListening, start]);

  if (!isListening) {
    return <StartScreen onStart={start} />;
  }

  return <DisplayApp />;
}

export default function App() {
  const path = window.location.pathname;

  if (path === '/remote') {
    return <RemoteControl />;
  }

  if (path === '/display') {
    return <DisplayRoute />;
  }

  // Default: standalone laptop mode (unchanged)
  return <StandaloneApp />;
}
