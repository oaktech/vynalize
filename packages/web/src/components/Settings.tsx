import { useState, useEffect } from 'react';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Settings({ isOpen, onClose }: SettingsProps) {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
    });
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
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
            className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
          >
            <option value="">Default</option>
            {audioDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-white/60 mb-3">Keyboard Shortcuts</h3>
          <div className="space-y-2 text-xs">
            {[
              ['F', 'Toggle fullscreen'],
              ['Esc', 'Exit fullscreen'],
              ['1', 'Visualizer mode'],
              ['2', 'Lyrics mode'],
              ['3', 'Video mode'],
              ['4', 'ASCII mode'],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-white/40">{desc}</span>
                <kbd className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-white/60 font-mono">
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* About */}
        <div className="pt-4 border-t border-white/5">
          <p className="text-xs text-white/20 text-center">
            Vinyl Visions v0.1.0 — A companion display for analog listening
          </p>
        </div>
      </div>
    </div>
  );
}
