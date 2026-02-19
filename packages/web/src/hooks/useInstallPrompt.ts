import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

export function useInstallPrompt() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const installDismissed = useStore((s) => s.installDismissed);
  const setInstallDismissed = useStore((s) => s.setInstallDismissed);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const canShow = !isStandalone && !installDismissed && deferredPrompt.current !== null;

  const promptInstall = useCallback(async () => {
    const prompt = deferredPrompt.current;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted' || outcome === 'dismissed') {
      deferredPrompt.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    setInstallDismissed(true);
    deferredPrompt.current = null;
  }, [setInstallDismissed]);

  return { canShow, promptInstall, dismiss };
}
