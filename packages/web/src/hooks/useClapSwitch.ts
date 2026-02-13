import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import type { AppMode } from '../types';

const CLAP_RMS_DELTA = 0.03;
const DEBUG_SPIKES = false; // flip to true to log all audio spikes
const MIN_CLAP_GAP_MS = 150;
const DOUBLE_CLAP_MIN_MS = 300;
const DOUBLE_CLAP_MAX_MS = 800;
const SWITCH_COOLDOWN_MS = 3000;

const MODE_ORDER: AppMode[] = ['visualizer', 'lyrics', 'video', 'ascii'];

function nextMode(current: AppMode): AppMode {
  const idx = MODE_ORDER.indexOf(current);
  return MODE_ORDER[(idx + 1) % MODE_ORDER.length];
}

function serverLog(msg: string) {
  fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag: 'clap', msg }),
  }).catch(() => {});
}

export function useClapSwitch() {
  const audioFeatures = useStore((s) => s.audioFeatures);
  const appMode = useStore((s) => s.appMode);
  const setAppMode = useStore((s) => s.setAppMode);
  const setClapFlash = useStore((s) => s.setClapFlash);

  const lastClapTime = useRef(0);
  const lastSwitchTime = useRef(0);
  const prevRms = useRef(0);

  useEffect(() => {
    if (!audioFeatures) return;

    const { rms } = audioFeatures;
    const now = performance.now();

    const rmsDelta = rms - prevRms.current;
    prevRms.current = rms;

    if (DEBUG_SPIKES && rmsDelta > 0.02) {
      serverLog(`spike | rmsDelta: ${rmsDelta.toFixed(3)} rms: ${rms.toFixed(3)} prevRms: ${(rms - rmsDelta).toFixed(3)}`);
    }

    if (rmsDelta < CLAP_RMS_DELTA) return;
    if (now - lastClapTime.current < MIN_CLAP_GAP_MS) return;
    if (now - lastSwitchTime.current < SWITCH_COOLDOWN_MS) return;

    const gap = now - lastClapTime.current;
    lastClapTime.current = now;

    serverLog(`CLAP — gap: ${Math.round(gap)}ms | rmsDelta: ${rmsDelta.toFixed(3)}`);

    // Visual feedback — flash on every detected clap
    setClapFlash(true);
    setTimeout(() => setClapFlash(false), 150);

    // Double-clap detection
    if (gap >= DOUBLE_CLAP_MIN_MS && gap <= DOUBLE_CLAP_MAX_MS) {
      const next = nextMode(appMode);
      serverLog(`DOUBLE-CLAP → switching ${appMode} → ${next}`);
      setAppMode(next);
      lastSwitchTime.current = now;
    }
  }, [audioFeatures, appMode, setAppMode, setClapFlash]);
}
