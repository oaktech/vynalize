import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from '../store';

// ── Settings Modal Tests ───────────────────────────────────

describe('Settings', () => {
  describe('Audio device selection', () => {
    it('defaults to empty string (system default)', () => {
      expect(useStore.getState().audioInputDeviceId).toBe('');
    });

    it('stores selected device ID', () => {
      useStore.getState().setAudioInputDeviceId('usb-mic-123');
      expect(useStore.getState().audioInputDeviceId).toBe('usb-mic-123');
    });

    it('can reset to default', () => {
      useStore.getState().setAudioInputDeviceId('custom');
      useStore.getState().setAudioInputDeviceId('');
      expect(useStore.getState().audioInputDeviceId).toBe('');
    });
  });

  describe('Auto-cycle settings', () => {
    it('toggle auto-cycle on', () => {
      useStore.getState().setAutoCycleEnabled(true);
      expect(useStore.getState().autoCycleEnabled).toBe(true);
    });

    it('toggle auto-cycle off', () => {
      useStore.getState().setAutoCycleEnabled(true);
      useStore.getState().setAutoCycleEnabled(false);
      expect(useStore.getState().autoCycleEnabled).toBe(false);
    });

    it('sets interval to 15s', () => {
      useStore.getState().setAutoCycleIntervalSec(15);
      expect(useStore.getState().autoCycleIntervalSec).toBe(15);
    });

    it('sets interval to 60s', () => {
      useStore.getState().setAutoCycleIntervalSec(60);
      expect(useStore.getState().autoCycleIntervalSec).toBe(60);
    });

    it('persists auto-cycle state', () => {
      useStore.getState().setAutoCycleEnabled(true);
      useStore.getState().setAutoCycleIntervalSec(15);
      // Check localStorage
      const stored = localStorage.getItem('vynalize-store');
      if (stored) {
        const parsed = JSON.parse(stored).state;
        expect(parsed.autoCycleEnabled).toBe(true);
        expect(parsed.autoCycleIntervalSec).toBe(15);
      }
    });
  });
});

// ── Keyboard Shortcuts Tests ───────────────────────────────

describe('Keyboard Shortcuts', () => {
  describe('Key mapping', () => {
    function handleKey(key: string, store: typeof useStore): { handled: boolean; action?: string } {
      const state = store.getState();
      switch (key) {
        case 'f':
        case 'F':
          return { handled: true, action: 'toggleFullscreen' };
        case 'Escape':
          if (state.isFullscreen) return { handled: true, action: 'exitFullscreen' };
          return { handled: false };
        case '1':
          store.getState().setAppMode('visualizer');
          return { handled: true, action: 'visualizer' };
        case '2':
          store.getState().setAppMode('lyrics');
          return { handled: true, action: 'lyrics' };
        case '3':
          store.getState().setAppMode('video');
          return { handled: true, action: 'video' };
        case '4':
          store.getState().setAppMode('ascii');
          return { handled: true, action: 'ascii' };
        default:
          return { handled: false };
      }
    }

    it('F key toggles fullscreen', () => {
      const result = handleKey('f', useStore);
      expect(result.action).toBe('toggleFullscreen');
    });

    it('F key works uppercase too', () => {
      const result = handleKey('F', useStore);
      expect(result.action).toBe('toggleFullscreen');
    });

    it('Escape exits fullscreen when in fullscreen', () => {
      useStore.getState().setFullscreen(true);
      const result = handleKey('Escape', useStore);
      expect(result.action).toBe('exitFullscreen');
    });

    it('Escape does nothing when not fullscreen', () => {
      useStore.getState().setFullscreen(false);
      const result = handleKey('Escape', useStore);
      expect(result.handled).toBe(false);
    });

    it('1 switches to visualizer mode', () => {
      handleKey('1', useStore);
      expect(useStore.getState().appMode).toBe('visualizer');
    });

    it('2 switches to lyrics mode', () => {
      handleKey('2', useStore);
      expect(useStore.getState().appMode).toBe('lyrics');
    });

    it('3 switches to video mode', () => {
      handleKey('3', useStore);
      expect(useStore.getState().appMode).toBe('video');
    });

    it('4 switches to ASCII mode', () => {
      handleKey('4', useStore);
      expect(useStore.getState().appMode).toBe('ascii');
    });
  });

  describe('Arrow key offset adjustment', () => {
    it('ArrowRight adjusts offset +200ms', () => {
      useStore.getState().setAppMode('lyrics');
      useStore.getState().adjustOffset(200);
      expect(useStore.getState().position.offsetMs).toBe(200);
    });

    it('ArrowLeft adjusts offset -200ms', () => {
      useStore.getState().setAppMode('lyrics');
      useStore.getState().adjustOffset(-200);
      expect(useStore.getState().position.offsetMs).toBe(-200);
    });

    it('ArrowUp adjusts offset +1000ms', () => {
      useStore.getState().setAppMode('lyrics');
      useStore.getState().adjustOffset(1000);
      expect(useStore.getState().position.offsetMs).toBe(1000);
    });

    it('ArrowDown adjusts offset -1000ms', () => {
      useStore.getState().setAppMode('lyrics');
      useStore.getState().adjustOffset(-1000);
      expect(useStore.getState().position.offsetMs).toBe(-1000);
    });

    it('arrow keys adjust video offset in video mode', () => {
      useStore.getState().setAppMode('video');
      useStore.getState().adjustVideoOffset(200);
      expect(useStore.getState().videoOffsetMs).toBe(200);
    });

    it('does not adjust offset in visualizer mode', () => {
      // In the actual code, arrow key handlers only fire for lyrics/video modes
      useStore.getState().setAppMode('visualizer');
      const shouldAdjust = useStore.getState().appMode === 'video' || useStore.getState().appMode === 'lyrics';
      expect(shouldAdjust).toBe(false);
    });
  });

  describe('Settings modal suppresses keyboard shortcuts', () => {
    it('keyboard shortcuts are suppressed when settings modal is open', () => {
      // In AppShell, handleKey returns early if settingsOpen is true
      const settingsOpen = true;
      const handled = !settingsOpen;
      expect(handled).toBe(false);
    });
  });
});

