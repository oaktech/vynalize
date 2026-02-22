import { useEffect, useRef, useCallback, useState } from 'react';
import { useStore } from '../store';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { useSwipe } from '../hooks/useSwipe';
import NowPlaying from './NowPlaying';
import ListeningPulse from './ListeningPulse';
import ModeSelector, { APP_MODES } from './ModeSelector';
import SyncControls from './SyncControls';
import Settings from './Settings';
import UserSettings from './UserSettings';
import ManualSearch from './ManualSearch';
import SongHistory from './SongHistory';
import VisualizerView from './visualizer/VisualizerView';
import LyricsView from './lyrics/LyricsView';
import VideoPlayer from './video/VideoPlayer';
import AsciiWords from './visualizer/AsciiWords';
import ShareButton from './ShareButton';

const CONTROLS_HIDE_DELAY = 5000;

// iPhone/iPod Safari does not support the Fullscreen API (iPad does)
const isIPhone = /iPhone|iPod/.test(navigator.userAgent);
const supportsFullscreen = !!document.documentElement.requestFullscreen && !isIPhone;

export default function AppShell() {
  useNetworkStatus();
  const { canShow: canInstall, promptInstall, dismiss: dismissInstall } = useInstallPrompt();
  const appMode = useStore((s) => s.appMode);
  const setAppMode = useStore((s) => s.setAppMode);
  const isFullscreen = useStore((s) => s.isFullscreen);
  const setFullscreen = useStore((s) => s.setFullscreen);
  const controlsVisible = useStore((s) => s.controlsVisible);
  const setControlsVisible = useStore((s) => s.setControlsVisible);
  const accentColor = useStore((s) => s.accentColor);
  const isListening = useStore((s) => s.isListening);
  const bpm = useStore((s) => s.bpm);
  const isOnline = useStore((s) => s.isOnline);
  const hideTimer = useRef<number>(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userSettingsOpen, setUserSettingsOpen] = useState(false);
  const authUser = useStore((s) => s.authUser);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, CONTROLS_HIDE_DELAY);
  }, [setControlsVisible]);

  const nextVisualizer = useStore((s) => s.nextVisualizer);
  const prevVisualizer = useStore((s) => s.prevVisualizer);

  const swipe = useSwipe({
    onSwipeLeft: useCallback(() => {
      if (useStore.getState().appMode === 'visualizer') {
        nextVisualizer();
      } else {
        const i = APP_MODES.indexOf(useStore.getState().appMode);
        setAppMode(APP_MODES[(i + 1) % APP_MODES.length]);
      }
    }, [setAppMode, nextVisualizer]),
    onSwipeRight: useCallback(() => {
      if (useStore.getState().appMode === 'visualizer') {
        prevVisualizer();
      } else {
        const i = APP_MODES.indexOf(useStore.getState().appMode);
        setAppMode(APP_MODES[(i - 1 + APP_MODES.length) % APP_MODES.length]);
      }
    }, [setAppMode, prevVisualizer]),
  });

  const adjustOffset = useStore((s) => s.adjustOffset);
  const adjustVideoOffset = useStore((s) => s.adjustVideoOffset);

  useEffect(() => {
    const handleMove = () => showControls();
    const handleKey = (e: KeyboardEvent) => {
      if (settingsOpen) return;
      showControls();
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      if (e.key === 'Escape' && isFullscreen) exitFullscreen();
      if (e.key === '1') setAppMode('visualizer');
      if (e.key === '2') setAppMode('lyrics');
      if (e.key === '3') setAppMode('video');
      if (e.key === '4') setAppMode('ascii');

      // Arrow keys: adjust sync offset in lyrics/video modes
      const currentMode = useStore.getState().appMode;
      if (currentMode === 'video' || currentMode === 'lyrics') {
        const adjust = currentMode === 'video' ? adjustVideoOffset : adjustOffset;
        if (e.key === 'ArrowRight') { e.preventDefault(); adjust(200); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); adjust(-200); }
        if (e.key === 'ArrowUp') { e.preventDefault(); adjust(1000); }
        if (e.key === 'ArrowDown') { e.preventDefault(); adjust(-1000); }
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchstart', handleMove);
    window.addEventListener('keydown', handleKey);
    showControls();

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchstart', handleMove);
      window.removeEventListener('keydown', handleKey);
      clearTimeout(hideTimer.current);
    };
  }, [showControls, isFullscreen, settingsOpen, setAppMode, adjustOffset, adjustVideoOffset]);

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [setFullscreen]);

  function toggleFullscreen() {
    if (!supportsFullscreen) return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  function exitFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  }

  return (
    <div
      className="relative w-screen h-dvh overflow-hidden bg-black"
      onMouseMove={showControls}
      onTouchStart={(e) => { showControls(); swipe.onTouchStart(e); }}
      onTouchEnd={swipe.onTouchEnd}
      onClick={showControls}
    >
      {/* Main content area with crossfade */}
      <div className="absolute inset-0">
        <div className={`absolute inset-0 transition-opacity duration-500 ${appMode === 'visualizer' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <VisualizerView />
        </div>
        <div className={`absolute inset-0 transition-opacity duration-500 ${appMode === 'lyrics' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {appMode === 'lyrics' && <LyricsView />}
        </div>
        <div className={`absolute inset-0 transition-opacity duration-500 ${appMode === 'video' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {appMode === 'video' && <VideoPlayer />}
        </div>
        <div className={`absolute inset-0 transition-opacity duration-500 ${appMode === 'ascii' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {appMode === 'ascii' && <AsciiWords accentColor={accentColor} />}
        </div>
      </div>

      {/* Controls overlay */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${
          controlsVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Top bar */}
        <div
          className="pointer-events-auto absolute top-0 left-0 right-0 px-3 py-3 sm:px-5 sm:py-4 md:px-6 md:py-5 bg-gradient-to-b from-black/80 via-black/50 to-transparent"
          style={{ paddingTop: `max(0.75rem, env(safe-area-inset-top))`, paddingLeft: `max(0.75rem, env(safe-area-inset-left))`, paddingRight: `max(0.75rem, env(safe-area-inset-right))` }}
        >
          <div className="flex items-center justify-between gap-2">
            {/* Left: listening pulse + song info */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <ListeningPulse />
              <NowPlaying />
            </div>

            {/* Right: action buttons */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 relative">
              <SongHistory />
              <ManualSearch />
              <ShareButton />
              {bpm && (
                <span className="text-xs text-white/30 tabular-nums font-mono mr-1 hidden sm:inline">
                  {bpm} BPM
                </span>
              )}
              {authUser && (
                <button
                  onClick={() => setUserSettingsOpen(true)}
                  className="p-1 rounded-full hover:ring-2 ring-white/20 transition-all"
                  aria-label="Account"
                  title="Account"
                >
                  {authUser.avatarUrl ? (
                    <img src={authUser.avatarUrl} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-violet-500/30 flex items-center justify-center text-white/70 text-xs font-medium">
                      {authUser.displayName.charAt(0)}
                    </div>
                  )}
                </button>
              )}
              <button
                onClick={() => setSettingsOpen(true)}
                className="p-3 sm:p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors"
                aria-label="Settings"
                title="Settings"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              </button>
              {supportsFullscreen && (
                <button
                  onClick={toggleFullscreen}
                  className="p-3 sm:p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors hidden sm:flex"
                  title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
                >
                  {isFullscreen ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="pointer-events-auto absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/70 via-black/40 to-transparent pt-8"
          style={{ paddingBottom: `max(0.75rem, env(safe-area-inset-bottom))`, paddingLeft: `max(0.75rem, env(safe-area-inset-left))`, paddingRight: `max(0.75rem, env(safe-area-inset-right))` }}
        >
          <div className="flex flex-col gap-3">
            {isListening && (appMode === 'lyrics' || appMode === 'video') && (
              <SyncControls />
            )}
            <ModeSelector />
          </div>
        </div>
      </div>

      {/* Install prompt */}
      {canInstall && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-white/10 backdrop-blur-md border border-white/15 rounded-xl flex items-center gap-3">
          <span className="text-xs text-white/70">Add Vynalize to home screen</span>
          <button onClick={promptInstall} className="px-3 py-1 text-xs font-medium text-white bg-white/15 hover:bg-white/25 rounded-lg transition-colors">Install</button>
          <button onClick={dismissInstall} className="p-1 text-white/30 hover:text-white/60" aria-label="Dismiss"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
        </div>
      )}

      {/* Offline banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600/90 text-white text-xs text-center py-1.5 px-4">
          You're offline — some features are unavailable
        </div>
      )}

      {/* Settings modal */}
      <Settings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* User settings modal */}
      {userSettingsOpen && (
        <UserSettings onClose={() => setUserSettingsOpen(false)} />
      )}
    </div>
  );
}
