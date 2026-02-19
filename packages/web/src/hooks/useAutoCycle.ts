import { useEffect } from 'react';
import { useStore } from '../store';

export function useAutoCycle() {
  const enabled = useStore((s) => s.autoCycleEnabled);
  const intervalSec = useStore((s) => s.autoCycleIntervalSec);
  const appMode = useStore((s) => s.appMode);
  const nextVisualizer = useStore((s) => s.nextVisualizer);

  useEffect(() => {
    if (!enabled || appMode !== 'visualizer') return;
    const id = window.setInterval(nextVisualizer, intervalSec * 1000);
    return () => clearInterval(id);
  }, [enabled, intervalSec, appMode, nextVisualizer]);
}
