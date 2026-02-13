import { useAudioCapture } from './hooks/useAudioCapture';
import { useAudioAnalysis } from './hooks/useAudioAnalysis';
import { useBeatDetection } from './hooks/useBeatDetection';
import { useClapSwitch } from './hooks/useClapSwitch';
import { useSongId } from './hooks/useSongId';
import { useLyrics } from './hooks/useLyrics';
import { useVideoSearch } from './hooks/useVideoSearch';
import { useAutoDisplay } from './hooks/useAutoDisplay';
import { usePositionTracker } from './hooks/usePositionTracker';
import { useStore } from './store';
import AppShell from './components/AppShell';

function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-black">
      <div className="text-center max-w-md px-6">
        {/* Vinyl record icon */}
        <div className="relative w-32 h-32 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full border-2 border-white/10 animate-spin-slow">
            <div className="absolute inset-[15%] rounded-full border border-white/5" />
            <div className="absolute inset-[30%] rounded-full border border-white/5" />
            <div className="absolute inset-[45%] rounded-full bg-white/10" />
            <div className="absolute inset-[48%] rounded-full bg-black" />
            <div className="absolute inset-[49%] rounded-full bg-white/20" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
          Vinyl Visions
        </h1>
        <p className="text-white/40 text-sm mb-8 leading-relaxed">
          A companion display for your analog listening experience.
          Visualizations, lyrics, and music videos — all driven by what's playing.
        </p>

        <button
          onClick={onStart}
          className="group relative px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl transition-all duration-300"
        >
          <span className="flex items-center gap-3 text-white/80 group-hover:text-white transition-colors">
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
  useAudioAnalysis();
  useBeatDetection();
  useClapSwitch();
  useSongId();
  useLyrics();
  useVideoSearch();
  useAutoDisplay();
  usePositionTracker();

  return <AppShell />;
}

export default function App() {
  const isListening = useStore((s) => s.isListening);
  const { start } = useAudioCapture();

  if (!isListening) {
    return <StartScreen onStart={start} />;
  }

  return <ActiveApp />;
}
