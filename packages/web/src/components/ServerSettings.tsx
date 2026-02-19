import { useState, useEffect, useRef } from 'react';

interface SettingsData {
  youtubeApiKey: string;
  requireCode: boolean;
}

export default function ServerSettings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [apiKeyEdited, setApiKeyEdited] = useState(false);
  const feedbackTimer = useRef<number>(0);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data: SettingsData) => {
        setSettings(data);
        setApiKeyInput(data.youtubeApiKey);
      })
      .catch(() => setFeedback({ type: 'error', msg: 'Failed to load settings' }));
  }, []);

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
