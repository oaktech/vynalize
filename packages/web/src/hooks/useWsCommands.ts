import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import type { WsCommand, WsMessage, WsStateMessage, WsSongMessage, WsBeatMessage } from '../types';

type Role = 'controller' | 'display';

const MAX_RETRIES = 10;
const BASE_DELAY = 3000;
const MAX_DELAY = 30000;

function getWsUrl(role: Role, sessionId?: string | null): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  let url = `${proto}://${location.host}/ws?role=${role}`;
  if (sessionId) url += `&session=${encodeURIComponent(sessionId)}`;
  return url;
}

function backoffDelay(attempt: number): number {
  return Math.min(BASE_DELAY * 2 ** attempt, MAX_DELAY);
}

/**
 * WebSocket hook — connects to the relay server.
 *
 * - `display` role: listens for commands from controller, pushes state/song/beat back.
 * - `controller` role: sends commands, receives state/song/beat updates.
 */
export function useWsCommands(role: Role, sessionId?: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number>(0);
  const retriesRef = useRef(0);

  // Display role: apply incoming commands to the store
  useEffect(() => {
    if (role !== 'display') return;

    let unsub: (() => void) | null = null;

    function connect() {
      useStore.getState().setWsStatus('connecting');
      const existingSessionId = useStore.getState().sessionId;
      const ws = new WebSocket(getWsUrl('display', existingSessionId));
      wsRef.current = ws;

      ws.onopen = () => {
        retriesRef.current = 0;
        useStore.getState().setWsStatus('connected');
      };

      ws.onmessage = (e) => {
        let msg: WsMessage;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }

        // Handle session assignment from server
        if (msg.type === 'session') {
          useStore.getState().setSessionId(msg.sessionId);
          return;
        }

        // Handle remote connection status
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
          case 'setAutoPlayVideo':
            store.setAutoPlayVideo(msg.value);
            break;
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        useStore.getState().setWsStatus('disconnected');

        if (retriesRef.current < MAX_RETRIES) {
          const delay = backoffDelay(retriesRef.current);
          retriesRef.current++;
          reconnectTimer.current = window.setTimeout(connect, delay);
        }
      };
    }

    connect();

    // Push state changes to controllers
    unsub = useStore.subscribe((state, prev) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      // State sync (only when relevant fields change)
      if (
        state.visualizerMode !== prev.visualizerMode ||
        state.appMode !== prev.appMode ||
        state.accentColor !== prev.accentColor ||
        state.sensitivityGain !== prev.sensitivityGain ||
        state.autoPlayVideo !== prev.autoPlayVideo
      ) {
        const msg: WsStateMessage = {
          type: 'state',
          data: {
            visualizerMode: state.visualizerMode,
            appMode: state.appMode,
            accentColor: state.accentColor,
            sensitivityGain: state.sensitivityGain,
            autoPlayVideo: state.autoPlayVideo,
          },
        };
        ws.send(JSON.stringify(msg));
      }

      // Song change
      if (state.currentSong !== prev.currentSong) {
        const msg: WsSongMessage = { type: 'song', data: state.currentSong };
        ws.send(JSON.stringify(msg));
      }

      // BPM change
      if (state.bpm !== prev.bpm) {
        const msg: WsBeatMessage = { type: 'beat', bpm: state.bpm };
        ws.send(JSON.stringify(msg));
      }
    });

    return () => {
      unsub?.();
      unsub = null;
      retriesRef.current = MAX_RETRIES; // Prevent onclose from scheduling reconnect
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [role]);

  // Controller role: receive state/song/beat updates from display
  useEffect(() => {
    if (role !== 'controller') return;

    function connect() {
      useStore.getState().setWsStatus('connecting');
      const ws = new WebSocket(getWsUrl('controller', sessionId));
      wsRef.current = ws;

      ws.onopen = () => {
        retriesRef.current = 0;
        useStore.getState().setWsStatus('connected');
      };

      ws.onmessage = (e) => {
        let msg: WsMessage;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }

        const store = useStore.getState();
        if (msg.type === 'state') {
          store.setVisualizerMode(msg.data.visualizerMode);
          store.setAppMode(msg.data.appMode);
          store.setAccentColor(msg.data.accentColor);
          store.setSensitivityGain(msg.data.sensitivityGain);
          store.setAutoPlayVideo(msg.data.autoPlayVideo);
        } else if (msg.type === 'song') {
          store.setCurrentSong(msg.data);
        } else if (msg.type === 'beat') {
          store.setBpm(msg.bpm);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        useStore.getState().setWsStatus('disconnected');

        if (retriesRef.current < MAX_RETRIES) {
          const delay = backoffDelay(retriesRef.current);
          retriesRef.current++;
          reconnectTimer.current = window.setTimeout(connect, delay);
        }
      };
    }

    connect();

    return () => {
      retriesRef.current = MAX_RETRIES; // Prevent onclose from scheduling reconnect
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [role, sessionId]);

  // Return a send function for the controller to dispatch commands
  const send = (cmd: WsCommand) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(cmd));
    }
  };

  return { send };
}
