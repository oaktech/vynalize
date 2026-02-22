import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store';

export default function UserSettings({ onClose }: { onClose: () => void }) {
  const authUser = useStore((s) => s.authUser);
  const setAuthUser = useStore((s) => s.setAuthUser);
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchKeyStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/user/youtube-key', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setHasKey(data.hasKey);
      setQuota(data.quota);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => { fetchKeyStatus(); }, [fetchKeyStatus]);

  async function handleSaveKey() {
    if (!apiKey.trim()) return;
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/user/youtube-key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save key');
        return;
      }

      setSuccess('API key saved');
      setApiKey('');
      setHasKey(true);
      setQuota(null);
      setAuthUser(authUser ? { ...authUser, hasYoutubeApiKey: true } : null);
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteKey() {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/user/youtube-key', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        setError('Failed to remove key');
        return;
      }

      setSuccess('API key removed');
      setHasKey(false);
      setAuthUser(authUser ? { ...authUser, hasYoutubeApiKey: false } : null);
      await fetchKeyStatus();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // ignore
    }
    setAuthUser(null);
    window.location.href = '/';
  }

  if (!authUser) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {authUser.avatarUrl && (
              <img
                src={authUser.avatarUrl}
                alt=""
                className="w-10 h-10 rounded-full"
                referrerPolicy="no-referrer"
              />
            )}
            <div>
              <div className="text-white/90 font-medium text-sm">{authUser.displayName}</div>
              <div className="text-white/40 text-xs">{authUser.email}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors text-lg">&times;</button>
        </div>

        {/* Quota display */}
        {quota && !hasKey && (
          <div className="mb-5 px-4 py-3 bg-white/5 rounded-xl">
            <div className="text-white/60 text-xs mb-1">Daily search quota</div>
            <div className="flex items-baseline gap-1">
              <span className="text-white/90 text-lg font-mono">{quota.used}</span>
              <span className="text-white/40 text-sm">/ {quota.limit}</span>
            </div>
            <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* YouTube API Key */}
        <div className="mb-5">
          <label className="block text-white/60 text-xs mb-2">
            YouTube API Key {hasKey && <span className="text-green-400/80">(active)</span>}
          </label>

          {hasKey ? (
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-sm flex-1">Key is saved and encrypted</span>
              <button
                onClick={handleDeleteKey}
                disabled={saving}
                className="px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <p className="text-white/30 text-xs mb-2 leading-relaxed">
                Add your own YouTube Data API key for unlimited video searches.
                Your key is encrypted and never shared.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIza..."
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white/90 text-sm placeholder:text-white/20 focus:outline-none focus:border-white/20"
                />
                <button
                  onClick={handleSaveKey}
                  disabled={saving || !apiKey.trim()}
                  className="px-4 py-2 text-sm bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? '...' : 'Save'}
                </button>
              </div>
            </>
          )}

          {error && <p className="mt-2 text-red-400 text-xs">{error}</p>}
          {success && <p className="mt-2 text-green-400 text-xs">{success}</p>}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full px-4 py-2.5 text-sm text-white/50 hover:text-white/70 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
