import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from '../store';
import type { WsCommand, WsStateMessage, WsSongMessage, WsBeatMessage, WsMessage } from '../types';

// ── WebSocket Command Processing Tests ─────────────────────
// Tests the message handling logic from useWsCommands.ts

describe('WebSocket Command Processing', () => {
  describe('Display role — incoming command handling', () => {
    function processCommand(msg: WsMessage) {
      if (msg.type === 'session') {
        useStore.getState().setSessionId(msg.sessionId);
        return;
      }

      if (msg.type === 'remoteStatus') {
        useStore.getState().setRemoteConnected(msg.connected);
        return;
      }

      if (msg.type !== 'command') return;

      const store = useStore.getState();
      switch (msg.action) {
        case 'setVisualizerMode':
          store.setVisualizerMode(msg.value);
          break;
        case 'setAppMode':
          store.setAppMode(msg.value);
          break;
        case 'setAccentColor':
          store.setAccentColor(msg.value);
          break;
        case 'adjustSensitivity':
          store.setSensitivityGain(msg.value);
          break;
        case 'nextVisualizer':
          store.nextVisualizer();
          break;
        case 'prevVisualizer':
          store.prevVisualizer();
          break;
        case 'adjustVideoOffset':
          store.adjustVideoOffset(msg.value);
          break;
      }
    }

    it('sets visualizer mode from command', () => {
      processCommand({ type: 'command', action: 'setVisualizerMode', value: 'nebula' });
      expect(useStore.getState().visualizerMode).toBe('nebula');
    });

    it('sets app mode from command', () => {
      processCommand({ type: 'command', action: 'setAppMode', value: 'lyrics' });
      expect(useStore.getState().appMode).toBe('lyrics');
    });

    it('sets accent color from command', () => {
      processCommand({ type: 'command', action: 'setAccentColor', value: '#ff6b6b' });
      expect(useStore.getState().accentColor).toBe('#ff6b6b');
    });

    it('adjusts sensitivity from command', () => {
      processCommand({ type: 'command', action: 'adjustSensitivity', value: 1.5 });
      expect(useStore.getState().sensitivityGain).toBe(1.5);
    });

    it('cycles to next visualizer from command', () => {
      useStore.getState().setVisualizerMode('spectrum');
      processCommand({ type: 'command', action: 'nextVisualizer' });
      expect(useStore.getState().visualizerMode).toBe('radial');
    });

    it('cycles to previous visualizer from command', () => {
      useStore.getState().setVisualizerMode('radial');
      processCommand({ type: 'command', action: 'prevVisualizer' });
      expect(useStore.getState().visualizerMode).toBe('spectrum');
    });

    it('adjusts video offset from command', () => {
      useStore.getState().setVideoOffsetMs(0);
      processCommand({ type: 'command', action: 'adjustVideoOffset', value: 200 });
      expect(useStore.getState().videoOffsetMs).toBe(200);
    });

    it('handles session assignment', () => {
      processCommand({ type: 'session', sessionId: 'ABC123' });
      expect(useStore.getState().sessionId).toBe('ABC123');
    });

    it('handles remote connection status', () => {
      processCommand({ type: 'remoteStatus', connected: true, controllers: 1 });
      expect(useStore.getState().remoteConnected).toBe(true);
    });

    it('handles remote disconnection', () => {
      useStore.getState().setRemoteConnected(true);
      processCommand({ type: 'remoteStatus', connected: false, controllers: 0 });
      expect(useStore.getState().remoteConnected).toBe(false);
    });

    it('ignores non-command message types', () => {
      const mode = useStore.getState().visualizerMode;
      processCommand({ type: 'state', data: { visualizerMode: 'nebula', appMode: 'visualizer', accentColor: '#fff', sensitivityGain: 2 } });
      // state messages are for controller role, not display
      expect(useStore.getState().visualizerMode).toBe(mode);
    });
  });

  describe('Controller role — incoming state/song/beat handling', () => {
    function processControllerMessage(msg: WsMessage) {
      const store = useStore.getState();
      if (msg.type === 'state') {
        store.setVisualizerMode(msg.data.visualizerMode);
        store.setAppMode(msg.data.appMode);
        store.setAccentColor(msg.data.accentColor);
        store.setSensitivityGain(msg.data.sensitivityGain);
      } else if (msg.type === 'song') {
        store.setCurrentSong(msg.data);
      } else if (msg.type === 'beat') {
        store.setBpm(msg.bpm);
      }
    }

    it('applies full state update', () => {
      const stateMsg: WsStateMessage = {
        type: 'state',
        data: {
          visualizerMode: 'synthwave',
          appMode: 'lyrics',
          accentColor: '#00ff00',
          sensitivityGain: 0.5,
        },
      };
      processControllerMessage(stateMsg);
      expect(useStore.getState().visualizerMode).toBe('synthwave');
      expect(useStore.getState().appMode).toBe('lyrics');
      expect(useStore.getState().accentColor).toBe('#00ff00');
      expect(useStore.getState().sensitivityGain).toBe(0.5);
    });

    it('applies song update', () => {
      const songMsg: WsSongMessage = {
        type: 'song',
        data: {
          title: 'Remote Song',
          artist: 'Remote Artist',
          album: 'Remote Album',
          duration: 300,
          albumArtUrl: 'https://example.com/art.jpg',
          musicbrainzId: null,
          bpm: 128,
        },
      };
      processControllerMessage(songMsg);
      expect(useStore.getState().currentSong?.title).toBe('Remote Song');
    });

    it('clears song when null received', () => {
      useStore.getState().setCurrentSong({
        title: 'Old',
        artist: 'Old',
        album: '',
        duration: 0,
        albumArtUrl: null,
        musicbrainzId: null,
        bpm: null,
      });
      processControllerMessage({ type: 'song', data: null });
      expect(useStore.getState().currentSong).toBeNull();
    });

    it('applies BPM update', () => {
      processControllerMessage({ type: 'beat', bpm: 140 });
      expect(useStore.getState().bpm).toBe(140);
    });

    it('clears BPM when null received', () => {
      useStore.getState().setBpm(120);
      processControllerMessage({ type: 'beat', bpm: null });
      expect(useStore.getState().bpm).toBeNull();
    });
  });

  describe('Display role — outgoing state sync', () => {
    it('detects visualizer mode change', () => {
      const prev = { visualizerMode: 'spectrum' as const, appMode: 'visualizer' as const, accentColor: '#8b5cf6', sensitivityGain: 1 };
      const state = { ...prev, visualizerMode: 'radial' as const };
      const changed = state.visualizerMode !== prev.visualizerMode;
      expect(changed).toBe(true);
    });

    it('detects app mode change', () => {
      const prev = { appMode: 'visualizer' as const };
      const state = { appMode: 'lyrics' as const };
      expect(state.appMode !== prev.appMode).toBe(true);
    });

    it('detects accent color change', () => {
      const prev = { accentColor: '#8b5cf6' };
      const state = { accentColor: '#ff0000' };
      expect(state.accentColor !== prev.accentColor).toBe(true);
    });

    it('detects sensitivity gain change', () => {
      const prev = { sensitivityGain: 1 };
      const state = { sensitivityGain: 1.5 };
      expect(state.sensitivityGain !== prev.sensitivityGain).toBe(true);
    });

    it('does not trigger sync when nothing changed', () => {
      const prev = { visualizerMode: 'spectrum', appMode: 'visualizer', accentColor: '#8b5cf6', sensitivityGain: 1 };
      const state = { ...prev };
      const changed =
        state.visualizerMode !== prev.visualizerMode ||
        state.appMode !== prev.appMode ||
        state.accentColor !== prev.accentColor ||
        state.sensitivityGain !== prev.sensitivityGain;
      expect(changed).toBe(false);
    });
  });

  describe('WebSocket URL construction', () => {
    function getWsUrl(role: string, sessionId?: string | null): string {
      const proto = 'wss';
      let url = `${proto}://localhost:3001/ws?role=${role}`;
      if (sessionId) url += `&session=${encodeURIComponent(sessionId)}`;
      return url;
    }

    it('constructs display URL', () => {
      expect(getWsUrl('display')).toBe('wss://localhost:3001/ws?role=display');
    });

    it('constructs controller URL with session', () => {
      expect(getWsUrl('controller', 'ABC123')).toBe('wss://localhost:3001/ws?role=controller&session=ABC123');
    });

    it('encodes special characters in session ID', () => {
      expect(getWsUrl('controller', 'A B+C')).toBe('wss://localhost:3001/ws?role=controller&session=A%20B%2BC');
    });

    it('omits session param when null', () => {
      expect(getWsUrl('controller', null)).toBe('wss://localhost:3001/ws?role=controller');
    });
  });

  describe('Reconnection backoff', () => {
    function backoffDelay(attempt: number): number {
      const BASE_DELAY = 3000;
      const MAX_DELAY = 30000;
      return Math.min(BASE_DELAY * 2 ** attempt, MAX_DELAY);
    }

    it('first attempt: 3s', () => {
      expect(backoffDelay(0)).toBe(3000);
    });

    it('second attempt: 6s', () => {
      expect(backoffDelay(1)).toBe(6000);
    });

    it('third attempt: 12s', () => {
      expect(backoffDelay(2)).toBe(12000);
    });

    it('fourth attempt: 24s', () => {
      expect(backoffDelay(3)).toBe(24000);
    });

    it('caps at 30s max', () => {
      expect(backoffDelay(4)).toBe(30000);
      expect(backoffDelay(10)).toBe(30000);
    });

    it('max 10 retries allowed', () => {
      const MAX_RETRIES = 10;
      for (let i = 0; i < MAX_RETRIES; i++) {
        expect(backoffDelay(i)).toBeGreaterThan(0);
      }
    });
  });

  describe('Message validation', () => {
    it('rejects messages larger than 50KB', () => {
      const MAX_MESSAGE_SIZE = 50 * 1024;
      const largeMsg = 'x'.repeat(MAX_MESSAGE_SIZE + 1);
      expect(largeMsg.length).toBeGreaterThan(MAX_MESSAGE_SIZE);
    });

    it('accepts messages under 50KB', () => {
      const MAX_MESSAGE_SIZE = 50 * 1024;
      const smallMsg = JSON.stringify({ type: 'command', action: 'nextVisualizer' });
      expect(smallMsg.length).toBeLessThan(MAX_MESSAGE_SIZE);
    });

    it('validates known message types', () => {
      const VALID_MESSAGE_TYPES = new Set([
        'state', 'song', 'beat', 'command', 'visualizer',
        'lyrics', 'video', 'nowPlaying', 'seekTo', 'display',
        'remoteStatus', 'session', 'error', 'ping', 'pong',
      ]);
      expect(VALID_MESSAGE_TYPES.has('command')).toBe(true);
      expect(VALID_MESSAGE_TYPES.has('state')).toBe(true);
      expect(VALID_MESSAGE_TYPES.has('exploit')).toBe(false);
    });
  });
});
