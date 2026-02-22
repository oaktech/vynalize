import { useEffect } from 'react';
import { useStore } from '../store';

export function useAuth() {
  const setAuthUser = useStore((s) => s.setAuthUser);
  const setAuthLoading = useStore((s) => s.setAuthLoading);
  const setAuthRequired = useStore((s) => s.setAuthRequired);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        // First check if auth is required
        const configRes = await fetch('/api/config', { credentials: 'include' });
        const config = await configRes.json();

        if (cancelled) return;
        setAuthRequired(config.requireAuth === true);

        if (!config.requireAuth) {
          setAuthLoading(false);
          return;
        }

        // Auth is required — check if logged in
        const meRes = await fetch('/api/auth/me', { credentials: 'include' });
        const me = await meRes.json();

        if (cancelled) return;
        if (me.authenticated) {
          setAuthUser(me.user);
        } else {
          setAuthUser(null);
        }
      } catch (err) {
        console.warn('[auth] Failed to check auth status:', err);
        if (!cancelled) {
          setAuthRequired(false);
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    }

    check();
    return () => { cancelled = true; };
  }, [setAuthUser, setAuthLoading, setAuthRequired]);
}
