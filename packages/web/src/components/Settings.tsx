import { useState, useEffect } from 'react';
import { useStore } from '../store';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Settings({ isOpen, onClose }: SettingsProps) {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [version, setVersion] = useState('0.1.0');
  const selectedDevice = useStore((s) => s.audioInputDeviceId);
  const setSelectedDevice = useStore((s) => s.setAudioInputDeviceId);
  const autoCycleEnabled = useStore((s) => s.autoCycleEnabled);
  const setAutoCycleEnabled = useStore((s) => s.setAutoCycleEnabled);
  const autoCycleIntervalSec = useStore((s) => s.autoCycleIntervalSec);
  const setAutoCycleIntervalSec = useStore((s) => s.setAutoCycleIntervalSec);

  useEffect(() => {
    if (!isOpen) return;
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
    });
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => { if (data.version) setVersion(data.version); })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Settings" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-white/10 border-b-0 sm:border-b rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md sm:mx-4 p-5 sm:p-6 shadow-2xl max-h-[80vh] sm:max-h-[90vh] overflow-y-auto"
        style={{ paddingBottom: `max(1.25rem, env(safe-area-inset-bottom))` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle for mobile */}
        <div className="flex justify-center mb-3 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-3 sm:p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors"
            aria-label="Close settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Audio Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-white/60 mb-2">
            Microphone Input
          </label>
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="w-full bg-black border border-white/10 rounded-lg px-3 py-3 sm:py-2 text-sm text-white focus:outline-none focus:border-white/30"
          >
            <option value="">Default</option>
            {audioDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>

        {/* Auto-Cycle */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-white/60 mb-2">
            Auto-Cycle Visualizers
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoCycleEnabled(!autoCycleEnabled)}
              className={`relative w-10 h-6 rounded-full transition-colors ${autoCycleEnabled ? 'bg-violet-500' : 'bg-white/10'}`}
              role="switch"
              aria-checked={autoCycleEnabled}
              aria-label="Toggle auto-cycle"
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${autoCycleEnabled ? 'translate-x-4' : ''}`} />
            </button>
            {autoCycleEnabled && (
              <select
                value={autoCycleIntervalSec}
                onChange={(e) => setAutoCycleIntervalSec(Number(e.target.value))}
                className="bg-black border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                aria-label="Cycle interval"
              >
                <option value={15}>Every 15s</option>
                <option value={30}>Every 30s</option>
                <option value={60}>Every 60s</option>
              </select>
            )}
          </div>
          {autoCycleEnabled && (
            <p className="text-[11px] text-white/30 mt-1.5">
              Cycles through favorited visualizers (or all if none favorited)
            </p>
          )}
        </div>

        {/* Keyboard Shortcuts / Touch Hints */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-white/60 mb-3">
            {'ontouchstart' in window ? 'Touch Controls' : 'Keyboard Shortcuts'}
          </h3>
          {'ontouchstart' in window ? (
            <div className="space-y-2 text-xs">
              {[
                ['Tap screen', 'Show/hide controls'],
                ['Swipe mode bar', 'Switch visualizer modes'],
                ['Sync buttons', 'Adjust lyrics/video timing'],
              ].map(([action, desc]) => (
                <div key={action} className="flex items-center justify-between">
                  <span className="text-white/40">{desc}</span>
                  <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-white/60 text-[11px]">
                    {action}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {[
                ['F', 'Toggle fullscreen'],
                ['Esc', 'Exit fullscreen'],
                ['1', 'Visualizer mode'],
                ['2', 'Lyrics mode'],
                ['3', 'Video mode'],
                ['4', 'ASCII mode'],
                ['← / →', 'Adjust sync offset ±0.2s'],
                ['↑ / ↓', 'Adjust sync offset ±1s'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-white/40">{desc}</span>
                  <kbd className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-white/60 font-mono">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Links */}
        <div className="mb-6 space-y-2">
          <a
            href="/settings"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white/60 hover:text-white transition-colors"
          >
            <span>Server Settings</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white/60 hover:text-white transition-colors"
          >
            <span>Privacy Policy</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>

        {/* About */}
        <div className="pt-4 border-t border-white/5">
          <p className="text-xs text-white/20 text-center">
            Vynalize v{version} — A companion display for analog listening
          </p>
        </div>
      </div>
    </div>
  );
}
