import { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react';
import { useAudioCapture } from './hooks/useAudioCapture';
import { useAudioAnalysis } from './hooks/useAudioAnalysis';
import { useBeatDetection } from './hooks/useBeatDetection';
import { useSongId } from './hooks/useSongId';
import { useLyrics } from './hooks/useLyrics';
import { useVideoSearch } from './hooks/useVideoSearch';
import { useAutoDisplay } from './hooks/useAutoDisplay';
import { usePositionTracker } from './hooks/usePositionTracker';
import { useWsCommands } from './hooks/useWsCommands';
import { useAutoCycle } from './hooks/useAutoCycle';
import { useStore } from './store';
import AppShell from './components/AppShell';
import RemoteControl from './components/RemoteControl';
import ServerSettings from './components/ServerSettings';
import QRPairing from './components/QRPairing';

const Leaderboard = lazy(() => import('./components/Leaderboard'));
const Privacy = lazy(() => import('./components/Privacy'));

function StartScreen({ onStart }: { onStart: () => void }) {
  const micError = useStore((s) => s.micError);

  return (
    <div className="w-screen h-dvh flex items-center justify-center bg-black px-6">
      <div className="text-center max-w-md w-full">
        <img
          src="/vynalize-logo.png"
          alt="Vynalize"
          className="w-full max-w-72 sm:max-w-96 mx-auto mb-6 sm:mb-8"
        />
        <p className="text-white/40 text-sm mb-6 leading-relaxed px-2">
          Play music near your device. Vynalize creates synchronized visualizations,
          lyrics, and music videos — all driven by what's playing in the room.
        </p>

        <div className="flex justify-center gap-6 mb-8 text-white/25 text-[11px]">
          <div className="flex flex-col items-center gap-1.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 19V6l12-3v13" /><circle cx="6" cy="19" r="3" /><circle cx="18" cy="16" r="3" /></svg>
            <span>12 Visualizers</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16M4 10h16M4 14h10M4 18h7" /></svg>
            <span>Synced Lyrics</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M10 9.87v4.26a1 1 0 001.55.83l3.2-2.13a1 1 0 000-1.66l-3.2-2.13A1 1 0 0010 9.87z" /></svg>
            <span>Music Videos</span>
          </div>
        </div>

        {micError && (
          <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400/90 text-sm leading-relaxed">{micError}</p>
          </div>
        )}

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
            {micError ? 'Try Again' : 'Start Listening'}
          </span>
        </button>

        <p className="text-white/20 text-xs mt-4 leading-relaxed">
          Microphone listens for music to identify songs.
          <br />Short audio samples are sent for identification and immediately discarded.
          <br /><a href="/privacy" className="underline hover:text-white/40 transition-colors">Privacy Policy</a>
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
  useAutoCycle();

  return (
    <>
      <SessionOverlay />
      <AppShell />
    </>
  );
}

/** Remote code overlay — shown until a remote connects or the user dismisses it */
function SessionOverlay() {
  const sessionId = useStore((s) => s.sessionId);
  const remoteConnected = useStore((s) => s.remoteConnected);
  const [dismissed, setDismissed] = useState(false);
  const hadConnection = useRef(false);
  const [reconnectGrace, setReconnectGrace] = useState(false);

  useEffect(() => {
    if (remoteConnected) {
      hadConnection.current = true;
      setReconnectGrace(false);
      return;
    }
    // If we previously had a connection, give a grace period before re-showing
    // the overlay — the phone may just be asleep and will reconnect shortly.
    if (hadConnection.current) {
      setReconnectGrace(true);
      const timer = setTimeout(() => {
        setReconnectGrace(false);
        setDismissed(false);
      }, 10_000);
      return () => clearTimeout(timer);
    }
    setDismissed(false);
  }, [remoteConnected]);

  if (!sessionId || remoteConnected || dismissed || reconnectGrace) return null;

  return (
    <div
      className="fixed top-16 right-4 sm:right-8 z-50 px-4 py-3 sm:px-5 sm:py-4 bg-black/70 backdrop-blur-md rounded-2xl border border-white/10 flex flex-col items-center gap-3"
      style={{ top: `max(4rem, calc(env(safe-area-inset-top) + 3rem))` }}
    >
      <button
        onClick={() => setDismissed(true)}
        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white/80 flex items-center justify-center text-xs transition-colors"
        aria-label="Dismiss"
      >
        ✕
      </button>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-[10px] sm:text-xs text-white/40 uppercase tracking-wide">Remote Code</span>
        <span className="text-xl sm:text-2xl font-mono font-bold text-white/90 tracking-[0.2em]">{sessionId}</span>
      </div>
      <QRPairing sessionId={sessionId} />
    </div>
  );
}

/** Kiosk route — same as standalone but with auto-hide + auto-fullscreen */
function KioskApp() {
  useWsCommands('display');
  useAudioAnalysis();
  useBeatDetection();
  useSongId();
  useLyrics();
  useVideoSearch();
  useAutoDisplay();
  usePositionTracker();
  useAutoCycle();

  const setControlsVisible = useStore((s) => s.setControlsVisible);
  const hideTimer = useRef<number>(0);

  // Auto-hide controls after 3s on kiosk route
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 3000);
  }, [setControlsVisible]);

  useEffect(() => {
    // Auto-fullscreen immediately on kiosk route (skip on iPhone which doesn't support it)
    const supportsFullscreen = !!document.documentElement.requestFullscreen && !/iPhone|iPod/.test(navigator.userAgent);
    if (supportsFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    // Start with controls hidden
    const t = window.setTimeout(() => setControlsVisible(false), 3000);

    return () => {
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

/** Kiosk app — `/kiosk` route (Pi kiosk / LAN display) */
function KioskRoute() {
  const isListening = useStore((s) => s.isListening);
  const setLowPowerMode = useStore((s) => s.setLowPowerMode);
  const { start } = useAudioCapture();
  const autostart = new URLSearchParams(window.location.search).has('autostart');

  // Enable low-power mode: disables canvas shadows, caps DPR,
  // reduces particle counts — keeps frame rates smooth on Pi.
  useEffect(() => {
    setLowPowerMode(true);
  }, [setLowPowerMode]);

  // On the Pi appliance (?autostart), silently attempt mic capture.
  // On LAN devices without ?autostart (or without a mic), skip straight
  // to the visualizer — the appliance is already listening.
  useEffect(() => {
    if (autostart && !isListening) {
      start();
    }
  }, [autostart, isListening, start]);

  return <KioskApp />;
}

export default function App() {
  const path = window.location.pathname;

  if (path === '/settings') {
    return <ServerSettings />;
  }

  if (path === '/remote') {
    return <RemoteControl />;
  }

  if (path === '/kiosk') {
    return <KioskRoute />;
  }

  if (path === '/leaderboard') {
    return (
      <Suspense fallback={<div className="w-screen h-screen bg-black" />}>
        <Leaderboard />
      </Suspense>
    );
  }

  if (path === '/privacy') {
    return (
      <Suspense fallback={<div className="w-screen h-screen bg-black" />}>
        <Privacy />
      </Suspense>
    );
  }

  // Default: standalone laptop mode
  return <StandaloneApp />;
}
