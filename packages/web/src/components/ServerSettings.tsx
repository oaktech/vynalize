import { useState, useEffect, useRef, useCallback } from 'react';

interface SettingsData {
  youtubeApiKey: string;
  requireCode: boolean;
}

interface UpdateState {
  currentVersion: string;
  updateAvailable: string | null;
  status: 'idle' | 'checking' | 'downloading' | 'installing' | 'error';
  lastCheck: string | null;
  lastUpdate: string | null;
  channel: 'stable' | 'beta';
  error: string | null;
}

export default function ServerSettings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [apiKeyEdited, setApiKeyEdited] = useState(false);
  const feedbackTimer = useRef<number>(0);
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [showChannelPicker, setShowChannelPicker] = useState(false);
  const pollRef = useRef<number>(0);

  const fetchUpdateState = useCallback(() => {
    fetch('/api/update')
      .then((r) => r.json())
      .then((data: UpdateState) => setUpdateState(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data: SettingsData) => {
        setSettings(data);
        setApiKeyInput(data.youtubeApiKey);
      })
      .catch(() => setFeedback({ type: 'error', msg: 'Failed to load settings' }));

    fetchUpdateState();
  }, [fetchUpdateState]);

  // Poll while an update is in progress
  useEffect(() => {
    clearInterval(pollRef.current);
    if (updateState && ['checking', 'downloading', 'installing'].includes(updateState.status)) {
      pollRef.current = window.setInterval(fetchUpdateState, 3000);
    }
    return () => clearInterval(pollRef.current);
  }, [updateState?.status, fetchUpdateState]);

  function showFeedback(type: 'success' | 'error', msg: string) {
    setFeedback({ type, msg });
    clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 3000);
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setFeedback(null);

    const update: Partial<SettingsData> = {
      requireCode: settings.requireCode,
    };

    // Only send the API key if the user actually edited it (avoid saving the masked value)
    if (apiKeyEdited) {
      update.youtubeApiKey = apiKeyInput;
    }

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Save failed' }));
        showFeedback('error', err.error || 'Save failed');
        return;
      }
      const saved: SettingsData = await res.json();
      setSettings(saved);
      setApiKeyInput(saved.youtubeApiKey);
      setApiKeyEdited(false);
      showFeedback('success', 'Settings saved');
    } catch {
      showFeedback('error', 'Network error');
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black">
        <p className="text-white/40 text-sm">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="w-screen min-h-screen bg-black flex items-start justify-center px-4 py-12">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-lg font-semibold text-white">Server Settings</h1>
          <a
            href="/"
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Back to app
          </a>
        </div>

        {/* YouTube API Key */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-white/60 mb-2">
            YouTube API Key
          </label>
          <input
            type="text"
            value={apiKeyInput}
            onFocus={() => {
              if (!apiKeyEdited) {
                setApiKeyInput('');
                setApiKeyEdited(true);
              }
            }}
            onChange={(e) => {
              setApiKeyInput(e.target.value);
              setApiKeyEdited(true);
            }}
            placeholder="Paste your YouTube Data API v3 key"
            className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30"
          />
          <p className="mt-1.5 text-xs text-white/20">
            Required for music video search. Get one from the Google Cloud Console.
          </p>
        </div>

        {/* Require Session Code */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/60">Require Session Code</p>
              <p className="text-xs text-white/20 mt-0.5">
                When off, remotes connect without entering a code
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.requireCode}
              onClick={() => setSettings({ ...settings, requireCode: !settings.requireCode })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                settings.requireCode ? 'bg-violet-500' : 'bg-white/10'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                  settings.requireCode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Software Update */}
        {updateState && (
          <div className="mb-8 pt-6 border-t border-white/5">
            <h2 className="text-sm font-medium text-white/60 mb-4">Software Update</h2>

            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-white">
                  Current version: <span className="font-mono text-white/80">v{updateState.currentVersion}</span>
                </p>
                {updateState.lastCheck && (
                  <p className="text-xs text-white/20 mt-0.5">
                    Last checked: {new Date(updateState.lastCheck).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* Status display */}
            {updateState.status === 'checking' && (
              <p className="text-sm text-white/40 mb-3">Checking for updates...</p>
            )}
            {updateState.status === 'downloading' && (
              <p className="text-sm text-amber-400 mb-3">Downloading update...</p>
            )}
            {updateState.status === 'installing' && (
              <p className="text-sm text-amber-400 mb-3">Installing update... The page will reload shortly.</p>
            )}
            {updateState.status === 'error' && updateState.error && (
              <p className="text-sm text-red-400 mb-3">{updateState.error}</p>
            )}
            {updateState.updateAvailable && updateState.status === 'idle' && (
              <p className="text-sm text-emerald-400 mb-3">
                Update available: <span className="font-mono">v{updateState.updateAvailable}</span>
              </p>
            )}
            {!updateState.updateAvailable && updateState.status === 'idle' && updateState.lastCheck && (
              <p className="text-sm text-white/30 mb-3">Up to date</p>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => {
                  fetch('/api/update/check', { method: 'POST' }).then(fetchUpdateState);
                }}
                disabled={updateState.status !== 'idle'}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-xs text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Check for Updates
              </button>
              {updateState.updateAvailable && updateState.status === 'idle' && (
                <button
                  onClick={() => {
                    fetch('/api/update/apply', { method: 'POST' }).then(fetchUpdateState);
                  }}
                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 border border-violet-500/30 rounded-lg text-xs text-white transition-colors"
                >
                  Install v{updateState.updateAvailable}
                </button>
              )}
            </div>

            {/* Channel selector (behind disclosure) */}
            <button
              onClick={() => setShowChannelPicker(!showChannelPicker)}
              className="text-xs text-white/20 hover:text-white/40 transition-colors"
            >
              {showChannelPicker ? '▾' : '▸'} Update channel: {updateState.channel}
            </button>
            {showChannelPicker && (
              <div className="mt-2 flex items-center gap-2">
                {(['stable', 'beta'] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => {
                      fetch('/api/update/channel', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ channel: ch }),
                      }).then(fetchUpdateState);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                      updateState.channel === ch
                        ? 'bg-white/15 text-white border border-white/20'
                        : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          {feedback && (
            <span
              className={`text-sm ${feedback.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {feedback.msg}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