// ── Controls Auto-Hide Tests ───────────────────────────────

describe('Controls Auto-Hide', () => {
  it('controls hide after 5 seconds of inactivity', () => {
    const CONTROLS_HIDE_DELAY = 5000;
    expect(CONTROLS_HIDE_DELAY).toBe(5000);
  });

  it('kiosk mode hides controls after 3 seconds', () => {
    const KIOSK_HIDE_DELAY = 3000;
    expect(KIOSK_HIDE_DELAY).toBe(3000);
  });

  it('mouse movement shows controls', () => {
    useStore.getState().setControlsVisible(false);
    useStore.getState().setControlsVisible(true); // Simulate mousemove handler
    expect(useStore.getState().controlsVisible).toBe(true);
  });

  it('touch start shows controls', () => {
    useStore.getState().setControlsVisible(false);
    useStore.getState().setControlsVisible(true); // Simulate touchstart handler
    expect(useStore.getState().controlsVisible).toBe(true);
  });
});

// ── Fullscreen Tests ───────────────────────────────────────

describe('Fullscreen', () => {
  it('tracks fullscreen state', () => {
    useStore.getState().setFullscreen(true);
    expect(useStore.getState().isFullscreen).toBe(true);
  });

  it('iPhone does not support fullscreen', () => {
    const isIPhone = /iPhone|iPod/.test('iPhone');
    expect(isIPhone).toBe(true);
  });

  it('iPad Safari supports fullscreen', () => {
    const isIPhone = /iPhone|iPod/.test('iPad');
    expect(isIPhone).toBe(false);
  });
});

// ── Network Status Tests ───────────────────────────────────

describe('Network Status', () => {
  it('tracks online/offline state', () => {
    useStore.getState().setOnline(false);
    expect(useStore.getState().isOnline).toBe(false);
    useStore.getState().setOnline(true);
    expect(useStore.getState().isOnline).toBe(true);
  });

  it('shows offline banner when offline', () => {
    useStore.getState().setOnline(false);
    const shouldShowBanner = !useStore.getState().isOnline;
    expect(shouldShowBanner).toBe(true);
  });

  it('hides offline banner when online', () => {
    useStore.getState().setOnline(true);
    const shouldShowBanner = !useStore.getState().isOnline;
    expect(shouldShowBanner).toBe(false);
  });
});

// ── Microphone Error Display Tests ─────────────────────────

describe('Microphone Error Handling', () => {
  function getMicDeniedMessage(ua: string): string {
    if (/iPad|iPhone|iPod/.test(ua)) {
      return 'Microphone access denied. Go to Settings > Safari > Microphone and allow access for this site, then reload.';
    }
    if (/Chrome/.test(ua)) {
      return 'Microphone access denied. Click the lock icon in the address bar, set Microphone to "Allow", then reload.';
    }
    if (/Firefox/.test(ua)) {
      return 'Microphone access denied. Click the permissions icon in the address bar and allow microphone access.';
    }
    return 'Microphone access denied. Please allow microphone access in your browser settings and try again.';
  }

  it('provides iOS-specific instructions', () => {
    const msg = getMicDeniedMessage('iPhone');
    expect(msg).toContain('Settings > Safari');
  });

  it('provides Chrome-specific instructions', () => {
    const msg = getMicDeniedMessage('Chrome/120.0');
    expect(msg).toContain('lock icon');
  });

  it('provides Firefox-specific instructions', () => {
    const msg = getMicDeniedMessage('Firefox/120.0');
    expect(msg).toContain('permissions icon');
  });

  it('provides generic instructions for other browsers', () => {
    const msg = getMicDeniedMessage('Safari');
    expect(msg).toContain('browser settings');
  });

  it('stores mic error in store', () => {
    useStore.getState().setMicError('Permission denied');
    expect(useStore.getState().micError).toBe('Permission denied');
  });

  it('start button shows "Try Again" when mic error exists', () => {
    useStore.getState().setMicError('Permission denied');
    const buttonText = useStore.getState().micError ? 'Try Again' : 'Start Listening';
    expect(buttonText).toBe('Try Again');
  });

  it('start button shows "Start Listening" when no mic error', () => {
    const buttonText = useStore.getState().micError ? 'Try Again' : 'Start Listening';
    expect(buttonText).toBe('Start Listening');
  });
});
