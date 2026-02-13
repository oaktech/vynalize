import { useEffect, useRef, useCallback, useState } from 'react';
import { useStore } from '../store';
import NowPlaying from './NowPlaying';
import ListeningPulse from './ListeningPulse';
import ModeSelector from './ModeSelector';
import SyncControls from './SyncControls';
import Settings from './Settings';
import ManualSearch from './ManualSearch';
import VisualizerView from './visualizer/VisualizerView';
import LyricsView from './lyrics/LyricsView';
import VideoPlayer from './video/VideoPlayer';
import AsciiWords from './visualizer/AsciiWords';

const CONTROLS_HIDE_DELAY = 5000;

export default function AppShell() {
  const appMode = useStore((s) => s.appMode);
  const setAppMode = useStore((s) => s.setAppMode);
  const isFullscreen = useStore((s) => s.isFullscreen);
  const setFullscreen = useStore((s) => s.setFullscreen);
  const controlsVisible = useStore((s) => s.controlsVisible);
  const setControlsVisible = useStore((s) => s.setControlsVisible);
  const accentColor = useStore((s) => s.accentColor);
  const isListening = useStore((s) => s.isListening);
  const bpm = useStore((s) => s.bpm);
  const clapFlash = useStore((s) => s.clapFlash);
  const hideTimer = useRef<number>(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, CONTROLS_HIDE_DELAY);
  }, [setControlsVisible]);

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
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('keydown', handleKey);
    showControls();

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('keydown', handleKey);
      clearTimeout(hideTimer.current);
    };
  }, [showControls, isFullscreen, settingsOpen, setAppMode]);

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [setFullscreen]);

  function toggleFullscreen() {
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
      className="relative w-screen h-screen overflow-hidden bg-black"
      onMouseMove={showControls}
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
        <div className="pointer-events-auto absolute top-0 left-0 right-0 px-5 py-4 md:px-6 md:py-5 flex items-center justify-between bg-gradient-to-b from-black/70 via-black/40 to-transparent pb-10">
          <div className="flex items-center gap-3">
            <ListeningPulse />
            <NowPlaying />
          </div>
          <div className="flex items-center gap-2">
            <ManualSearch />
            {bpm && (
              <span className="text-xs text-white/30 tabular-nums font-mono mr-2">
                {bpm} BPM
              </span>
            )}
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              title="Settings"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
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
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pointer-events-auto absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <ModeSelector />
            {isListening && (appMode === 'lyrics' || appMode === 'video') && (
              <SyncControls />
            )}
          </div>
        </div>
      </div>

      {/* Clap detection flash */}
      {clapFlash && (
        <div className="absolute inset-0 bg-white/10 pointer-events-none animate-pulse" />
      )}

      {/* Settings modal */}
      <Settings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
