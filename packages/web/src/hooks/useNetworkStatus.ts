import { useEffect } from 'react';
import { useStore } from '../store';

/** Listens for online/offline events and syncs to store. */
export function useNetworkStatus() {
  const setOnline = useStore((s) => s.setOnline);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [setOnline]);
}
