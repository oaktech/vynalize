import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import type { WsCommand, WsMessage, WsStateMessage, WsSongMessage, WsBeatMessage } from '../types';

type Role = 'controller' | 'display';

function getWsUrl(role: Role): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws?role=${role}`;
}

/**
 * WebSocket hook — connects to the relay server.
 *
 * - `display` role: listens for commands from controller, pushes state/song/beat back.
 * - `controller` role: sends commands, receives state/song/beat updates.
 */
export function useWsCommands(role: Role) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number>(0);

  // Display role: apply incoming commands to the store
  useEffect(() => {
    if (role !== 'display') return;

    function connect() {
      const ws = new WebSocket(getWsUrl('display'));
      wsRef.current = ws;

      ws.onmessage = (e) => {
        let msg: WsCommand;
        try {
          msg = JSON.parse(e.data);
        } catch {
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
      };

      ws.onclose = () => {
        wsRef.current = null;
        reconnectTimer.current = window.setTimeout(connect, 3000);
      };
    }

    connect();

    // Push state changes to controllers
    const unsub = useStore.subscribe((state, prev) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      // State sync (only when relevant fields change)
      if (
        state.visualizerMode !== prev.visualizerMode ||
        state.appMode !== prev.appMode ||
        state.accentColor !== prev.accentColor ||
        state.sensitivityGain !== prev.sensitivityGain
      ) {
        const msg: WsStateMessage = {
          type: 'state',
          data: {
            visualizerMode: state.visualizerMode,
            appMode: state.appMode,
            accentColor: state.accentColor,
            sensitivityGain: state.sensitivityGain,
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
      unsub();
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [role]);

  // Controller role: receive state/song/beat updates from display
  useEffect(() => {
    if (role !== 'controller') return;

    function connect() {
      const ws = new WebSocket(getWsUrl('controller'));
      wsRef.current = ws;

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
        } else if (msg.type === 'song') {
          store.setCurrentSong(msg.data);
        } else if (msg.type === 'beat') {
          store.setBpm(msg.bpm);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        reconnectTimer.current = window.setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [role]);

  // Return a send function for the controller to dispatch commands
  const send = (cmd: WsCommand) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(cmd));
    }
  };

  return { send };
}
