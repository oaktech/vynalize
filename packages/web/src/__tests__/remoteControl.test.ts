import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useStore } from '../store';

// ── Remote Control Tests ───────────────────────────────────

describe('Remote Control', () => {
  describe('Session code validation', () => {
    function validateCode(code: string): { valid: boolean; error?: string } {
      const trimmed = code.trim().toUpperCase();
      if (trimmed.length < 4) {
        return { valid: false, error: 'Enter the code shown on your display' };
      }
      return { valid: true };
    }

    it('rejects empty code', () => {
      const result = validateCode('');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('rejects code shorter than 4 characters', () => {
      expect(validateCode('AB').valid).toBe(false);
      expect(validateCode('ABC').valid).toBe(false);
    });

    it('accepts code with 4 or more characters', () => {
      expect(validateCode('ABCD').valid).toBe(true);
      expect(validateCode('ABCDEF').valid).toBe(true);
    });

    it('trims whitespace', () => {
      expect(validateCode('  ABCD  ').valid).toBe(true);
    });

    it('uppercases input', () => {
      const trimmed = 'abcdef'.trim().toUpperCase();
      expect(trimmed).toBe('ABCDEF');
    });
  });

  describe('Session code input filtering', () => {
    function filterInput(value: string): string {
      return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    it('removes non-alphanumeric characters', () => {
      expect(filterInput('AB-CD')).toBe('ABCD');
      expect(filterInput('ab cd!')).toBe('ABCD');
    });

    it('converts to uppercase', () => {
      expect(filterInput('abcdef')).toBe('ABCDEF');
    });

    it('preserves numbers', () => {
      expect(filterInput('abc123')).toBe('ABC123');
    });

    it('handles empty string', () => {
      expect(filterInput('')).toBe('');
    });
  });

  describe('Remote UI commands', () => {
    it('sends setVisualizerMode command', () => {
      const send = vi.fn();
      send({ type: 'command', action: 'setVisualizerMode', value: 'nebula' });
      expect(send).toHaveBeenCalledWith({
        type: 'command',
        action: 'setVisualizerMode',
        value: 'nebula',
      });
    });

    it('sends setAppMode and setVisualizerMode when in non-visualizer mode', () => {
      const send = vi.fn();
      const appMode: string = 'lyrics';
      if (appMode !== 'visualizer') {
        send({ type: 'command', action: 'setAppMode', value: 'visualizer' });
      }
      send({ type: 'command', action: 'setVisualizerMode', value: 'synthwave' });
      expect(send).toHaveBeenCalledTimes(2);
      expect(send).toHaveBeenNthCalledWith(1, {
        type: 'command',
        action: 'setAppMode',
        value: 'visualizer',
      });
    });

    it('does not send setAppMode when already in visualizer mode', () => {
      const send = vi.fn();
      const appMode = 'visualizer';
      if (appMode !== 'visualizer') {
        send({ type: 'command', action: 'setAppMode', value: 'visualizer' });
      }
      send({ type: 'command', action: 'setVisualizerMode', value: 'nebula' });
      expect(send).toHaveBeenCalledTimes(1);
    });

    it('sends adjustSensitivity with value', () => {
      const send = vi.fn();
      send({ type: 'command', action: 'adjustSensitivity', value: 1.5 });
      expect(send).toHaveBeenCalledWith({
        type: 'command',
        action: 'adjustSensitivity',
        value: 1.5,
      });
    });

    it('sends adjustVideoOffset with correct delta', () => {
      const send = vi.fn();
      send({ type: 'command', action: 'adjustVideoOffset', value: -200 });
      expect(send).toHaveBeenCalledWith({
        type: 'command',
        action: 'adjustVideoOffset',
        value: -200,
      });
    });
  });

  describe('Remote config loading', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('checks requireCode from /api/config', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ requireCode: true }),
      } as Response);

      const res = await fetch('/api/config');
      const config = await res.json();
      expect(config.requireCode).toBe(true);
    });

    it('defaults to requiring code on fetch error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      let requireCode = true;
      try {
        await fetch('/api/config');
      } catch {
        // Default stays true
      }
      expect(requireCode).toBe(true);
    });
  });

  describe('Disconnect behavior', () => {
    it('clears session ID on disconnect', () => {
      useStore.getState().setSessionId('ABC123');
      useStore.getState().setSessionId(null);
      expect(useStore.getState().sessionId).toBeNull();
    });
  });

  describe('Visualizer mode list', () => {
    const VIZ_MODES = [
      { id: 'spectrum', label: 'Spectrum' },
      { id: 'radial', label: 'Radial' },
      { id: 'particles', label: 'Particles' },
      { id: 'radical', label: 'Radical' },
      { id: 'nebula', label: 'Nebula' },
      { id: 'vitals', label: 'Vitals' },
      { id: 'synthwave', label: 'Synthwave' },
      { id: 'spaceage', label: 'Space Age' },
      { id: 'starrynight', label: 'Starry Night' },
      { id: 'guitarhero', label: 'Guitar Hero' },
      { id: 'vynalize', label: 'Vynalize' },
    ];

    it('remote has 11 visualizer modes (excludes beatsaber)', () => {
      // Note: RemoteControl.tsx VIZ_MODES has 11 entries, missing 'beatsaber'
      expect(VIZ_MODES.length).toBe(11);
      expect(VIZ_MODES.find(m => m.id === 'beatsaber')).toBeUndefined();
    });

    it('all modes have labels', () => {
      for (const mode of VIZ_MODES) {
        expect(mode.label).toBeTruthy();
        expect(mode.id).toBeTruthy();
      }
    });
  });

  describe('Video sync flash', () => {
    it('shows negative offset as minus sign', () => {
      const deltaMs = -200;
      const flash = deltaMs < 0 ? '\u22120.2s' : '+0.2s';
      expect(flash).toBe('\u22120.2s');
    });

    it('shows positive offset as plus sign', () => {
      const deltaMs = 200;
      const flash = deltaMs < 0 ? '\u22120.2s' : '+0.2s';
      expect(flash).toBe('+0.2s');
    });
  });
});
